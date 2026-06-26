const page = document.body.dataset.page;
const state = {
  polls: [],
  selectedPollId: null,
  selectedChoiceId: null
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Erreur API");
  }
  return body;
}

function renderTrendList(container, rows) {
  if (!container) return;
  container.innerHTML = "";
  if (!rows || rows.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucune tendance.</p>`;
    return;
  }

  const maxVotes = Math.max(...rows.map((item) => item.votes), 1);
  rows.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <span class="rank-number">${index + 1}</span>
      <span class="rank-label">
        <strong>${item.label}</strong>
        <span class="bar"><span style="width: ${(item.votes / maxVotes) * 100}%"></span></span>
      </span>
      <span class="votes">${item.votes}</span>
    `;
    container.appendChild(row);
  });
}

async function loadDashboard() {
  const dashboard = await api("/api/dashboard");
  renderTrendList($("#team-trends"), dashboard.teams);
  renderTrendList($("#player-trends"), dashboard.players);
  renderTrendList($("#match-trends"), dashboard.matches);
  return dashboard;
}

async function initHome() {
  const [health, polls, dashboard] = await Promise.all([
    api("/api/health"),
    api("/api/polls"),
    loadDashboard()
  ]);
  $("#storage-mode").textContent = health.storageMode;
  $("#open-polls-count").textContent = String(polls.length);
  const hero = $("#hero-trends");
  hero.innerHTML = dashboard.teams.slice(0, 3).map((item) => `
    <div>
      <span>${item.label}</span>
      <strong>${item.votes}</strong>
    </div>
  `).join("");
}

async function loadPolls() {
  state.polls = await api("/api/polls");
  if (!state.selectedPollId && state.polls[0]) {
    state.selectedPollId = state.polls[0].pollId;
  }
  renderPolls();
  await selectPoll(state.selectedPollId);
}

function renderPolls() {
  const list = $("#poll-list");
  list.innerHTML = "";
  state.polls.forEach((poll) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `poll-button${poll.pollId === state.selectedPollId ? " active" : ""}`;
    button.innerHTML = `<strong>${poll.match}</strong><span>${poll.question}</span>`;
    button.addEventListener("click", () => selectPoll(poll.pollId));
    list.appendChild(button);
  });
}

async function selectPoll(pollId) {
  if (!pollId) return;
  state.selectedPollId = pollId;
  state.selectedChoiceId = null;
  const poll = await api(`/api/polls/${pollId}`);
  renderActivePoll(poll);
  await refreshVoteData();
}

function renderActivePoll(poll) {
  $("#competition").textContent = poll.competition;
  $("#match-title").textContent = poll.match;
  $("#poll-status").textContent = poll.status;
  $("#poll-question").textContent = poll.question;
  const choices = $("#choices");
  choices.innerHTML = "";

  poll.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.innerHTML = `<strong>${choice.label}</strong><span>${choice.team}</span>`;
    button.addEventListener("click", () => {
      state.selectedChoiceId = choice.choiceId;
      document.querySelectorAll(".choice-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
    choices.appendChild(button);
  });

  renderPolls();
}

async function refreshVoteData() {
  const [ranking, history] = await Promise.all([
    api(`/api/polls/${state.selectedPollId}/ranking`),
    api(`/api/polls/${state.selectedPollId}/history?limit=10`)
  ]);
  renderTrendList($("#ranking"), ranking);
  renderHistory(history, ranking);
}

function renderHistory(history, ranking) {
  const container = $("#history");
  const labels = new Map(ranking.map((item) => [item.choiceId, item.label]));
  container.innerHTML = "";
  history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <strong>${entry.userId} -> ${labels.get(entry.choiceId) || entry.choiceId}</strong>
      <time>${new Date(entry.createdAt).toLocaleString("fr-FR")}</time>
    `;
    container.appendChild(item);
  });
}

function choiceSlug(label) {
  return label.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function bindVoteForms() {
  $("#vote-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedChoiceId) {
      $("#form-message").textContent = "Selectionne un choix avant de voter.";
      return;
    }

    try {
      await api(`/api/polls/${state.selectedPollId}/vote`, {
        method: "POST",
        body: JSON.stringify({
          userId: $("#user-id").value.trim() || "user_demo",
          choiceId: state.selectedChoiceId
        })
      });
      $("#form-message").textContent = "Vote enregistre.";
      await refreshVoteData();
    } catch (error) {
      $("#form-message").textContent = error.message;
    }
  });

  $("#option-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = $("#option-label").value.trim();
    const team = $("#option-team").value.trim();
    if (!label) {
      $("#option-message").textContent = "Indique un libelle a ajouter.";
      return;
    }

    try {
      const poll = await api(`/api/polls/${state.selectedPollId}/options`, {
        method: "POST",
        body: JSON.stringify({ choiceId: choiceSlug(label), label, team: team || label })
      });
      $("#option-message").textContent = "Choix ajoute.";
      $("#option-label").value = "";
      $("#option-team").value = "";
      renderActivePoll(poll);
      await refreshVoteData();
    } catch (error) {
      $("#option-message").textContent = error.message;
    }
  });

  $("#seed-button").addEventListener("click", async () => {
    await api("/api/seed", { method: "POST", body: "{}" });
    state.selectedPollId = null;
    await loadPolls();
  });
}

async function initData() {
  const health = await api("/api/health");
  $("#health-json").textContent = JSON.stringify(health, null, 2);
}

async function boot() {
  if (page === "home") await initHome();
  if (page === "votes") {
    bindVoteForms();
    await loadPolls();
    setInterval(refreshVoteData, 5000);
  }
  if (page === "trends") {
    await loadDashboard();
    setInterval(loadDashboard, 5000);
  }
  if (page === "data") await initData();
}

boot().catch((error) => {
  document.body.insertAdjacentHTML("beforeend", `<div class="toast">${error.message}</div>`);
});
