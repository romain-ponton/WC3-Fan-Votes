const seedPolls = [
  {
    pollId: "vote_001",
    matchId: "match_001",
    match: "France - Bresil",
    competition: "Coupe du Monde",
    question: "Homme du match : France - Bresil",
    category: "man_of_the_match",
    voteType: "player_of_the_match",
    status: "closed",
    startsAt: "2026-06-10T18:00:00+02:00",
    choices: [
      { choiceId: "player_fra_04", label: "Hugo Bernard", team: "France" },
      { choiceId: "player_fra_03", label: "Nolan Lefevre", team: "France" },
      { choiceId: "player_bra_04", label: "Lucas Andrade", team: "Bresil" }
    ]
  },
  {
    pollId: "vote_002",
    matchId: "match_003",
    match: "France - Japon",
    competition: "Coupe du Monde",
    question: "Qui va marquer le prochain but ?",
    category: "player",
    voteType: "next_goal_scorer",
    status: "open",
    startsAt: "2026-06-15T18:00:00+02:00",
    choices: [
      { choiceId: "player_fra_04", label: "Hugo Bernard", team: "France" },
      { choiceId: "player_jpn_04", label: "Yuto Mori", team: "Japon" },
      { choiceId: "player_jpn_03", label: "Kaito Nakamura", team: "Japon" }
    ]
  },
  {
    pollId: "vote_003",
    matchId: "match_008",
    match: "Maroc - Allemagne",
    competition: "Coupe du Monde",
    question: "Equipe surprise du groupe B",
    category: "team",
    voteType: "team_vote",
    status: "open",
    startsAt: "2026-06-12T21:00:00+02:00",
    choices: [
      { choiceId: "team_mar", label: "Maroc", team: "Afrique" },
      { choiceId: "team_ger", label: "Allemagne", team: "Europe" },
      { choiceId: "team_arg", label: "Argentine", team: "Amerique du Sud" },
      { choiceId: "team_esp", label: "Espagne", team: "Europe" }
    ]
  }
];

const seedVotes = [
  {
    voteEventId: "vote_evt_001",
    pollId: "vote_001",
    userId: "supporter_001",
    choiceId: "player_fra_03",
    device: "mobile",
    createdAt: "2026-06-10T20:01:10+02:00"
  },
  {
    voteEventId: "vote_evt_002",
    pollId: "vote_001",
    userId: "supporter_002",
    choiceId: "player_bra_04",
    device: "desktop",
    createdAt: "2026-06-10T20:01:24+02:00"
  },
  {
    voteEventId: "vote_evt_003",
    pollId: "vote_001",
    userId: "supporter_003",
    choiceId: "player_fra_04",
    device: "mobile",
    createdAt: "2026-06-10T20:02:35+02:00"
  },
  {
    voteEventId: "vote_evt_004",
    pollId: "vote_002",
    userId: "supporter_001",
    choiceId: "player_fra_04",
    device: "mobile",
    createdAt: "2026-06-15T18:32:12+02:00"
  },
  {
    voteEventId: "vote_evt_005",
    pollId: "vote_002",
    userId: "supporter_003",
    choiceId: "player_jpn_03",
    device: "mobile",
    createdAt: "2026-06-15T18:33:18+02:00"
  },
  {
    voteEventId: "vote_evt_006",
    pollId: "vote_003",
    userId: "supporter_004",
    choiceId: "team_mar",
    device: "desktop",
    createdAt: "2026-06-12T23:10:41+02:00"
  },
  {
    voteEventId: "vote_evt_007",
    pollId: "vote_003",
    userId: "supporter_007",
    choiceId: "team_ger",
    device: "mobile",
    createdAt: "2026-06-12T23:12:59+02:00"
  },
  {
    voteEventId: "vote_evt_008",
    pollId: "vote_003",
    userId: "supporter_005",
    choiceId: "team_arg",
    device: "mobile",
    createdAt: "2026-06-12T23:14:03+02:00"
  }
];

const sourceDataset = {
  title: "Dataset pedagogique Coupe du Monde - Evaluation NoSQL",
  generatedAt: "2026-06-26",
  teams: 8,
  players: 40,
  matches: 12,
  supporters: 8,
  fanVotes: seedPolls.length,
  voteEvents: seedVotes.length
};

module.exports = { seedPolls, seedVotes, sourceDataset };
