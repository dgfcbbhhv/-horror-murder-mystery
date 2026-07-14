import { create } from 'zustand';
import type {
  GameState,
  GamePhase,
  Player,
  ChatMessage,
  Clue,
} from '../types/game';

const API_BASE = '/api';

interface GameStore {
  // 状态
  gameId: string | null;
  playerId: string | null;
  playerName: string;
  gameState: GameState | null;
  script: any | null;
  connected: boolean;
  ws: WebSocket | null;
  error: string | null;
  notification: string | null;

  // 操作
  setPlayerName: (name: string) => void;
  setPlayerId: (id: string) => void;
  setGameId: (id: string) => void;

  // API 调用
  createGame: (hostName: string, playerCount: number) => Promise<string>;
  joinGame: (gameId: string, playerName: string) => Promise<void>;
  fetchGameState: (gameId: string) => Promise<void>;
  fetchScript: () => Promise<void>;
  startGame: (gameId: string) => Promise<void>;
  updatePhase: (gameId: string, phase: GamePhase) => Promise<void>;
  collectClue: (gameId: string, clueId: string) => Promise<void>;
  destroyClue: (gameId: string, clueId: string) => Promise<void>;
  sendPublicMessage: (gameId: string, content: string) => Promise<void>;
  sendPrivateMessage: (
    gameId: string,
    toId: string,
    content: string
  ) => Promise<void>;
  submitVote: (gameId: string, targetId: string) => Promise<void>;
  triggerScareEvent: (gameId: string, eventId: string) => Promise<void>;
  grantHiddenClue: (
    gameId: string,
    targetPlayerId: string,
    hiddenClueId: string
  ) => Promise<void>;
  addNote: (gameId: string, content: string) => Promise<void>;

  // 机器人操作
  fillBots: (gameId: string, count?: number) => Promise<any>;
  executeBotActions: (gameId: string) => Promise<any>;
  botVoteAll: (gameId: string) => Promise<any>;

  // WebSocket
  connectWebSocket: (gameId: string) => void;
  disconnectWebSocket: () => void;

  // 工具
  setError: (error: string | null) => void;
  setNotification: (msg: string | null) => void;
  getCurrentPlayer: () => Player | undefined;
  getPlayerById: (id: string) => Player | undefined;
  isMurderer: () => boolean;
  getMyInventory: () => Clue[];
  getCollectedClueIds: () => string[];
}

const useGameStore = create<GameStore>((set, get) => {
  // 通用 fetch 封装
  const apiFetch = async <T>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { message?: string }).message || `请求失败 (${res.status})`
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '未知错误';
      set({ error: message });
      throw err;
    }
  };

  return {
    // 初始状态
    gameId: null,
    playerId: null,
    playerName: '',
    gameState: null,
    script: null,
    connected: false,
    ws: null,
    error: null,
    notification: null,

    setPlayerName: (name) => set({ playerName: name }),
    setPlayerId: (id) => set({ playerId: id }),
    setGameId: (id) => set({ gameId: id }),

    // --- API 调用 ---

    createGame: async (hostName, playerCount) => {
      const data = await apiFetch<{ gameId: string; player: { id: string } }>(
        '/game/create',
        {
          method: 'POST',
          body: JSON.stringify({ hostName, playerCount }),
        }
      );
      set({ gameId: data.gameId, playerId: data.player.id, playerName: hostName });
      // 创建后立即获取游戏状态
      await get().fetchGameState(data.gameId);
      return data.gameId;
    },

    joinGame: async (gameId, playerName) => {
      const data = await apiFetch<{ player: { id: string } }>('/game/join', {
        method: 'POST',
        body: JSON.stringify({ gameId, playerName }),
      });
      set({ gameId, playerId: data.player.id, playerName });
      // 加入后立即获取游戏状态
      await get().fetchGameState(gameId);
    },

    fetchGameState: async (gameId) => {
      const data = await apiFetch<{ game: GameState }>(`/game/${gameId}`);
      set({ gameState: data.game });
    },

    fetchScript: async () => {
      const data = await apiFetch<any>('/script');
      set({ script: data });
    },

    startGame: async (gameId) => {
      await apiFetch(`/game/${gameId}/start`, {
        method: 'POST',
      });
      await get().fetchGameState(gameId);
    },

    updatePhase: async (gameId, phase) => {
      await apiFetch(`/game/${gameId}/phase`, {
        method: 'POST',
        body: JSON.stringify({ phase }),
      });
      await get().fetchGameState(gameId);
    },

    collectClue: async (gameId, clueId) => {
      const playerId = get().playerId;
      await apiFetch(`/game/${gameId}/clue/collect`, {
        method: 'POST',
        body: JSON.stringify({ playerId, clueId }),
      });
      await get().fetchGameState(gameId);
    },

    destroyClue: async (gameId, clueId) => {
      const playerId = get().playerId;
      await apiFetch(`/game/${gameId}/clue/destroy`, {
        method: 'POST',
        body: JSON.stringify({ playerId, clueId }),
      });
      await get().fetchGameState(gameId);
    },

    sendPublicMessage: async (gameId, content) => {
      const playerId = get().playerId;
      await apiFetch(`/game/${gameId}/chat/public`, {
        method: 'POST',
        body: JSON.stringify({ playerId, content }),
      });
    },

    sendPrivateMessage: async (gameId, toId, content) => {
      const fromId = get().playerId;
      await apiFetch(`/game/${gameId}/chat/private`, {
        method: 'POST',
        body: JSON.stringify({ fromId, toId, content }),
      });
    },

    submitVote: async (gameId, targetId) => {
      const voterId = get().playerId;
      await apiFetch(`/game/${gameId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ voterId, targetId }),
      });
      await get().fetchGameState(gameId);
    },

    triggerScareEvent: async (gameId, eventId) => {
      await apiFetch(`/game/${gameId}/admin/scare`, {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      });
      await get().fetchGameState(gameId);
    },

    grantHiddenClue: async (gameId, targetPlayerId, hiddenClueId) => {
      await apiFetch(`/game/${gameId}/admin/hidden-clue`, {
        method: 'POST',
        body: JSON.stringify({ playerId: targetPlayerId, hiddenClueId }),
      });
      await get().fetchGameState(gameId);
    },

    addNote: async (gameId, content) => {
      const playerId = get().playerId;
      await apiFetch(`/game/${gameId}/note`, {
        method: 'POST',
        body: JSON.stringify({ playerId, content }),
      });
      await get().fetchGameState(gameId);
    },

    // --- 机器人操作 ---

    fillBots: async (gameId: string, count?: number) => {
      const data = await apiFetch<{ bots: any[] }>(`/game/${gameId}/bots/fill`, {
        method: 'POST',
        body: JSON.stringify({ count }),
      });
      await get().fetchGameState(gameId);
      return data;
    },

    executeBotActions: async (gameId: string) => {
      const data = await apiFetch<{ results: any }>(`/game/${gameId}/bots/execute`, {
        method: 'POST',
      });
      await get().fetchGameState(gameId);
      return data;
    },

    botVoteAll: async (gameId: string) => {
      const data = await apiFetch<{ votes: any[] }>(`/game/${gameId}/bots/vote-all`, {
        method: 'POST',
      });
      await get().fetchGameState(gameId);
      return data;
    },

    // --- WebSocket ---

    connectWebSocket: (gameId) => {
      const { ws: existingWs } = get();
      if (existingWs) {
        existingWs.close();
      }

      // 开发环境下使用 Vite 代理，生产环境使用当前 host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ connected: true });
        socket.send(JSON.stringify({ type: 'join', gameId }));
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          switch (msg.type) {
            case 'gameState':
              set({ gameState: msg.payload as GameState });
              break;
            case 'phaseChange':
              set((state) => ({
                gameState: state.gameState
                  ? {
                      ...state.gameState,
                      phase: msg.payload as GamePhase,
                    }
                  : null,
              }));
              break;
            case 'clueCollected':
            case 'clueDestroyed':
            case 'voteUpdate':
            case 'scareTriggered':
            case 'hiddenClueGranted':
              set({ gameState: msg.payload as GameState });
              break;
            case 'chatMessage': {
              const chatMsg = msg.payload as ChatMessage;
              set((state) => {
                if (!state.gameState) return {};
                const updated = { ...state.gameState };
                if (chatMsg.type === 'public') {
                  updated.chatMessages = {
                    ...updated.chatMessages,
                    public: [
                      ...updated.chatMessages.public,
                      chatMsg,
                    ],
                  };
                } else if (chatMsg.to) {
                  const key = chatMsg.to;
                  updated.chatMessages = {
                    ...updated.chatMessages,
                    private: {
                      ...updated.chatMessages.private,
                      [key]: [
                        ...(updated.chatMessages.private[key] || []),
                        chatMsg,
                      ],
                    },
                  };
                }
                return { gameState: updated };
              });
              break;
            }
            case 'playerJoined':
            case 'playerLeft':
            case 'gameStarted':
              set({ gameState: msg.payload as GameState });
              break;
            case 'error':
              set({
                error: (msg.payload as { message?: string }).message || '服务器错误',
              });
              break;
            default:
              break;
          }
        } catch {
          // 忽略无法解析的消息
        }
      };

      socket.onclose = () => {
        set({ connected: false, ws: null });
      };

      socket.onerror = () => {
        set({ connected: false, error: 'WebSocket 连接失败' });
      };

      set({ ws: socket });
    },

    disconnectWebSocket: () => {
      const { ws } = get();
      if (ws) {
        ws.close();
        set({ ws: null, connected: false });
      }
    },

    // --- 工具方法 ---

    setError: (error) => set({ error }),
    setNotification: (msg) => set({ notification: msg }),

    getCurrentPlayer: () => {
      const { gameState, playerId } = get();
      if (!gameState || !playerId) return undefined;
      return gameState.players.find((p) => p.id === playerId);
    },

    getPlayerById: (id) => {
      const { gameState } = get();
      if (!gameState) return undefined;
      return gameState.players.find((p) => p.id === id);
    },

    isMurderer: () => {
      const player = get().getCurrentPlayer();
      return player?.isMurderer ?? false;
    },

    getMyInventory: () => {
      const { gameState } = get();
      const player = get().getCurrentPlayer();
      if (!gameState || !player) return [];
      // inventory 可能是字符串数组或对象数组，统一提取 clueId
      const rawInventory = player.inventory || [];
      const clueIds: string[] = rawInventory.map((item: any) =>
        typeof item === 'string' ? item : item.clueId
      );
      const script = get().script as any;
      return clueIds
        .map((cid: string) => {
          for (const room of script?.rooms || []) {
            const found = room.props.find((p: Clue) => p.id === cid);
            if (found) return found;
          }
          return null;
        })
        .filter(Boolean) as Clue[];
    },

    getCollectedClueIds: () => {
      const player = get().getCurrentPlayer();
      const rawInventory = player?.inventory ?? [];
      return rawInventory.map((item: any) =>
        typeof item === 'string' ? item : item.clueId
      );
    },
  };
});

export default useGameStore;
