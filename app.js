const TOTAL_ROUNDS = 12;
const WIN_SCORE = 20;
const START_SCORE = 1;
const ROUND_SECONDS = 13;
const FIRST_HINT_AT = 4;
const SECOND_HINT_AT = 8;

const roomInput = document.querySelector("#roomCode");
const createRoomButton = document.querySelector("#createRoom");
const joinRoomButton = document.querySelector("#joinRoom");
const startButton = document.querySelector("#startGame");
const resetButton = document.querySelector("#resetGame");
const musicToggle = document.querySelector("#musicToggle");
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
const preloadedImages = new Set();
let musicOn = false;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let activeTrackId = -1;

const musicPalettes = [
  [196, 247, 294, 330, 392, 330, 294, 247],
  [220, 277, 330, 370, 440, 370, 330, 277],
  [165, 220, 247, 330, 392, 330, 247, 220],
  [247, 294, 349, 392, 494, 392, 349, 294],
  [185, 233, 277, 311, 370, 311, 277, 233],
  [208, 262, 311, 349, 415, 349, 311, 262],
];

const clientId =
  sessionStorage.getItem("anime-battle-client-id") || crypto.randomUUID();
sessionStorage.setItem("anime-battle-client-id", clientId);

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
  if (state.buzzer) return;
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
    const wantedSrc = state.current.image || placeholderUrl(state.current.answer || "角色图片");
    if (portrait.dataset.src !== wantedSrc) {
      portrait.dataset.src = wantedSrc;
      portrait.src = wantedSrc;
    }
    portrait.alt = `第 ${state.round} 题角色图片`;
    portrait.classList.add("show");
    emptyState.classList.add("hidden");
  } else {
    portrait.removeAttribute("src");
    portrait.classList.remove("show");
    emptyState.classList.remove("hidden");
    emptyState.querySelector("strong").textContent = "输入或生成房间号";
    emptyState.querySelector("span").textContent =
      "两个人进入同一个房间后，开始抢答。";
  }

  renderOptions();
  renderHints();
  preloadImages(state.preloadImages || []);
  syncMusic();
  setMessage(state.log);
}

function preloadImages(urls) {
  for (const url of urls) {
    if (!url || preloadedImages.has(url)) continue;
    preloadedImages.add(url);
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.src = url;
  }
}

function placeholderUrl(name) {
  return `/api/placeholder?name=${encodeURIComponent(name || "角色图片")}`;
}

function renderHints() {
  if (!state?.current || state.status !== "playing") {
    hintsNode.replaceChildren(makeHintLine("💡 提示会在第 4 秒和第 8 秒出现"));
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
  if (state.buzzer === id) return "已抢答";
  if (state.status === "playing") return "等待抢答";
  return "本题未抢";
}

function renderOptions() {
  optionsNode.replaceChildren();
  const options = state.current?.options ?? [];
  for (const name of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.textContent = name;
    button.disabled = state.status !== "playing" || Boolean(state.buzzer) || playerId === "观战";
    if (state.selectedAnswer === name) button.classList.add("selected");
    if (state.status !== "playing" && state.current?.answer) {
      if (name === state.current.answer) button.classList.add("correct");
      if (state.selectedAnswer === name && name !== state.current.answer) {
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
musicToggle.addEventListener("click", () => {
  musicOn = !musicOn;
  musicToggle.textContent = `音乐：${musicOn ? "开" : "关"}`;
  if (musicOn) startMusic();
  else stopMusic();
});
portrait.addEventListener("error", () => {
  const fallback = placeholderUrl(state?.current?.answer || "角色图片");
  if (portrait.src.endsWith(fallback)) return;
  portrait.dataset.src = fallback;
  portrait.src = fallback;
  portrait.classList.add("show");
  emptyState.classList.add("hidden");
  setMessage("🖼️ 网络图没加载出来，已自动换成本地备用图。");
});

setInterval(() => {
  if (!state) return;
  if (state.status === "playing") {
    timerNode.textContent = `${Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000))} 秒`;
  }
  renderHints();
}, 250);

function syncMusic() {
  const trackId = state?.musicTrack?.id ?? 0;
  if (trackId !== activeTrackId) {
    activeTrackId = trackId;
    if (musicOn) startMusic();
  }
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function startMusic() {
  stopMusic();
  ensureAudio();
  musicStep = 0;
  const trackId = state?.musicTrack?.id ?? 0;
  const palette = musicPalettes[trackId % musicPalettes.length];
  const tempo = 138 + (trackId % 8) * 7;
  const interval = Math.max(115, Math.round(60000 / tempo / 2));
  musicTimer = setInterval(() => {
    if (!audioContext || !musicOn) return;
    const now = audioContext.currentTime;
    const note = palette[(musicStep + Math.floor(trackId / 3)) % palette.length];
    const bass = note / (musicStep % 4 === 0 ? 4 : 2);
    playTone(note, now, 0.11, musicStep % 3 === 0 ? "square" : "triangle", 0.025);
    if (musicStep % 2 === 0) playTone(bass, now, 0.16, "sawtooth", 0.018);
    if (musicStep % 8 === 0) playNoise(now, 0.04, 0.03);
    musicStep += 1;
  }, interval);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function playTone(freq, start, duration, type, volume) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playNoise(start, duration, volume) {
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * 0.35;
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(start);
}
