const TOTAL_ROUNDS = 10;
const WIN_SCORE = 8;
const START_SCORE = 1;
const ROUND_SECONDS = 18;
const FIRST_HINT_AT = 8;
const SECOND_HINT_AT = 13;

const roomInput = document.querySelector("#roomCode");
const createRoomButton = document.querySelector("#createRoom");
const joinRoomButton = document.querySelector("#joinRoom");
const startButton = document.querySelector("#startGame");
const resetButton = document.querySelector("#resetGame");
const portrait = document.querySelector("#portrait");
const emptyState = document.querySelector("#emptyState");
const optionsNode = document.querySelector("#options");
const messageNode = document.querySelector("#message");
const hintsNode = document.querySelector("#hints");
const identityNode = document.querySelector("#identity");
const roundInfoNode = document.querySelector("#roundInfo");
const timerNode = document.querySelector("#timer");
const playerCards = {
  A: document.querySelector("#playerA"),
  B: document.querySelector("#playerB"),
};

let roomCode = "";
let playerId = "";
let state = null;
let events = null;
let tickTimer = null;

const clientId =
  localStorage.getItem("anime-battle-client-id") || crypto.randomUUID();
localStorage.setItem("anime-battle-client-id", clientId);

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

async function joinRoom() {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    setMessage("🔑 先输入或生成一个房间号。");
    return;
  }

  roomCode = code;
  closeEvents();
  const result = await post(`/api/rooms/${roomCode}/join`, { clientId });
  playerId = result.playerId;
  state = result.state;
  openEvents();
  render();
}

function openEvents() {
  events = new EventSource(
    `/api/rooms/${roomCode}/events?clientId=${encodeURIComponent(clientId)}`,
  );
  events.onmessage = (event) => {
    state = JSON.parse(event.data);
    render();
  };
  events.onerror = () => {
    setMessage("🌐 连接有点不稳，正在自动重连。");
  };
}

function closeEvents() {
  if (events) events.close();
  events = null;
}

async function sendAction(action, extra = {}) {
  if (!roomCode || playerId === "观战") return;
  const result = await post(`/api/rooms/${roomCode}/action`, {
    clientId,
    action,
    ...extra,
  });
  if (result.error) setMessage(result.error);
  if (result.state) {
    state = result.state;
    render();
  }
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function setMessage(text) {
  messageNode.textContent = text;
}

function pickOption(name) {
  if (!state || state.status !== "playing" || playerId === "观战") return;
  if (state.choices[playerId]) return;
  sendAction("pick", { name });
}

function render() {
  const hasState = Boolean(state);
  startButton.disabled =
    !hasState ||
    playerId === "观战" ||
    !(state.players.A && state.players.B) ||
    state.status === "playing";
  resetButton.disabled = !hasState || playerId === "观战";

  if (!hasState) return;

  identityNode.textContent = `你是：${playerId}`;
  roundInfoNode.textContent = `第 ${state.round} / ${TOTAL_ROUNDS} 轮`;
  timerNode.textContent =
    state.status === "playing"
      ? `${Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000))} 秒`
      : `${ROUND_SECONDS} 秒`;

  for (const id of ["A", "B"]) {
    const card = playerCards[id];
    card.classList.toggle("active", playerId === id);
    card.querySelector(".score").textContent = state.scores[id];
    card.querySelector(".choice").textContent = choiceText(id);
  }

  if (state.current) {
    portrait.src = state.current.image;
    portrait.alt = `第 ${state.round} 轮角色图片`;
    portrait.classList.add("show");
    emptyState.classList.add("hidden");
  } else {
    portrait.removeAttribute("src");
    portrait.classList.remove("show");
    emptyState.classList.remove("hidden");
    emptyState.querySelector("strong").textContent = "输入或生成房间号";
    emptyState.querySelector("span").textContent =
      "两个人打开这个页面，进入同一个房间后就能开始。";
  }

  renderOptions();
  renderHints();
  setMessage(state.log);
}

function renderHints() {
  if (!state?.current || state.status !== "playing") {
    hintsNode.replaceChildren(makeHintLine("💡 提示会在第 8 秒和第 13 秒出现"));
    return;
  }

  const elapsed = Math.floor((Date.now() - state.roundStartedAt) / 1000);
  const hints = [];
  if (elapsed >= FIRST_HINT_AT) hints.push(`💡 提示 1：${state.current.hints[0]}`);
  if (elapsed >= SECOND_HINT_AT) hints.push(`🔎 提示 2：${state.current.hints[1]}`);

  if (!hints.length) {
    const nextAt = FIRST_HINT_AT - elapsed;
    hints.push(`💡 ${Math.max(1, nextAt)} 秒后出现第一条提示`);
  }

  hintsNode.replaceChildren(...hints.map(makeHintLine));
}

function makeHintLine(text) {
  const line = document.createElement("span");
  line.textContent = text;
  return line;
}

function choiceText(id) {
  if (!state.players[id]) return "等待加入";
  if (state.status === "lobby") return "已进入";
  if (!state.choices[id]) return state.status === "playing" ? "未选择" : "本轮未选";
  return "已选择";
}

function renderOptions() {
  optionsNode.replaceChildren();
  const options = state.current?.options ?? [];
  for (const name of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.textContent = name;
    button.disabled = state.status !== "playing" || playerId === "观战";
    if (state.choices[playerId] === name) button.classList.add("selected");
    if (state.status !== "playing" && state.current?.answer) {
      if (name === state.current.answer) button.classList.add("correct");
      if (state.choices[playerId] === name && name !== state.current.answer) {
        button.classList.add("wrong");
      }
    }
    button.addEventListener("click", () => pickOption(name));
    optionsNode.append(button);
  }
}

createRoomButton.addEventListener("click", () => {
  roomInput.value = randomRoomCode();
  joinRoom();
});

joinRoomButton.addEventListener("click", joinRoom);
roomInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});
startButton.addEventListener("click", () => sendAction("start"));
resetButton.addEventListener("click", () => sendAction("reset"));
portrait.addEventListener("error", () => {
  portrait.classList.remove("show");
  emptyState.classList.remove("hidden");
  emptyState.querySelector("strong").textContent = "图片加载失败";
  emptyState.querySelector("span").textContent = "这张网络图可能被拦截了，刷新或重开一局试试。";
  setMessage("🖼️ 图片加载失败了，这张外链可能暂时不能访问。");
});

tickTimer = setInterval(() => {
  if (!state) return;
  if (state.status === "playing") {
    timerNode.textContent = `${Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000))} 秒`;
  }
  renderHints();
}, 250);
