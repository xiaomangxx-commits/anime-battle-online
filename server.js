const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const TOTAL_ROUNDS = 10;
const WIN_SCORE = 20;
const START_SCORE = 1;
const ROUND_SECONDS = 13;
const NEXT_ROUND_DELAY = 1300;
const publicDir = __dirname;
const rooms = new Map();
const streams = new Map();
const imageCache = new Map();

const characters = [
  ["漩涡鸣人", "Naruto Uzumaki", "金黄色头发，性格热血不服输。", "外号和九尾有关，口头禅很有名。"],
  ["宇智波佐助", "Sasuke Uchiha", "黑发冷酷，背负家族仇恨。", "写轮眼使用者，鸣人的重要对手。"],
  ["春野樱", "Sakura Haruno", "粉色短发，性格直率坚强。", "怪力和医疗忍术很强。"],
  ["旗木卡卡西", "Kakashi Hatake", "银白头发，常遮住一只眼。", "外号复制忍者，喜欢看亲热天堂。"],
  ["蒙奇D路飞", "Monkey D. Luffy", "黑发草帽，性格乐观莽撞。", "身体像橡胶，目标是海贼王。"],
  ["罗罗诺亚索隆", "Roronoa Zoro", "绿色头发，方向感很差。", "三刀流剑士，草帽团战斗员。"],
  ["娜美", "Nami", "橙色头发，聪明会航海。", "喜欢钱，武器常和天气有关。"],
  ["山治", "Sanji", "金发西装，性格绅士。", "用腿战斗，是草帽团厨师。"],
  ["灶门炭治郎", "Tanjiro Kamado", "深红色头发，温柔又认真。", "额头有疤，嗅觉特别灵。"],
  ["灶门祢豆子", "Nezuko Kamado", "黑色长发，眼睛偏粉色。", "嘴里常咬竹筒，是主角妹妹。"],
  ["我妻善逸", "Zenitsu Agatsuma", "黄色头发，平时胆小爱哭。", "睡着后会变强，招式和雷有关。"],
  ["嘴平伊之助", "Inosuke Hashibira", "性格冲动好战，行动很野。", "常戴野猪头套，拿两把刀。"],
  ["五条悟", "Satoru Gojo", "白发，常戴眼罩或墨镜。", "外号最强，术式和无下限有关。"],
  ["虎杖悠仁", "Yuuji Itadori", "粉色短发，性格阳光。", "体内寄宿着两面宿傩。"],
  ["伏黑惠", "Megumi Fushiguro", "黑色刺猬头，性格冷静。", "会用影子召唤式神。"],
  ["钉崎野蔷薇", "Nobara Kugisaki", "橙色短发，自信强势。", "武器是锤子和钉子。"],
  ["江户川柯南", "Conan Edogawa", "小学生外表，头脑超强。", "真实身份是高中生侦探。"],
  ["工藤新一", "Shinichi Kudo", "高中生侦探，推理能力强。", "因为药物身体变小。"],
  ["毛利兰", "Ran Mouri", "黑长发，性格温柔勇敢。", "空手道很强，等待新一回来。"],
  ["怪盗基德", "Kaitou Kid", "白色礼服和披风。", "擅长魔术，经常预告盗宝。"],
  ["孙悟空", "Son Goku", "黑色刺发，性格单纯好战。", "赛亚人，代表招式是龟派气功。"],
  ["贝吉塔", "Vegeta", "黑色尖发，骄傲自尊心强。", "赛亚人王子，悟空的劲敌。"],
  ["布尔玛", "Bulma", "蓝色头发，聪明又有钱。", "发明能力强，和龙珠冒险关系很深。"],
  ["弗利萨", "Frieza", "紫白配色，性格残忍。", "宇宙帝王，是赛亚人的大敌。"],
  ["黑崎一护", "Ichigo Kurosaki", "橙色头发，保护欲强。", "能看见灵，使用斩魄刀战斗。"],
  ["朽木露琪亚", "Rukia Kuchiki", "黑发小个子，性格认真。", "死神，斩魄刀和冰雪有关。"],
  ["日番谷冬狮郎", "Toushirou Hitsugaya", "白发少年，性格冷静。", "冰雪系队长，斩魄刀很有名。"],
  ["蓝染惣右介", "Sousuke Aizen", "外表温和，实际很会布局。", "镜花水月的主人。"],
  ["艾伦耶格尔", "Eren Yeager", "棕发绿眼，性格执着。", "能变成巨人，想追求自由。"],
  ["三笠阿克曼", "Mikasa Ackerman", "黑发围红围巾，战斗力强。", "总是保护艾伦。"],
  ["利威尔", "Levi Ackerman", "黑发矮个，洁癖又强大。", "调查兵团最强士兵。"],
  ["阿尔敏", "Armin Arlert", "金发，善于思考。", "不靠蛮力，常用策略破局。"],
  ["夜神月", "Light Yagami", "棕发学霸，表面优秀。", "捡到死亡笔记，代号基拉。"],
  ["L", "L Lawliet", "黑发黑眼圈，坐姿特别。", "天才侦探，爱吃甜食。"],
  ["弥海砂", "Misa Amane", "金发偶像，性格执着。", "第二个基拉，拥有死神之眼。"],
  ["琦玉", "Saitama", "光头，表情常很淡定。", "一拳就能解决大多数敌人。"],
  ["杰诺斯", "Genos", "金发改造人，性格认真。", "把光头英雄当老师。"],
  ["龙卷", "Tatsumaki", "绿色卷发，脾气很冲。", "会超能力，身材娇小但实力强。"],
  ["影山茂夫", "Shigeo Kageyama", "黑色锅盖头，性格老实。", "外号龙套，情绪到 100 会爆发。"],
  ["灵幻新隆", "Reigen Arataka", "黄褐发，嘴上功夫很强。", "自称灵能力者，是龙套的师父。"],
  ["爱德华艾尔利克", "Edward Elric", "金发矮个，性格急躁。", "钢之炼金术师，机械铠手脚。"],
  ["阿尔冯斯艾尔利克", "Alphonse Elric", "灵魂附在铠甲里。", "外表巨大，内心很温柔。"],
  ["初号机驾驶员碇真嗣", "Shinji Ikari", "棕发少年，性格敏感纠结。", "驾驶 EVA 初号机。"],
  ["绫波丽", "Rei Ayanami", "蓝色短发，性格安静。", "EVA 驾驶员，红色眼睛。"],
  ["明日香", "Asuka Langley Soryu", "红棕长发，性格骄傲。", "EVA 二号机驾驶员。"],
  ["阿尼亚", "Anya Forger", "粉色头发，表情很多。", "能读心，最喜欢花生。"],
  ["劳埃德", "Loid Forger", "金发，冷静帅气。", "代号黄昏，是间谍爸爸。"],
  ["约尔", "Yor Forger", "黑长发，性格温柔。", "真实身份是杀手，外号荆棘公主。"],
  ["芙莉莲", "Frieren", "银白长发，精灵法师。", "活了很久，对时间感很特别。"],
  ["费伦", "Fern", "紫色长发，性格稳重。", "芙莉莲的徒弟，吐槽很犀利。"],
  ["修塔尔克", "Stark", "红发战士，胆小但可靠。", "用斧头战斗，关键时刻很勇敢。"],
  ["坂田银时", "Gintoki Sakata", "银发天然卷，懒散爱甜食。", "拿木刀的万事屋老板。"],
  ["志村新八", "Shinpachi Shimura", "戴眼镜，吐槽担当。", "万事屋成员，姐姐很强。"],
  ["神乐", "Kagura Gintama", "橙红头发，力气很大。", "夜兔族少女，常拿伞。"],
  ["鲁路修", "Lelouch Lamperouge", "黑发紫眼，头脑很强。", "拥有 Geass，身份是 Zero。"],
  ["C.C.", "C.C. Code Geass", "绿色长发，神秘不老。", "喜欢披萨，和 Geass 有关。"],
  ["桐谷和人", "Kirito", "黑衣黑剑，游戏技术强。", "外号黑衣剑士。"],
  ["亚丝娜", "Asuna Yuuki", "栗色长发，剑术很快。", "闪光称号，和桐人关系很深。"],
  ["菜月昴", "Subaru Natsuki", "黑发少年，性格吵闹但执着。", "拥有死亡回归。"],
  ["爱蜜莉雅", "Emilia Re Zero", "银发半精灵，性格善良。", "身边有一只叫帕克的精灵。"],
  ["雷姆", "Rem Re Zero", "蓝色短发，女仆装。", "使用流星锤，名台词很出圈。"],
  ["利姆鲁", "Rimuru Tempest", "蓝色史莱姆，性格温和。", "转生后成为魔物之王。"],
  ["阿库娅", "Aqua Konosuba", "蓝发女神，性格很闹。", "能力强但常常不靠谱。"],
  ["惠惠", "Megumin", "黑发红眼，中二气质。", "只爱爆裂魔法。"],
  ["和真", "Kazuma Satou", "普通少年，吐槽很多。", "异世界队伍里最现实的人。"],
  ["丹次", "Denji Chainsaw Man", "金发，生活目标很简单。", "能变成电锯人。"],
  ["帕瓦", "Power Chainsaw Man", "金发，有角，性格嚣张。", "血之魔人，喜欢猫。"],
  ["玛奇玛", "Makima", "红发辫子，气质温柔危险。", "支配力很强，眼神很有压迫感。"],
  ["早川秋", "Aki Hayakawa", "黑发扎小辫，性格严肃。", "公安恶魔猎人，和狐狸恶魔有契约。"],
  ["绿谷出久", "Izuku Midoriya", "绿色卷发，性格努力善良。", "外号小久，继承 One For All。"],
  ["爆豪胜己", "Katsuki Bakugou", "金色刺发，脾气暴躁。", "个性是爆破。"],
  ["轰焦冻", "Shouto Todoroki", "半红半白头发。", "一边冰一边火，家庭背景复杂。"],
  ["欧尔麦特", "All Might", "金发肌肉英雄，笑容夸张。", "和平的象征。"],
  ["影山飞雄", "Tobio Kageyama", "黑发，性格认真强势。", "排球二传手，外号球场上的王者。"],
  ["日向翔阳", "Shouyou Hinata", "橙色头发，弹跳力强。", "小个子副攻，梦想成为小巨人。"],
  ["孤爪研磨", "Kenma Kozume", "金黑发，性格安静。", "喜欢游戏，排球大脑很强。"],
  ["赤司征十郎", "Seijuurou Akashi", "红发，气场很强。", "奇迹世代队长，眼睛能力有名。"],
  ["黑子哲也", "Tetsuya Kuroko", "浅蓝头发，存在感很低。", "擅长传球，是幻之第六人。"],
  ["黄濑凉太", "Ryouta Kise", "金发模特，学习能力强。", "能模仿别人球技。"],
  ["御坂美琴", "Mikoto Misaka", "茶色短发，性格爽朗。", "外号电击公主，硬币超电磁炮。"],
  ["上条当麻", "Touma Kamijou", "黑发刺猬头，常说不幸。", "右手能消除异能。"],
  ["一方通行", "Accelerator Toaru", "白发红眼，能力极强。", "能控制向量。"],
  ["凉宫春日", "Haruhi Suzumiya", "棕发，活力过剩。", "成立 SOS 团，讨厌普通日常。"],
  ["长门有希", "Yuki Nagato", "紫色短发，沉默寡言。", "像无口少女，其实不是普通人。"],
  ["泉此方", "Konata Izumi", "蓝色长发，宅气很重。", "喜欢游戏和动漫，个子小。"],
  ["鹿目圆", "Madoka Kaname", "粉色双马尾，性格善良。", "魔法少女故事的核心人物。"],
  ["晓美焰", "Homura Akemi", "黑长发，性格冷静。", "时间能力和圆有关。"],
  ["巴麻美", "Mami Tomoe", "金色卷发，成熟优雅。", "使用缎带和火枪。"],
  ["木之本樱", "Sakura Kinomoto", "棕色短发，可爱活泼。", "收集库洛牌的魔法少女。"],
  ["大道寺知世", "Tomoyo Daidouji", "黑长发，温柔优雅。", "喜欢给小樱做衣服和拍摄。"],
  ["水冰月", "Usagi Tsukino", "金发双丸子头。", "代表月亮惩罚你。"],
  ["地场卫", "Mamoru Chiba", "黑发帅气，常穿礼服。", "化身夜礼服假面。"],
  ["哆啦A梦", "Doraemon", "蓝色身体，性格善良。", "有四次元口袋，害怕老鼠。"],
  ["野比大雄", "Nobita Nobi", "戴眼镜，性格善良但懒。", "经常需要未来道具帮忙。"],
  ["皮卡丘", "Pikachu", "黄色身体，红色脸颊。", "会放电，叫声非常有名。"],
  ["小智", "Ash Ketchum", "戴帽子，热血少年。", "目标是宝可梦大师。"],
  ["灰原哀", "Ai Haibara", "茶色短发，性格冷静。", "真实身份和黑衣组织有关。"],
  ["杀生丸", "Sesshoumaru", "银白长发，气质冷傲。", "犬夜叉的哥哥，妖力强大。"],
  ["犬夜叉", "Inuyasha", "银白长发，犬耳明显。", "半妖，武器是铁碎牙。"],
  ["桔梗", "Kikyou Inuyasha", "黑长发巫女，气质清冷。", "和犬夜叉过去关系很深。"],
].map(([name, query, hint1, hint2]) => ({ name, query, hints: [hint1, hint2] }));

const decoys = characters.map((character) => character.name);

function createRoom(code) {
  return {
    code,
    status: "lobby",
    playerClients: { A: null, B: null },
    players: { A: false, B: false },
    scores: { A: START_SCORE, B: START_SCORE },
    choices: { A: null, B: null },
    selectedAnswer: null,
    buzzer: null,
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
    selectedAnswer: room.selectedAnswer,
    buzzer: room.buzzer,
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

async function startGame(room, resetScores = false) {
  if (!(room.players.A && room.players.B)) {
    room.log = "👥 需要玩家 A 和玩家 B 都进入房间。";
    broadcast(room);
    return;
  }
  clearRoomTimers(room);
  room.status = "playing";
  room.scores = resetScores ? { A: START_SCORE, B: START_SCORE } : room.scores;
  room.choices = { A: null, B: null };
  room.selectedAnswer = null;
  room.buzzer = null;
  room.round = resetScores ? 1 : room.round + 1;
  room.used = resetScores ? [] : room.used;
  room.winner = null;
  room.current = await makeRound(room);
  room.used.push(room.current.characterIndex);
  room.roundStartedAt = Date.now();
  room.roundEndsAt = room.roundStartedAt + ROUND_SECONDS * 1000;
  room.log = `⚡ 第 ${room.round} 题开始，快抢！`;
  room.roundTimer = setTimeout(() => finishRoundByTimeout(room), ROUND_SECONDS * 1000);
  broadcast(room);
}

async function makeRound(room) {
  if (room.used.length >= characters.length) room.used = [];
  const available = characters
    .map((_, index) => index)
    .filter((index) => !room.used.includes(index));
  const pickedIndex = available[Math.floor(Math.random() * available.length)];
  const answer = characters[pickedIndex];
  const wrong = shuffle(decoys.filter((name) => name !== answer.name)).slice(0, 2);
  return {
    characterIndex: pickedIndex,
    answer: answer.name,
    image: await findCharacterImage(answer),
    hints: answer.hints,
    options: shuffle([answer.name, ...wrong]),
  };
}

async function findCharacterImage(character) {
  if (imageCache.has(character.query)) return imageCache.get(character.query);
  const fallback = `https://placehold.co/500x700/20212b/ffffff?text=${encodeURIComponent(character.name)}`;
  try {
    const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(character.query)}&limit=1`;
    const response = await fetch(url, { headers: { "User-Agent": "anime-battle-online" } });
    const json = await response.json();
    const image = json?.data?.[0]?.images?.jpg?.image_url || fallback;
    imageCache.set(character.query, image);
    return image;
  } catch {
    imageCache.set(character.query, fallback);
    return fallback;
  }
}

function pickOption(room, playerId, name) {
  if (room.status !== "playing" || !["A", "B"].includes(playerId)) return;
  if (room.buzzer) return;

  const right = name === room.current.answer;
  room.buzzer = playerId;
  room.selectedAnswer = name;
  room.choices[playerId] = name;
  room.scores[playerId] = Math.max(0, room.scores[playerId] + (right ? 2 : -1));
  room.log = right
    ? `🚨 玩家 ${playerId} 抢答成功，答对 +2！`
    : `💥 玩家 ${playerId} 抢答失败，答错 -1。`;

  if (room.scores[playerId] >= WIN_SCORE) {
    room.winner = playerId;
    room.status = "ended";
    room.log = `🏆 玩家 ${playerId} 达到 ${WIN_SCORE} 分，获胜！`;
    clearRoomTimers(room);
  } else {
    finishRound(room, room.log);
  }
  broadcast(room);
}

function finishRoundByTimeout(room) {
  if (room.status !== "playing") return;
  room.scores.A = Math.max(0, room.scores.A - 1);
  room.scores.B = Math.max(0, room.scores.B - 1);
  finishRound(room, "⏰ 时间到，双方无人抢答，各 -1 分。");
  broadcast(room);
}

function finishRound(room, log) {
  clearTimeout(room.roundTimer);
  room.roundTimer = null;
  room.status = "between";
  room.log = log;
  room.nextRoundTimer = setTimeout(() => beginNextRound(room), NEXT_ROUND_DELAY);
}

async function beginNextRound(room) {
  room.nextRoundTimer = null;
  if (room.winner || room.round >= TOTAL_ROUNDS) {
    endGame(room);
    broadcast(room);
    return;
  }
  await startGame(room, false);
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
    if (body.action === "start") await startGame(room, room.status === "lobby" || room.status === "ended");
    if (body.action === "reset") await startGame(room, true);
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
