/**
 * REST API 路由
 * 提供所有 HTTP 端点
 */

const express = require('express');
const router = express.Router();
const gameState = require('./gameState');

// ============================================================
// 游戏创建与加入
// ============================================================

/**
 * POST /api/game/create
 * 创建新游戏
 * Body: { hostName, playerCount }
 */
router.post('/game/create', (req, res) => {
  try {
    const { hostName, playerCount } = req.body;

    if (!hostName || !playerCount) {
      return res.status(400).json({ error: '缺少必要参数：hostName, playerCount' });
    }

    if (playerCount < 2 || playerCount > 8) {
      return res.status(400).json({ error: '玩家数量必须在2-8人之间' });
    }

    const game = gameState.createGame(hostName, playerCount);

    // 自动将主持人加入游戏
    const joinResult = gameState.joinGame(game.id, hostName);
    if (joinResult.error) {
      return res.status(400).json({ error: joinResult.error });
    }

    res.json({
      success: true,
      gameId: game.id,
      player: joinResult.player
    });
  } catch (err) {
    console.error('创建游戏失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/join
 * 加入已有游戏
 * Body: { gameId, playerName }
 */
router.post('/game/join', (req, res) => {
  try {
    const { gameId, playerName } = req.body;

    if (!gameId || !playerName) {
      return res.status(400).json({ error: '缺少必要参数：gameId, playerName' });
    }

    const result = gameState.joinGame(gameId, playerName);

    if (!result) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      game: result.game,
      player: result.player
    });
  } catch (err) {
    console.error('加入游戏失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/game/:gameId
 * 获取游戏状态
 */
router.get('/game/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const game = gameState.getGameState(gameId);

    if (!game) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    res.json({ success: true, game });
  } catch (err) {
    console.error('获取游戏状态失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/start
 * 开始游戏，分配角色
 */
router.post('/game/:gameId/start', (req, res) => {
  try {
    const { gameId } = req.params;
    const game = gameState.getGame(gameId);

    if (!game) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (game.phase !== 'lobby') {
      return res.status(400).json({ error: '游戏已经开始' });
    }

    if (game.players.length < game.playerCount) {
      return res.status(400).json({ error: '玩家数量不足，无法开始' });
    }

    const updatedGame = gameState.assignRoles(gameId);

    res.json({ success: true, game: updatedGame });
  } catch (err) {
    console.error('开始游戏失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 游戏阶段控制
// ============================================================

/**
 * POST /api/game/:gameId/phase
 * 更新游戏阶段
 * Body: { phase }
 */
router.post('/game/:gameId/phase', (req, res) => {
  try {
    const { gameId } = req.params;
    const { phase } = req.body;

    if (!phase) {
      return res.status(400).json({ error: '缺少必要参数：phase' });
    }

    const game = gameState.updateGamePhase(gameId, phase);

    if (!game) {
      return res.status(404).json({ error: '游戏不存在或阶段无效' });
    }

    res.json({ success: true, game });
  } catch (err) {
    console.error('更新游戏阶段失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 线索操作
// ============================================================

/**
 * POST /api/game/:gameId/clue/collect
 * 收集线索
 * Body: { playerId, clueId }
 */
router.post('/game/:gameId/clue/collect', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, clueId } = req.body;

    if (!playerId || !clueId) {
      return res.status(400).json({ error: '缺少必要参数：playerId, clueId' });
    }

    const result = gameState.collectClue(gameId, playerId, clueId);

    if (!result) {
      return res.status(404).json({ error: '游戏或线索不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, game: result.game, clue: result.clue });
  } catch (err) {
    console.error('收集线索失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/clue/destroy
 * 凶手销毁线索
 * Body: { playerId, clueId }
 */
router.post('/game/:gameId/clue/destroy', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, clueId } = req.body;

    if (!playerId || !clueId) {
      return res.status(400).json({ error: '缺少必要参数：playerId, clueId' });
    }

    const result = gameState.destroyClue(gameId, playerId, clueId);

    if (!result) {
      return res.status(404).json({ error: '游戏或线索不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, game: result.game, clue: result.clue });
  } catch (err) {
    console.error('销毁线索失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 聊天
// ============================================================

/**
 * POST /api/game/:gameId/chat/public
 * 发送公聊消息
 * Body: { playerId, content }
 */
router.post('/game/:gameId/chat/public', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, content } = req.body;

    if (!playerId || !content) {
      return res.status(400).json({ error: '缺少必要参数：playerId, content' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const result = gameState.sendPublicMessage(gameId, playerId, content);

    if (!result) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('发送公聊消息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/chat/private
 * 发送私聊消息
 * Body: { fromId, toId, content }
 */
router.post('/game/:gameId/chat/private', (req, res) => {
  try {
    const { gameId } = req.params;
    const { fromId, toId, content } = req.body;

    if (!fromId || !toId || !content) {
      return res.status(400).json({ error: '缺少必要参数：fromId, toId, content' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const result = gameState.sendPrivateMessage(gameId, fromId, toId, content);

    if (!result) {
      return res.status(404).json({ error: '游戏或玩家不存在' });
    }

    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('发送私聊消息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 投票
// ============================================================

/**
 * POST /api/game/:gameId/vote
 * 提交投票
 * Body: { voterId, targetId }
 */
router.post('/game/:gameId/vote', (req, res) => {
  try {
    const { gameId } = req.params;
    const { voterId, targetId } = req.body;

    if (!voterId || !targetId) {
      return res.status(400).json({ error: '缺少必要参数：voterId, targetId' });
    }

    const result = gameState.submitVote(gameId, voterId, targetId);

    if (!result) {
      return res.status(404).json({ error: '游戏或玩家不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, vote: result.vote });
  } catch (err) {
    console.error('提交投票失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 管理员操作（主持人专用）
// ============================================================

/**
 * POST /api/game/:gameId/admin/scare
 * 触发恐怖事件
 * Body: { eventId }
 */
router.post('/game/:gameId/admin/scare', (req, res) => {
  try {
    const { gameId } = req.params;
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: '缺少必要参数：eventId' });
    }

    const result = gameState.triggerScareEvent(gameId, eventId);

    if (!result) {
      return res.status(404).json({ error: '游戏或恐怖事件不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, event: result.event });
  } catch (err) {
    console.error('触发恐怖事件失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/admin/hidden-clue
 * 主持人发放隐藏线索
 * Body: { playerId, hiddenClueId }
 */
router.post('/game/:gameId/admin/hidden-clue', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, hiddenClueId } = req.body;

    if (!playerId || !hiddenClueId) {
      return res.status(400).json({ error: '缺少必要参数：playerId, hiddenClueId' });
    }

    const result = gameState.grantHiddenClue(gameId, playerId, hiddenClueId);

    if (!result) {
      return res.status(404).json({ error: '游戏或隐藏线索不存在' });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, clue: result.clue });
  } catch (err) {
    console.error('发放隐藏线索失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 笔记
// ============================================================

/**
 * POST /api/game/:gameId/note
 * 添加笔记
 * Body: { playerId, content }
 */
router.post('/game/:gameId/note', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, content } = req.body;

    if (!playerId || !content) {
      return res.status(400).json({ error: '缺少必要参数：playerId, content' });
    }

    const result = gameState.addNote(gameId, playerId, content);

    if (!result) {
      return res.status(404).json({ error: '游戏或玩家不存在' });
    }

    res.json({ success: true, note: result.note });
  } catch (err) {
    console.error('添加笔记失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 剧本数据
// ============================================================

/**
 * GET /api/script
 * 获取剧本数据
 */
router.get('/script', (req, res) => {
  try {
    const script = require('./data/script');
    // 清除缓存以支持热更新
    delete require.cache[require.resolve('./data/script')];
    res.json(script);
  } catch (err) {
    console.error('获取剧本数据失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// AI 机器人操作
// ============================================================

/**
 * POST /api/game/:gameId/bots/fill
 * 自动填充机器人玩家
 * Body: { count } - 要填充的数量（可选，默认填满）
 */
router.post('/game/:gameId/bots/fill', (req, res) => {
  try {
    const { gameId } = req.params;
    const { count } = req.body;
    const available = gameState.getGame(gameId)?.playerCount - (gameState.getGame(gameId)?.players.length || 0);
    const fillCount = count || available || 3;
    const result = gameState.fillBots(gameId, fillCount);
    if (!result) return res.status(404).json({ error: '游戏不存在' });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, bots: result.bots, game: result.game });
  } catch (err) {
    console.error('填充机器人失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/bots/execute
 * 执行所有机器人的阶段行为（搜证/发言/投票）
 */
router.post('/game/:gameId/bots/execute', (req, res) => {
  try {
    const { gameId } = req.params;
    const results = gameState.executeBotActions(gameId);
    if (!results) return res.status(404).json({ error: '游戏不存在' });
    res.json({ success: true, results });
  } catch (err) {
    console.error('执行机器人行为失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/game/:gameId/bots/vote-all
 * 让所有机器人立即投票
 */
router.post('/game/:gameId/bots/vote-all', (req, res) => {
  try {
    const { gameId } = req.params;
    const game = gameState.getGame(gameId);
    if (!game) return res.status(404).json({ error: '游戏不存在' });

    const bots = game.players.filter(p => p.isBot);
    const votes = [];
    for (const bot of bots) {
      const result = gameState.botVote(gameId, bot.id);
      if (result && !result.error) votes.push(result);
    }
    res.json({ success: true, votes });
  } catch (err) {
    console.error('机器人投票失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
