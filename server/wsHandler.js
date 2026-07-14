/**
 * WebSocket 处理模块
 * 管理实时通信，包括房间管理、消息广播
 */

const WebSocket = require('ws');
const url = require('url');
const gameState = require('./gameState');

/**
 * 设置 WebSocket 服务器
 * @param {WebSocket.Server} wss - WebSocket 服务器实例
 */
function setupWebSocket(wss) {
  // 存储客户端连接：Map<gameId, Set<ws>>
  const rooms = new Map();

  // 存储客户端关联信息：Map<ws, { gameId, playerId }>
  const clients = new Map();

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] 新客户端连接');

    // 解析连接参数（可选：gameId, playerId）
    const params = url.parse(req.url, true).query;
    let currentGameId = params.gameId || null;
    let currentPlayerId = params.playerId || null;

    // 如果有参数，自动加入房间
    if (currentGameId) {
      joinRoom(ws, currentGameId, currentPlayerId);
    }

    ws.on('message', (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());
        handleMessage(ws, data);
      } catch (err) {
        console.error('[WebSocket] 消息解析失败:', err.message);
        sendTo(ws, { type: 'error', message: '消息格式无效' });
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] 客户端断开连接');
      // 从所有房间中移除
      const clientInfo = clients.get(ws);
      if (clientInfo) {
        leaveRoom(ws, clientInfo.gameId);
      }
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] 连接错误:', err.message);
    });
  });

  /**
   * 处理客户端消息
   */
  function handleMessage(ws, data) {
    const { type, ...payload } = data;

    switch (type) {
      case 'join_room':
        handleJoinRoom(ws, payload);
        break;

      case 'leave_room':
        handleLeaveRoom(ws, payload);
        break;

      case 'phase_update':
        handlePhaseUpdate(ws, payload);
        break;

      case 'clue_collected':
        handleClueCollected(ws, payload);
        break;

      case 'clue_destroyed':
        handleClueDestroyed(ws, payload);
        break;

      case 'chat_message':
        handleChatMessage(ws, payload);
        break;

      case 'vote_update':
        handleVoteUpdate(ws, payload);
        break;

      case 'scare_event':
        handleScareEvent(ws, payload);
        break;

      case 'outcome':
        handleOutcome(ws, payload);
        break;

      default:
        sendTo(ws, { type: 'error', message: `未知消息类型: ${type}` });
    }
  }

  // ============================================================
  // 房间管理
  // ============================================================

  /**
   * 加入房间
   */
  function joinRoom(ws, gameId, playerId) {
    if (!rooms.has(gameId)) {
      rooms.set(gameId, new Set());
    }
    rooms.get(gameId).add(ws);

    // 记录客户端信息
    clients.set(ws, { gameId, playerId });

    // 发送当前游戏状态给新加入的客户端
    const game = gameState.getGameState(gameId);
    if (game) {
      sendTo(ws, {
        type: 'game_state',
        game
      });
    }

    console.log(`[WebSocket] 客户端加入房间: ${gameId}`);
  }

  /**
   * 离开房间
   */
  function leaveRoom(ws, gameId) {
    if (gameId && rooms.has(gameId)) {
      rooms.get(gameId).delete(ws);
      if (rooms.get(gameId).size === 0) {
        rooms.delete(gameId);
      }
      console.log(`[WebSocket] 客户端离开房间: ${gameId}`);
    }
  }

  function handleJoinRoom(ws, payload) {
    const { gameId, playerId } = payload;
    if (!gameId) {
      sendTo(ws, { type: 'error', message: '缺少 gameId' });
      return;
    }

    const clientInfo = clients.get(ws);
    if (clientInfo && clientInfo.gameId) {
      leaveRoom(ws, clientInfo.gameId);
    }

    joinRoom(ws, gameId, playerId);
    sendTo(ws, { type: 'room_joined', gameId });
  }

  function handleLeaveRoom(ws, payload) {
    const { gameId } = payload;
    const clientInfo = clients.get(ws);

    if (clientInfo) {
      leaveRoom(ws, clientInfo.gameId);
    } else if (gameId) {
      leaveRoom(ws, gameId);
    }

    sendTo(ws, { type: 'room_left', gameId: gameId || clientInfo?.gameId });
  }

  // ============================================================
  // 游戏事件广播
  // ============================================================

  /**
   * 阶段更新广播
   */
  function handlePhaseUpdate(ws, payload) {
    const { gameId, phase } = payload;
    if (!gameId || !phase) return;

    const game = gameState.updateGamePhase(gameId, phase);
    if (!game) {
      sendTo(ws, { type: 'error', message: '阶段更新失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'phase_update',
      gameId,
      phase,
      game
    });
  }

  /**
   * 线索收集广播
   */
  function handleClueCollected(ws, payload) {
    const { gameId, playerId, clueId } = payload;
    if (!gameId || !playerId || !clueId) return;

    const result = gameState.collectClue(gameId, playerId, clueId);
    if (!result || result.error) {
      sendTo(ws, { type: 'error', message: result?.error || '线索收集失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'clue_collected',
      gameId,
      playerId,
      clueId,
      clue: result.clue,
      game: result.game
    });
  }

  /**
   * 线索销毁广播
   */
  function handleClueDestroyed(ws, payload) {
    const { gameId, playerId, clueId } = payload;
    if (!gameId || !playerId || !clueId) return;

    const result = gameState.destroyClue(gameId, playerId, clueId);
    if (!result || result.error) {
      sendTo(ws, { type: 'error', message: result?.error || '线索销毁失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'clue_destroyed',
      gameId,
      playerId,
      clueId,
      clue: result.clue,
      game: result.game
    });
  }

  /**
   * 聊天消息广播
   */
  function handleChatMessage(ws, payload) {
    const { gameId, chatType, playerId, toId, content } = payload;
    if (!gameId || !playerId || !content) return;

    if (chatType === 'public') {
      const result = gameState.sendPublicMessage(gameId, playerId, content);
      if (!result) {
        sendTo(ws, { type: 'error', message: '消息发送失败' });
        return;
      }

      broadcastToRoom(gameId, {
        type: 'chat_message',
        gameId,
        chatType: 'public',
        message: result.message
      });
    } else if (chatType === 'private') {
      if (!toId) {
        sendTo(ws, { type: 'error', message: '私聊需要指定 toId' });
        return;
      }

      const result = gameState.sendPrivateMessage(gameId, playerId, toId, content);
      if (!result) {
        sendTo(ws, { type: 'error', message: '消息发送失败' });
        return;
      }

      // 私聊消息只发送给发送者和接收者
      const room = rooms.get(gameId);
      if (room) {
        room.forEach(client => {
          const clientInfo = clients.get(client);
          if (clientInfo && (clientInfo.playerId === playerId || clientInfo.playerId === toId)) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'chat_message',
                gameId,
                chatType: 'private',
                message: result.message
              }));
            }
          }
        });
      }
    }
  }

  /**
   * 投票更新广播
   */
  function handleVoteUpdate(ws, payload) {
    const { gameId, voterId, targetId } = payload;
    if (!gameId || !voterId || !targetId) return;

    const result = gameState.submitVote(gameId, voterId, targetId);
    if (!result || result.error) {
      sendTo(ws, { type: 'error', message: result?.error || '投票失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'vote_update',
      gameId,
      vote: result.vote,
      game: result.game
    });
  }

  /**
   * 恐怖事件广播（所有玩家）
   */
  function handleScareEvent(ws, payload) {
    const { gameId, eventId } = payload;
    if (!gameId || !eventId) return;

    const result = gameState.triggerScareEvent(gameId, eventId);
    if (!result || result.error) {
      sendTo(ws, { type: 'error', message: result?.error || '恐怖事件触发失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'scare_event',
      gameId,
      event: result.event
    });
  }

  /**
   * 结局判定广播
   */
  function handleOutcome(ws, payload) {
    const { gameId } = payload;
    if (!gameId) return;

    const outcome = gameState.determineOutcome(gameId);
    if (!outcome) {
      sendTo(ws, { type: 'error', message: '结局判定失败' });
      return;
    }

    broadcastToRoom(gameId, {
      type: 'outcome',
      gameId,
      outcome
    });
  }

  // ============================================================
  // 工具函数
  // ============================================================

  /**
   * 发送消息给单个客户端
   */
  function sendTo(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * 广播消息给房间内所有客户端
   */
  function broadcastToRoom(gameId, data) {
    const room = rooms.get(gameId);
    if (!room) return;

    const message = JSON.stringify(data);
    room.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

module.exports = setupWebSocket;
