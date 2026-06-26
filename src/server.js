require("dotenv").config();

const express = require("express");
const path = require("path");
const { AppStore } = require("./store");
const { sourceDataset } = require("./seed-data");

const app = express();
const store = new AppStore();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    storageMode: store.mode,
    models: store.mode === "nosql" ? ["MongoDB document", "Redis key-value/sorted-set"] : ["memoire de demonstration"],
    sourceDataset
  });
});

app.post("/api/seed", async (req, res, next) => {
  try {
    await store.seed({ reset: true });
    res.status(201).json({ message: "Jeu de donnees recharge.", storageMode: store.mode });
  } catch (error) {
    next(error);
  }
});

app.get("/api/polls", async (req, res, next) => {
  try {
    res.json(await store.getOpenPolls());
  } catch (error) {
    next(error);
  }
});

app.post("/api/polls", async (req, res, next) => {
  try {
    const poll = await store.createPoll(req.body);
    res.status(201).json(poll);
  } catch (error) {
    next(error);
  }
});

app.get("/api/polls/:pollId", async (req, res, next) => {
  try {
    const poll = await store.getPoll(req.params.pollId);
    if (!poll) {
      res.status(404).json({ error: "Vote introuvable." });
      return;
    }
    res.json(poll);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    res.json(await store.getLiveDashboard(6));
  } catch (error) {
    next(error);
  }
});

app.post("/api/polls/:pollId/vote", async (req, res, next) => {
  try {
    const entry = await store.addVote({
      pollId: req.params.pollId,
      userId: req.body.userId,
      choiceId: req.body.choiceId
    });
    const ranking = await store.getRanking(req.params.pollId);
    res.status(201).json({ vote: entry, ranking });
  } catch (error) {
    next(error);
  }
});

app.post("/api/polls/:pollId/options", async (req, res, next) => {
  try {
    const poll = await store.addPollChoice(req.params.pollId, req.body);
    res.status(201).json(poll);
  } catch (error) {
    next(error);
  }
});

app.get("/api/polls/:pollId/ranking", async (req, res, next) => {
  try {
    const ranking = await store.getRanking(req.params.pollId);
    if (!ranking) {
      res.status(404).json({ error: "Vote introuvable." });
      return;
    }
    res.json(ranking);
  } catch (error) {
    next(error);
  }
});

app.get("/api/polls/:pollId/history", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    res.json(await store.getHistory(req.params.pollId, limit));
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ error: error.message || "Erreur serveur." });
});

async function start() {
  await store.connect();
  app.listen(port, () => {
    console.log(`WC3 Fan Votes lance sur http://localhost:${port}`);
    console.log(`Mode stockage: ${store.mode}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await store.disconnect();
  process.exit(0);
});
