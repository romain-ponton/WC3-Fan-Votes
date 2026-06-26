const mongoose = require("mongoose");
const { createClient } = require("redis");
const { seedPolls, seedVotes } = require("./seed-data");

const pollSchema = new mongoose.Schema(
  {
    pollId: { type: String, required: true, unique: true },
    match: { type: String, required: true },
    competition: { type: String, required: true },
    matchId: { type: String, required: false },
    question: { type: String, required: true },
    category: { type: String, enum: ["player", "team", "man_of_the_match"], required: true },
    voteType: { type: String, required: false },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    startsAt: { type: Date, required: true },
    choices: [
      {
        choiceId: { type: String, required: true },
        label: { type: String, required: true },
        team: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

const voteHistorySchema = new mongoose.Schema(
  {
    pollId: { type: String, required: true, index: true },
    voteEventId: { type: String, required: false },
    userId: { type: String, required: true },
    choiceId: { type: String, required: true },
    device: { type: String, required: false },
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { versionKey: false }
);

let Poll;
let VoteHistory;

class AppStore {
  constructor() {
    this.mode = "memory";
    this.redis = null;
    this.memory = {
      polls: new Map(),
      history: [],
      ranking: new Map(),
      trends: {
        teams: new Map(),
        players: new Map(),
        matches: new Map()
      }
    };
  }

  async connect() {
    const mongoUri = process.env.MONGO_URI;
    const redisUrl = process.env.REDIS_URL;

    if (!mongoUri || !redisUrl) {
      await this.seed({ reset: true });
      return;
    }

    await mongoose.connect(mongoUri);
    Poll = mongoose.models.Poll || mongoose.model("Poll", pollSchema);
    VoteHistory = mongoose.models.VoteHistory || mongoose.model("VoteHistory", voteHistorySchema);

    this.redis = createClient({ url: redisUrl });
    this.redis.on("error", (error) => console.error("Redis error:", error.message));
    await this.redis.connect();
    this.mode = "nosql";

    const existingPolls = await Poll.countDocuments();
    if (existingPolls === 0) {
      await this.seed({ reset: true });
    } else {
      await this.rebuildRedisFromHistory();
    }
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  async seed({ reset = false } = {}) {
    if (this.mode === "nosql") {
      if (reset) {
        await Poll.deleteMany({});
        await VoteHistory.deleteMany({});
        const keys = await this.redis.keys("*:ranking");
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }

      await Poll.insertMany(seedPolls, { ordered: true });
      for (const vote of seedVotes) {
        await this.addVote({ ...vote, allowClosedPoll: true });
      }
      return;
    }

    if (reset) {
      this.memory.polls.clear();
      this.memory.history = [];
      this.memory.ranking.clear();
      this.memory.trends.teams.clear();
      this.memory.trends.players.clear();
      this.memory.trends.matches.clear();
    }

    for (const poll of seedPolls) {
      this.memory.polls.set(poll.pollId, structuredClone(poll));
      this.memory.ranking.set(poll.pollId, new Map(poll.choices.map((choice) => [choice.choiceId, 0])));
    }

    for (const vote of seedVotes) {
      await this.addVote({ ...vote, allowClosedPoll: true });
    }
  }

  async createPoll(poll) {
    const normalized = {
      ...poll,
      pollId: poll.pollId || `vote_${Date.now()}`,
      status: poll.status || "open",
      startsAt: poll.startsAt || new Date().toISOString()
    };

    this.validatePoll(normalized);

    if (this.mode === "nosql") {
      const created = await Poll.create(normalized);
      await this.redis.zAdd(this.rankingKey(normalized.pollId), normalized.choices.map((choice) => ({
        score: 0,
        value: choice.choiceId
      })));
      return this.toPlain(created);
    }

    this.memory.polls.set(normalized.pollId, structuredClone(normalized));
    this.memory.ranking.set(normalized.pollId, new Map(normalized.choices.map((choice) => [choice.choiceId, 0])));
    return structuredClone(normalized);
  }

  async addPollChoice(pollId, choice) {
    const poll = await this.getPoll(pollId);
    if (!poll) {
      const error = new Error("Vote introuvable.");
      error.statusCode = 404;
      throw error;
    }

    const normalized = {
      choiceId: choice.choiceId || `choice_${Date.now()}`,
      label: choice.label,
      team: choice.team || choice.label
    };

    if (!normalized.label) {
      const error = new Error("Le choix doit contenir un libelle.");
      error.statusCode = 400;
      throw error;
    }
    if (poll.choices.some((item) => item.choiceId === normalized.choiceId || item.label.toLowerCase() === normalized.label.toLowerCase())) {
      const error = new Error("Ce choix existe deja pour ce vote.");
      error.statusCode = 409;
      throw error;
    }

    if (this.mode === "nosql") {
      await Poll.updateOne({ pollId }, { $push: { choices: normalized } });
      await this.redis.zAdd(this.rankingKey(pollId), { score: 0, value: normalized.choiceId });
      return this.getPoll(pollId);
    }

    const updated = this.memory.polls.get(pollId);
    updated.choices.push(normalized);
    this.memory.ranking.get(pollId).set(normalized.choiceId, 0);
    return structuredClone(updated);
  }

  async getOpenPolls() {
    if (this.mode === "nosql") {
      const polls = await Poll.find({ status: "open" }).sort({ startsAt: 1 });
      return polls.map((poll) => this.toPlain(poll));
    }

    return Array.from(this.memory.polls.values())
      .filter((poll) => poll.status === "open")
      .map((poll) => structuredClone(poll));
  }

  async getPoll(pollId) {
    if (this.mode === "nosql") {
      return this.toPlain(await Poll.findOne({ pollId }));
    }

    const poll = this.memory.polls.get(pollId);
    return poll ? structuredClone(poll) : null;
  }

  async addVote({ pollId, userId, choiceId, createdAt = new Date().toISOString(), voteEventId, device, allowClosedPoll = false }) {
    const poll = await this.getPoll(pollId);
    if (!poll) {
      const error = new Error("Vote introuvable.");
      error.statusCode = 404;
      throw error;
    }
    if (!allowClosedPoll && poll.status !== "open") {
      const error = new Error("Ce vote est ferme.");
      error.statusCode = 409;
      throw error;
    }
    if (!poll.choices.some((choice) => choice.choiceId === choiceId)) {
      const error = new Error("Choix invalide pour ce vote.");
      error.statusCode = 400;
      throw error;
    }

    const entry = { pollId, userId, choiceId, createdAt, voteEventId, device };

    if (this.mode === "nosql") {
      await VoteHistory.create(entry);
      await this.incrementRedisScores(poll, choiceId);
      return entry;
    }

    this.memory.history.push(structuredClone(entry));
    const ranking = this.memory.ranking.get(pollId) || new Map();
    ranking.set(choiceId, (ranking.get(choiceId) || 0) + 1);
    this.memory.ranking.set(pollId, ranking);
    this.incrementMemoryTrends(poll, choiceId);
    return structuredClone(entry);
  }

  async getRanking(pollId) {
    const poll = await this.getPoll(pollId);
    if (!poll) {
      return null;
    }

    let scores;
    if (this.mode === "nosql") {
      const redisScores = await this.redis.zRangeWithScores(this.rankingKey(pollId), 0, -1, { REV: true });
      scores = new Map(redisScores.map((item) => [item.value, item.score]));
    } else {
      scores = this.memory.ranking.get(pollId) || new Map();
    }

    return poll.choices
      .map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        team: choice.team,
        votes: Number(scores.get(choice.choiceId) || 0)
      }))
      .sort((left, right) => right.votes - left.votes || left.label.localeCompare(right.label));
  }

  async getHistory(pollId, limit = 20) {
    if (this.mode === "nosql") {
      const entries = await VoteHistory.find({ pollId }).sort({ createdAt: -1 }).limit(limit);
      return entries.map((entry) => this.toPlain(entry));
    }

    return this.memory.history
      .filter((entry) => entry.pollId === pollId)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, limit)
      .map((entry) => structuredClone(entry));
  }

  async getLiveDashboard(limit = 5) {
    if (this.mode === "nosql") {
      const [teams, players, matches] = await Promise.all([
        this.getRedisTrend(this.teamTrendKey(), limit),
        this.getRedisTrend(this.playerTrendKey(), limit),
        this.getRedisTrend(this.matchTrendKey(), limit)
      ]);
      return { teams, players, matches };
    }

    return {
      teams: this.mapToTrend(this.memory.trends.teams, limit),
      players: this.mapToTrend(this.memory.trends.players, limit),
      matches: this.mapToTrend(this.memory.trends.matches, limit)
    };
  }

  async rebuildRedisFromHistory() {
    const keys = await this.redis.keys("*:ranking");
    if (keys.length > 0) {
      await this.redis.del(keys);
    }

    const polls = await Poll.find({});
    for (const pollDocument of polls) {
      const poll = this.toPlain(pollDocument);
      await this.redis.zAdd(this.rankingKey(poll.pollId), poll.choices.map((choice) => ({
        score: 0,
        value: choice.choiceId
      })));
    }

    const history = await VoteHistory.find({}).sort({ createdAt: 1 });
    for (const entry of history) {
      const poll = this.toPlain(polls.find((item) => item.pollId === entry.pollId));
      if (poll) {
        await this.incrementRedisScores(poll, entry.choiceId);
      }
    }
  }

  async incrementRedisScores(poll, choiceId) {
    const choice = poll.choices.find((item) => item.choiceId === choiceId);
    if (!choice) {
      return;
    }

    const operations = [
      this.redis.zIncrBy(this.rankingKey(poll.pollId), 1, choiceId),
      this.redis.zIncrBy(this.matchTrendKey(), 1, poll.match)
    ];

    if (poll.category === "team") {
      operations.push(this.redis.zIncrBy(this.teamTrendKey(), 1, choice.label));
    } else {
      operations.push(this.redis.zIncrBy(this.playerTrendKey(), 1, choice.label));
      operations.push(this.redis.zIncrBy(this.teamTrendKey(), 1, choice.team));
    }

    await Promise.all(operations);
  }

  incrementMemoryTrends(poll, choiceId) {
    const choice = poll.choices.find((item) => item.choiceId === choiceId);
    if (!choice) {
      return;
    }

    this.incrementMap(this.memory.trends.matches, poll.match);
    if (poll.category === "team") {
      this.incrementMap(this.memory.trends.teams, choice.label);
    } else {
      this.incrementMap(this.memory.trends.players, choice.label);
      this.incrementMap(this.memory.trends.teams, choice.team);
    }
  }

  incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  async getRedisTrend(key, limit) {
    const rows = await this.redis.zRangeWithScores(key, 0, limit - 1, { REV: true });
    return rows.map((item) => ({ label: item.value, votes: Number(item.score) }));
  }

  mapToTrend(map, limit) {
    return Array.from(map.entries())
      .map(([label, votes]) => ({ label, votes }))
      .sort((left, right) => right.votes - left.votes || left.label.localeCompare(right.label))
      .slice(0, limit);
  }

  rankingKey(pollId) {
    return `poll:${pollId}:ranking`;
  }

  teamTrendKey() {
    return "team:popularity:ranking";
  }

  playerTrendKey() {
    return "player:popularity:ranking";
  }

  matchTrendKey() {
    return "match:activity:ranking";
  }

  toPlain(document) {
    if (!document) {
      return null;
    }
    const value = document.toObject ? document.toObject() : document;
    return this.removeMongoInternals(value);
  }

  removeMongoInternals(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.removeMongoInternals(item));
    }
    if (value && typeof value === "object") {
      const cleaned = {};
      for (const [key, item] of Object.entries(value)) {
        if (key !== "_id" && key !== "__v") {
          cleaned[key] = this.removeMongoInternals(item);
        }
      }
      return cleaned;
    }
    return value;
  }

  validatePoll(poll) {
    if (!poll.match || !poll.question || !poll.category || !Array.isArray(poll.choices) || poll.choices.length < 2) {
      const error = new Error("Un vote doit contenir un match, une question, une categorie et au moins deux choix.");
      error.statusCode = 400;
      throw error;
    }
  }
}

module.exports = { AppStore };
