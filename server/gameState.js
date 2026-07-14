/**
 * 游戏状态管理 — 核心模块
 * 管理所有游戏实例的全局状态
 */

const { v4: uuidv4 } = require('uuid');
const script = require('./data/script');

// 存储所有游戏实例
const games = new Map();

/**
 * 创建新游戏
 * @param {string} hostId - 主持人ID
 * @param {number} playerCount - 玩家数量
 * @returns {object} 创建的游戏对象
 */
function createGame(hostId, playerCount) {
  const gameId = uuidv4().slice(0, 8); // 使用短ID便于分享
  const game = {
    id: gameId,
    phase: 'lobby', // lobby | search | discuss | vote | result
    players: [],
    hostId,
    playerCount,
    clues: {
      collected: [],    // { playerId, clueId, timestamp }
      destroyed: []     // { playerId, clueId, timestamp }
    },
    chatMessages: {
      public: [],       // { id, playerId, playerName, content, timestamp }
      private: {}       // { [playerId]: { [targetId]: [{ id, fromId, fromName, toId, toName, content, timestamp }] } }
    },
    votes: [],          // [{ voterId, targetId, timestamp }]
    outcome: null,
    scareEventsTriggered: [], // [eventId, ...]
    hiddenCluesGranted: [],   // [{ playerId, clueId, timestamp }]
    createdAt: new Date().toISOString()
  };

  games.set(gameId, game);
  return game;
}

/**
 * 玩家加入游戏
 * @param {string} gameId - 游戏ID
 * @param {string} playerName - 玩家名称
 * @returns {object|null} { game, player } 或 null
 */
function joinGame(gameId, playerName) {
  const game = games.get(gameId);
  if (!game) return null;

  // 检查游戏是否在等待阶段
  if (game.phase !== 'lobby') {
    return { error: '游戏已经开始，无法加入' };
  }

  // 检查人数是否已满
  if (game.players.length >= game.playerCount) {
    return { error: '游戏人数已满' };
  }

  // 检查重名
  if (game.players.some(p => p.name === playerName)) {
    return { error: '该名称已被使用' };
  }

  const player = {
    id: uuidv4(),
    name: playerName,
    characterId: null,  // 角色尚未分配
    isHost: game.players.length === 0, // 第一个加入的是主持人
    isMurderer: false,
    inventory: [],
    notes: []
  };

  game.players.push(player);
  return { game, player };
}

/**
 * 分配角色（从剧本中随机抽取，确保凶手只有一个）
 * @param {string} gameId - 游戏ID
 * @returns {object|null} 更新后的游戏对象
 */
function assignRoles(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  // 从剧本中获取所有角色
  const characters = script.characters;

  // Fisher-Yates 洗牌
  const shuffled = [...characters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 分配角色给玩家
  game.players.forEach((player, index) => {
    if (index < shuffled.length) {
      const character = shuffled[index];
      player.characterId = character.id;
      player.isMurderer = character.isMurderer;
    }
  });

  game.phase = 'search';
  return game;
}

/**
 * 获取游戏状态
 * @param {string} gameId - 游戏ID
 * @returns {object|null} 游戏对象（脱敏后的公开状态）
 */
function getGameState(gameId) {
  const game = games.get(gameId);
  if (!game) return null;
  return game;
}

/**
 * 根据游戏ID获取游戏（内部使用，用于修改）
 */
function getGame(gameId) {
  return games.get(gameId);
}

/**
 * 更新游戏阶段
 * @param {string} gameId - 游戏ID
 * @param {string} phase - 新阶段
 * @returns {object|null} 更新后的游戏
 */
function updateGamePhase(gameId, phase) {
  const game = games.get(gameId);
  if (!game) return null;

  const validPhases = ['lobby', 'search', 'discuss', 'vote', 'result'];
  if (!validPhases.includes(phase)) return null;

  game.phase = phase;

  // 如果进入投票阶段，清空之前的投票
  if (phase === 'vote') {
    game.votes = [];
  }

  // 如果进入结果阶段，判定结局
  if (phase === 'result') {
    game.outcome = determineOutcome(gameId);
  }

  return game;
}

/**
 * 玩家收集线索
 * @param {string} gameId - 游戏ID
 * @param {string} playerId - 玩家ID
 * @param {string} clueId - 线索ID
 * @returns {object|null} { game, clue }
 */
function collectClue(gameId, playerId, clueId) {
  const game = games.get(gameId);
  if (!game) return null;

  // 查找线索所属角色和线索详情
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  // 在剧本中查找线索
  let clueData = null;
  for (const room of script.rooms) {
    const prop = room.props.find(p => p.id === clueId);
    if (prop) {
      clueData = { ...prop, roomName: room.name, roomId: room.id };
      break;
    }
  }

  // 检查隐藏线索
  if (!clueData) {
    for (const hc of script.hiddenClues) {
      if (hc.id === clueId) {
        clueData = { ...hc, type: 'hidden', roomName: '主持人发放', roomId: 'admin' };
        break;
      }
    }
  }

  if (!clueData) return null;

  // 检查是否已被收集
  if (game.clues.collected.some(c => c.clueId === clueId && c.playerId === playerId)) {
    return { error: '该线索已被你收集' };
  }

  // 检查是否已被销毁
  if (game.clues.destroyed.some(c => c.clueId === clueId)) {
    return { error: '该线索已被销毁' };
  }

  // 添加到已收集列表
  game.clues.collected.push({
    playerId,
    clueId,
    timestamp: new Date().toISOString()
  });

  // 添加到玩家背包
  player.inventory.push({
    clueId,
    clueName: clueData.name,
    collectedAt: new Date().toISOString()
  });

  return { game, clue: clueData };
}

/**
 * 凶手销毁线索
 * @param {string} gameId - 游戏ID
 * @param {string} playerId - 玩家ID
 * @param {string} clueId - 线索ID
 * @returns {object|null} { game, clue }
 */
function destroyClue(gameId, playerId, clueId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  // 只有凶手才能销毁线索
  if (!player.isMurderer) {
    return { error: '只有凶手才能销毁线索' };
  }

  // 查找线索
  let clueData = null;
  for (const room of script.rooms) {
    const prop = room.props.find(p => p.id === clueId);
    if (prop) {
      clueData = { ...prop, roomName: room.name };
      break;
    }
  }

  if (!clueData) return null;

  // 检查是否已被销毁
  if (game.clues.destroyed.some(c => c.clueId === clueId)) {
    return { error: '该线索已被销毁' };
  }

  // 添加到已销毁列表
  game.clues.destroyed.push({
    playerId,
    clueId,
    timestamp: new Date().toISOString()
  });

  return { game, clue: clueData };
}

/**
 * 发送公聊消息
 * @param {string} gameId - 游戏ID
 * @param {string} playerId - 玩家ID
 * @param {string} content - 消息内容
 * @returns {object|null} { game, message }
 */
function sendPublicMessage(gameId, playerId, content) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const message = {
    id: uuidv4(),
    playerId,
    playerName: player.name,
    content,
    timestamp: new Date().toISOString()
  };

  game.chatMessages.public.push(message);

  // 限制公聊消息数量（最多保留200条）
  if (game.chatMessages.public.length > 200) {
    game.chatMessages.public = game.chatMessages.public.slice(-200);
  }

  return { game, message };
}

/**
 * 发送私聊消息
 * @param {string} gameId - 游戏ID
 * @param {string} fromId - 发送者ID
 * @param {string} toId - 接收者ID
 * @param {string} content - 消息内容
 * @returns {object|null} { game, message }
 */
function sendPrivateMessage(gameId, fromId, toId, content) {
  const game = games.get(gameId);
  if (!game) return null;

  const fromPlayer = game.players.find(p => p.id === fromId);
  const toPlayer = game.players.find(p => p.id === toId);
  if (!fromPlayer || !toPlayer) return null;

  // 初始化私聊记录
  if (!game.chatMessages.private[fromId]) {
    game.chatMessages.private[fromId] = {};
  }
  if (!game.chatMessages.private[fromId][toId]) {
    game.chatMessages.private[fromId][toId] = [];
  }
  if (!game.chatMessages.private[toId]) {
    game.chatMessages.private[toId] = {};
  }
  if (!game.chatMessages.private[toId][fromId]) {
    game.chatMessages.private[toId][fromId] = [];
  }

  const message = {
    id: uuidv4(),
    fromId,
    fromName: fromPlayer.name,
    toId,
    toName: toPlayer.name,
    content,
    timestamp: new Date().toISOString()
  };

  // 双向存储，方便双方查询
  game.chatMessages.private[fromId][toId].push(message);
  game.chatMessages.private[toId][fromId].push(message);

  return { game, message };
}

/**
 * 提交投票
 * @param {string} gameId - 游戏ID
 * @param {string} voterId - 投票者ID
 * @param {string} targetId - 被投票者ID
 * @returns {object|null} { game, vote }
 */
function submitVote(gameId, voterId, targetId) {
  const game = games.get(gameId);
  if (!game) return null;

  if (game.phase !== 'vote') {
    return { error: '当前不在投票阶段' };
  }

  const voter = game.players.find(p => p.id === voterId);
  const target = game.players.find(p => p.id === targetId);
  if (!voter || !target) return null;

  // 不能投给自己
  if (voterId === targetId) {
    return { error: '不能投票给自己' };
  }

  // 每人只能投一次
  if (game.votes.some(v => v.voterId === voterId)) {
    return { error: '你已经投过票了' };
  }

  const voteEntry = {
    voterId,
    voterName: voter.name,
    targetId,
    targetName: target.name,
    timestamp: new Date().toISOString()
  };
  game.votes.push(voteEntry);

  return { game, vote: voteEntry };
}

/**
 * 判定结局
 * @param {string} gameId - 游戏ID
 * @returns {object|null} 结局信息
 */
function determineOutcome(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  // 统计投票结果
  const voteCount = {};
  game.votes.forEach(vote => {
    voteCount[vote.targetId] = (voteCount[vote.targetId] || 0) + 1;
  });

  // 找出凶手
  const murderer = game.players.find(p => p.isMurderer);

  // 找出得票最高的玩家
  let maxVotes = 0;
  let topCandidates = [];
  Object.entries(voteCount).forEach(([targetId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      topCandidates = [targetId];
    } else if (count === maxVotes) {
      topCandidates.push(targetId);
    }
  });

  let outcome;
  if (topCandidates.length === 0) {
    // 没有人投票
    outcome = 'bad';
  } else if (topCandidates.length > 1) {
    // 平票 -> 坏结局
    outcome = 'bad';
  } else if (topCandidates[0] === murderer?.id) {
    // 凶手得票最高 -> 好结局
    outcome = 'good';
  } else {
    // 投错了人 -> 坏结局
    outcome = 'bad';
  }

  const ending = script.endings[outcome];

  return {
    result: outcome,
    title: ending.title,
    content: ending.content,
    epilogue: ending.epilogue,
    votes: voteCount,
    murdererId: murderer?.id,
    murdererName: murderer?.name
  };
}

/**
 * 触发恐怖事件
 * @param {string} gameId - 游戏ID
 * @param {string} eventId - 事件ID
 * @returns {object|null} { game, event }
 */
function triggerScareEvent(gameId, eventId) {
  const game = games.get(gameId);
  if (!game) return null;

  // 查找恐怖事件
  const scareEvent = script.scareEvents.find(e => e.id === eventId);
  if (!scareEvent) return null;

  // 检查是否已触发过
  if (game.scareEventsTriggered.includes(eventId)) {
    return { error: '该恐怖事件已经触发过了' };
  }

  game.scareEventsTriggered.push(eventId);

  return { game, event: scareEvent };
}

/**
 * 主持人发放隐藏线索
 * @param {string} gameId - 游戏ID
 * @param {string} playerId - 玩家ID
 * @param {string} hiddenClueId - 隐藏线索ID
 * @returns {object|null} { game, clue }
 */
function grantHiddenClue(gameId, playerId, hiddenClueId) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  // 查找隐藏线索
  const hiddenClue = script.hiddenClues.find(c => c.id === hiddenClueId);
  if (!hiddenClue) return null;

  // 检查是否已发放过
  if (game.hiddenCluesGranted.some(h => h.playerId === playerId && h.clueId === hiddenClueId)) {
    return { error: '该隐藏线索已发放给此玩家' };
  }

  game.hiddenCluesGranted.push({
    playerId,
    clueId: hiddenClueId,
    timestamp: new Date().toISOString()
  });

  // 添加到玩家背包
  player.inventory.push({
    clueId: hiddenClueId,
    clueName: hiddenClue.name,
    isHidden: true,
    collectedAt: new Date().toISOString()
  });

  return { game, clue: hiddenClue };
}

/**
 * 添加笔记
 * @param {string} gameId - 游戏ID
 * @param {string} playerId - 玩家ID
 * @param {string} content - 笔记内容
 * @returns {object|null} { game, note }
 */
function addNote(gameId, playerId, content) {
  const game = games.get(gameId);
  if (!game) return null;

  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const note = {
    id: uuidv4(),
    content,
    timestamp: new Date().toISOString()
  };

  player.notes.push(note);

  return { game, note };
}

// ============================================================
// AI 机器人系统
// ============================================================

const BOT_NAMES = ['林夜', '苏婉清', '陈默', '赵灵儿', '王寒'];
const BOT_AVATARS = ['👤', '👩', '🧔', '👧', '👨‍🦰'];

/**
 * 批量填充机器人玩家
 * @param {string} gameId
 * @param {number} count 要填充的机器人数量
 */
function fillBots(gameId, count) {
  const game = games.get(gameId);
  if (!game) return null;
  if (game.phase !== 'lobby') return { error: '游戏已开始，无法填充机器人' };

  const available = game.playerCount - game.players.length;
  const fillCount = Math.min(count, available);
  if (fillCount <= 0) return { error: '人数已满' };

  const bots = [];
  for (let i = 0; i < fillCount; i++) {
    const botId = uuidv4();
    const botName = BOT_NAMES[i % BOT_NAMES.length] + '(AI)';
    const player = {
      id: botId,
      name: botName,
      characterId: null,
      isHost: false,
      isMurderer: false,
      isBot: true,
      avatar: BOT_AVATARS[i % BOT_AVATARS.length],
      inventory: [],
      notes: []
    };
    game.players.push(player);
    bots.push(player);
  }

  return { game, bots };
}

/**
 * 机器人自动搜证：随机收集指定数量的线索
 */
function botSearch(gameId, botId) {
  const game = games.get(gameId);
  if (!game) return null;

  const bot = game.players.find(p => p.id === botId);
  if (!bot || !bot.isBot) return null;

  // 获取所有未被销毁且未被该机器人收集的线索
  const allClues = [];
  for (const room of script.rooms) {
    for (const prop of room.props) {
      const alreadyCollected = game.clues.collected.some(
        c => c.clueId === prop.id && c.playerId === botId
      );
      const destroyed = game.clues.destroyed.some(c => c.clueId === prop.id);
      if (!alreadyCollected && !destroyed) {
        allClues.push(prop);
      }
    }
  }

  if (allClues.length === 0) return { collected: [] };

  // 随机收集 3-6 条线索
  const count = Math.min(3 + Math.floor(Math.random() * 4), allClues.length);
  const shuffled = [...allClues].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  const collected = [];
  for (const clue of selected) {
    game.clues.collected.push({
      playerId: botId,
      clueId: clue.id,
      timestamp: new Date().toISOString()
    });
    bot.inventory.push({
      clueId: clue.id,
      clueName: clue.name,
      collectedAt: new Date().toISOString()
    });
    collected.push(clue.name);
  }

  return { collected };
}

/**
 * 机器人自动发言
 */
function botSpeak(gameId, botId) {
  const game = games.get(gameId);
  if (!game) return null;

  const bot = game.players.find(p => p.id === botId);
  if (!bot || !bot.isBot) return null;

  const character = script.characters.find(c => c.id === bot.characterId);
  const charName = character ? character.name : bot.name;

  // 根据角色和是否凶手生成不同风格的发言
  const isMurderer = bot.isMurderer;
  const templates = isMurderer
    ? [
        `我觉得${charName}不太可能是凶手，大家再仔细看看其他线索吧。`,
        `我收集到了一些线索，指向的方向可能和大家想的不太一样……`,
        `时间线上有些矛盾，我需要再整理一下。`,
        `大家冷静，不要急于下结论。`,
        `我怀疑有人在故意引导我们往错误的方向想。`,
      ]
    : [
        `我在书房发现了一些关键线索！青铜镇纸上有刻字，指向了某个人……`,
        `大家有没有发现，二十年前的案件和现在的案件手法一模一样？`,
        `我查看了访客登记簿，三年前的记录被人销毁了，这很可疑。`,
        `魂归之镜的秘密可能才是本案的关键！`,
        `时间线对不上！有人说了谎。`,
        `我建议大家都把自己的不在场证明再说一遍。`,
      ];

  const content = templates[Math.floor(Math.random() * templates.length)];

  const message = {
    id: uuidv4(),
    playerId: botId,
    playerName: bot.name,
    content,
    timestamp: new Date().toISOString()
  };

  game.chatMessages.public.push(message);
  return { message };
}

/**
 * 机器人自动投票
 */
function botVote(gameId, botId) {
  const game = games.get(gameId);
  if (!game) return null;

  const bot = game.players.find(p => p.id === botId);
  if (!bot || !bot.isBot) return null;
  if (game.votes.some(v => v.voterId === botId)) return { error: '已投票' };

  // 机器人有 70% 概率投给真正的凶手，30% 概率随机投
  const murderer = game.players.find(p => p.isMurderer);
  let targetId;

  if (murderer && Math.random() < 0.7) {
    targetId = murderer.id;
  } else {
    // 随机投一个不是自己也不是凶手的
    const candidates = game.players.filter(p => p.id !== botId);
    if (candidates.length === 0) return null;
    targetId = candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  const target = game.players.find(p => p.id === targetId);
  const voteEntry = {
    voterId: botId,
    voterName: bot.name,
    targetId,
    targetName: target?.name || '未知',
    timestamp: new Date().toISOString()
  };
  game.votes.push(voteEntry);

  return voteEntry;
}

/**
 * 执行所有机器人的阶段行为
 */
function executeBotActions(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  const bots = game.players.filter(p => p.isBot);
  const results = { search: [], speak: [], vote: [] };

  for (const bot of bots) {
    if (game.phase === 'search') {
      const r = botSearch(gameId, bot.id);
      if (r) results.search.push({ bot: bot.name, ...r });
    }
    if (game.phase === 'discuss') {
      // 每个机器人有 50% 概率发言
      if (Math.random() < 0.5) {
        const r = botSpeak(gameId, bot.id);
        if (r) results.speak.push({ bot: bot.name, ...r });
      }
    }
    if (game.phase === 'vote') {
      // 延迟投票，模拟思考
      setTimeout(() => {
        botVote(gameId, bot.id);
      }, 3000 + Math.random() * 5000);
    }
  }

  return results;
}

module.exports = {
  games,
  createGame,
  joinGame,
  assignRoles,
  getGameState,
  getGame,
  updateGamePhase,
  collectClue,
  destroyClue,
  sendPublicMessage,
  sendPrivateMessage,
  submitVote,
  determineOutcome,
  triggerScareEvent,
  grantHiddenClue,
  addNote,
  // 机器人相关
  fillBots,
  botSearch,
  botSpeak,
  botVote,
  executeBotActions
};
