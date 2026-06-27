const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const TOTAL_ROUNDS = 10;
const WIN_SCORE = 8;
const START_SCORE = 1;
const ROUND_SECONDS = 18;
const NEXT_ROUND_DELAY = 1300;

const publicDir = __dirname;
const rooms = new Map();
const streams = new Map();

const characters = [
  {
    name: "灶门炭治郎",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_01.jpg",
    hints: ["头发是深红色，性格认真又温柔。", "额头有明显伤疤，嗅觉特别灵。"],
  },
  {
    name: "灶门祢豆子",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_02.jpg",
    hints: ["黑色长发，眼睛偏粉色。", "嘴里常咬着竹筒，是主角的妹妹。"],
  },
  {
    name: "我妻善逸",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_03.jpg",
    hints: ["黄色头发，平时很胆小爱哭。", "昏睡后会变强，招式和雷有关。"],
  },
  {
    name: "嘴平伊之助",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_04.jpg",
    hints: ["性格冲动好战，行动很野。", "常戴野猪头套，拿两把刀。"],
  },
  {
    name: "富冈义勇",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_05.jpg",
    hints: ["黑发蓝眼，性格冷静少话。", "外号和水有关，是鬼杀队的柱。"],
  },
  {
    name: "真菰",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_07.jpg",
    hints: ["短黑发，语气温柔安静。", "戴花纹狐狸面具，曾指导过主角。"],
  },
  {
    name: "锖兔",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_08.jpg",
    hints: ["偏粉色短发，性格严厉可靠。", "戴狐狸面具，和真菰关系很深。"],
  },
  {
    name: "钢铁冢萤",
    image: "https://kimetsu.com/anime/risshihen/assets/img/character/img_chara_10.jpg",
    hints: ["常戴奇怪面具，情绪很容易激动。", "身份是刀匠，特别在意自己的刀。"],
  },
  {
    name: "皮卡丘",
    image: "https://www.pokemon.com/static-assets/content-assets/cms2/img/pokedex/full/025.png",
    hints: ["黄色身体，性格活泼。", "红脸颊会放电，叫声非常有名。"],
  },
  {
    name: "哆啦A梦",
    image: "https://dora-world.com/assets/images/hd/hd_bg_s01_chara.webp",
    hints: ["蓝色身体，性格善良但怕老鼠。", "有四次元口袋，常拿出未来道具。"],
  },
];

const decoys = [
  "孙悟空",
  "路飞",
  "漩涡鸣人",
  "江户川柯南",
  "五条悟",
  "虎杖悠仁",
  "阿尼亚",
  "野原新之助",
  "黑崎一护",
  "坂田银时",
  "初音未来",
  "喜羊羊",
  "灰太狼",
  "哪吒",
  "罗小黑",
  "涂山苏苏",
];

function createRoom(code) {
  return {
    code,
    status: "lobby",
    playerClients: { A: null, B: null },
    players: { A: false, B: false },
    scores: { A: START_SCORE, B: START_SCORE },
    choices: { A: null, B: null },
    round: 0,
    current: null,
    used: [],
    winner: null,
    roundStartedAt: 0,
    roundEndsAt: 0,
    roundTimer: null,
    nextRoundTimer: null,
    log: "🎮 房间已创建，等两位玩家就位。",
  };
}

function getRoom(code) {
  const cleanCode = code.toUpperCase();
  if (!rooms.has(cleanCode)) rooms.set(cleanCode, createRoom(cleanCode));
  return rooms.get(cleanCode);
}

function publicState(room) {
  const current = room.current
    ? {
        image: room.current.image,
        hints: room.current.hints,
        options: room.current.options,
        answer: room.status === "playing" ? null : room.current.answer,
      }
    : null;
  return {
    code: room.code,
    status: room.status,
    players: room.players,
    scores: room.scores,
    choices: room.choices,
    round: room.round,
    current,
    winner: room.winner,
    roundStartedAt: room.roundStartedAt,
    roundEndsAt: room.roundEndsAt,
    log: room.log,
  };
}

function joinRoom(room, clientId) {
  if (room.playerClients.A === clientId) return "A";
  if (room.playerClients.B === clientId) return "B";
  if (!room.playerClients.A) {
    room.playerClients.A = clientId;
    room.players.A = true;
    room.log = "🙋 玩家 A 已进入房间。";
    return "A";
  }
  if (!room.playerClients.B) {
    room.playerClients.B = clientId;
    room.players.B = true;
    room.log = "🙋 玩家 B 已进入房间。";
    return "B";
  }
  return "观战";
}

function playerIdFor(room, clientId) {
  if (room.playerClients.A === clientId) return "A";
  if (room.playerClients.B === clientId) return "B";
  return "观战";
}

function startGame(room, resetScores = false) {
  if (!(room.players.A && room.players.B)) {
    room.log = "👥 需要玩家 A 和玩家 B 都进入房间。";
    broadcast(room);
    return;
  }
  clearRoomTimers(room);
  room.status = "playing";
  room.scores = resetScores ? { A: START_SCORE, B: START_SCORE } : room.scores;
  room.choices = { A: null, B: null };
  room.round = resetScores ? 1 : room.round + 1;
  room.used = resetScores ? [] : room.used;
  room.winner = null;
  room.current = makeRound(room);
  room.used.push(room.current.characterIndex);
  room.roundStartedAt = Date.now();
  room.roundEndsAt = room.roundStartedAt + ROUND_SECONDS * 1000;
  room.log = `⚡ 第 ${room.round} 轮开始，盯紧图片！`;
  room.roundTimer = setTimeout(() => finishRoundByTimeout(room), ROUND_SECONDS * 1000);
  broadcast(room);
}

function makeRound(room) {
  const available = characters
    .map((_, index) => index)
    .filter((index) => !room.used.includes(index));
  const pickedIndex = available[Math.floor(Math.random() * available.length)];
  const answer = characters[pickedIndex];
  const wrong = shuffle(decoys.filter((name) => name !== answer.name)).slice(0, 2);
  return {
    characterIndex: pickedIndex,
    answer: answer.name,
    image: answer.image,
    hints: answer.hints,
    options: shuffle([answer.name, ...wrong]),
  };
}

function pickOption(room, playerId, name) {
  if (room.status !== "playing" || !["A", "B"].includes(playerId)) return;
  if (room.choices[playerId]) return;

  const right = name === room.current.answer;
  room.choices[playerId] = name;
  room.scores[playerId] = Math.max(0, room.scores[playerId] + (right ? 2 : -1));
  room.log = right
    ? `✅ 玩家 ${playerId} 答对 +2！`
    : `❌ 玩家 ${playerId} 答错 -1。`;

  if (room.scores[playerId] >= WIN_SCORE) {
    room.winner = playerId;
    room.status = "ended";
    room.log = `🏆 玩家 ${playerId} 达到 ${WIN_SCORE} 分，获胜！`;
    clearRoomTimers(room);
  } else if (room.choices.A && room.choices.B) {
    finishRound(room, "✨ 双方已作答，马上进入下一轮。");
  }
  broadcast(room);
}

function finishRoundByTimeout(room) {
  if (room.status !== "playing") return;
  const missed = [];
  for (const id of ["A", "B"]) {
    if (!room.choices[id]) {
      room.scores[id] = Math.max(0, room.scores[id] - 1);
      missed.push(`玩家 ${id}`);
    }
  }
  const log = missed.length
    ? `⏰ 时间到，${missed.join("、")} 未选择，各 -1 分。`
    : "⏰ 时间到，双方都已选择，本轮不额外扣分。";
  finishRound(room, log);
  broadcast(room);
}

function finishRound(room, log) {
  clearTimeout(room.roundTimer);
  room.roundTimer = null;
  room.status = "between";
  room.log = log;
  room.nextRoundTimer = setTimeout(() => beginNextRound(room), NEXT_ROUND_DELAY);
}

function beginNextRound(room) {
  room.nextRoundTimer = null;
  if (room.winner || room.round >= TOTAL_ROUNDS) {
    endGame(room);
    broadcast(room);
    return;
  }
  startGame(room, false);
}

function endGame(room) {
  clearRoomTimers(room);
  room.status = "ended";
  if (room.winner) {
    room.log = `🏆 玩家 ${room.winner} 获胜！`;
  } else if (room.scores.A === room.scores.B) {
    room.winner = "平局";
    room.log = "🤝 10 轮结束，双方平局。";
  } else {
    room.winner = room.scores.A > room.scores.B ? "A" : "B";
    room.log = `🏁 10 轮结束，玩家 ${room.winner} 分数更高，获胜！`;
  }
}

function clearRoomTimers(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.nextRoundTimer);
  room.roundTimer = null;
  room.nextRoundTimer = null;
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function broadcast(room) {
  const roomStreams = streams.get(room.code);
  if (!roomStreams) return;
  const payload = `data: ${JSON.stringify(publicState(room))}\n\n`;
  for (const response of roomStreams) response.write(payload);
}

function addStream(room, response) {
  if (!streams.has(room.code)) streams.set(room.code, new Set());
  streams.get(room.code).add(response);
  response.write(`data: ${JSON.stringify(publicState(room))}\n\n`);
  response.on("close", () => streams.get(room.code)?.delete(response));
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    response.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const eventMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/events$/i);
  const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
  const actionMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/action$/i);

  if (request.method === "GET" && eventMatch) {
    const room = getRoom(eventMatch[1]);
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    addStream(room, response);
    return;
  }

  if (request.method === "POST" && joinMatch) {
    const room = getRoom(joinMatch[1]);
    const body = await readJson(request);
    const clientId = String(body.clientId || "");
    const playerId = joinRoom(room, clientId);
    broadcast(room);
    sendJson(response, { playerId, state: publicState(room) });
    return;
  }

  if (request.method === "POST" && actionMatch) {
    const room = getRoom(actionMatch[1]);
    const body = await readJson(request);
    const playerId = playerIdFor(room, String(body.clientId || ""));
    if (playerId === "观战") {
      sendJson(response, { error: "👀 观战者不能操作。", state: publicState(room) });
      return;
    }
    if (body.action === "start") startGame(room, room.status === "lobby" || room.status === "ended");
    if (body.action === "reset") startGame(room, true);
    if (body.action === "pick") pickOption(room, playerId, String(body.name || ""));
    sendJson(response, { state: publicState(room) });
    return;
  }

  if (request.method === "GET") {
    serveFile(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Anime battle online server running on port ${PORT}`);
});
