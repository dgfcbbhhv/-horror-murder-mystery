import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type {
  Player,
  ChatMessage,
  Clue,
  ScriptData,
} from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

// 格式化时间戳
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 背包侧面板
function BackpackPanel({
  script,
  currentPlayer,
  isMurderer,
  destroyedCount,
  onClose,
  onDestroy,
}: {
  script: ScriptData | null;
  currentPlayer: Player | undefined;
  isMurderer: boolean;
  destroyedCount: number;
  onClose: () => void;
  onDestroy: (clueId: string) => void;
}) {
  const rooms = (script as ScriptData)?.rooms ?? [];
  const myInventory = currentPlayer?.inventory ?? [];

  const inventoryClues: Clue[] = [];
  for (const room of rooms) {
    for (const prop of room.props) {
      if (myInventory.includes(prop.id)) {
        inventoryClues.push(prop);
      }
    }
  }

  const grouped: Record<string, Clue[]> = { key: [], normal: [], murderer_cover: [] };
  for (const clue of inventoryClues) {
    if (grouped[clue.type]) grouped[clue.type].push(clue);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-40 w-80 bg-gray-950 border-l border-red-900/30
                   shadow-[-20px_0_40px_rgba(0,0,0,0.5)] overflow-y-auto"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h3
              className="text-lg font-bold tracking-wider"
              style={{ color: '#DC2626', textShadow: '0 0 12px rgba(220,38,38,0.6)' }}
            >
              我的背包
            </h3>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>

          <p className="text-gray-500 text-xs mb-4">已收集 {myInventory.length} 条线索</p>

          {grouped.key.length > 0 && (
            <div className="mb-6">
              <h4 className="text-amber-400 text-sm font-semibold mb-3">🔑 关键线索</h4>
              <div className="space-y-2">
                {grouped.key.map((clue) => (
                  <InventoryClueCard
                    key={clue.id}
                    clue={clue}
                    isMurderer={isMurderer}
                    destroyedCount={destroyedCount}
                    onDestroy={onDestroy}
                  />
                ))}
              </div>
            </div>
          )}

          {grouped.normal.length > 0 && (
            <div className="mb-6">
              <h4 className="text-gray-400 text-sm font-semibold mb-3">📋 普通线索</h4>
              <div className="space-y-2">
                {grouped.normal.map((clue) => (
                  <InventoryClueCard
                    key={clue.id}
                    clue={clue}
                    isMurderer={isMurderer}
                    destroyedCount={destroyedCount}
                    onDestroy={onDestroy}
                  />
                ))}
              </div>
            </div>
          )}

          {grouped.murderer_cover.length > 0 && (
            <div className="mb-6">
              <h4 className="text-red-400 text-sm font-semibold mb-3">⚠️ 凶手掩盖</h4>
              <div className="space-y-2">
                {grouped.murderer_cover.map((clue) => (
                  <InventoryClueCard
                    key={clue.id}
                    clue={clue}
                    isMurderer={isMurderer}
                    destroyedCount={destroyedCount}
                    onDestroy={onDestroy}
                  />
                ))}
              </div>
            </div>
          )}

          {myInventory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🎒</p>
              <p className="text-gray-600 text-sm">背包空空如也</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// 背包线索卡片
function InventoryClueCard({
  clue,
  isMurderer,
  destroyedCount,
  onDestroy,
}: {
  clue: Clue;
  isMurderer: boolean;
  destroyedCount: number;
  onDestroy: (clueId: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className="bg-gray-900/60 border border-gray-800/50 rounded-lg p-3 cursor-pointer
                   hover:border-gray-700/50 transition-all"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{clue.icon}</span>
          <p className="text-gray-300 text-sm flex-1 truncate">{clue.name}</p>
          {isMurderer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDestroy(clue.id);
              }}
              disabled={destroyedCount > 0}
              className={`px-2 py-0.5 text-xs rounded border transition-all ${
                destroyedCount > 0
                  ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-red-950/60 border-red-800/40 text-red-400 hover:bg-red-900/60 hover:text-red-300'
              }`}
            >
              {destroyedCount > 0 ? '已销毁' : '销毁'}
            </button>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${
            clue.type === 'key'
              ? 'bg-amber-950 text-amber-400 border-amber-700'
              : clue.type === 'murderer_cover'
                ? 'bg-red-950 text-red-400 border-red-700'
                : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}
        >
          {clue.type === 'key' ? '🔑 关键' : clue.type === 'murderer_cover' ? '⚠️ 掩盖' : '📋 普通'}
        </span>
      </div>

      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="w-full max-w-sm mx-4 bg-gray-950 border border-red-900/40 rounded-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{clue.icon}</span>
              <h4 className="text-red-400 font-bold">{clue.name}</h4>
            </div>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">{clue.description}</p>
            <button
              onClick={() => setShowDetail(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-sm transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function DiscussPage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const store = useGameStore();

  const {
    gameState,
    script,
    playerId,
    error,
    setError,
    connected,
  } = store;

  // UI 状态
  const [showBackpack, setShowBackpack] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [privateChatTarget, setPrivateChatTarget] = useState<string | null>(null);
  const [publicMessage, setPublicMessage] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');

  // 自动滚动
  const publicChatEndRef = useRef<HTMLDivElement>(null);
  const privateChatEndRef = useRef<HTMLDivElement>(null);

  // WebSocket 连接
  useEffect(() => {
    if (gameId && !connected) {
      store.connectWebSocket(gameId);
      store.fetchScript();
      store.fetchGameState(gameId).then(() => {
        // 如果 playerId 未设置，自动使用 host player
        const state = useGameStore.getState();
        if (!state.playerId && state.gameState) {
          const hostPlayer = state.gameState.players.find((p: Player) => p.isHost);
          if (hostPlayer) {
            store.setPlayerId(hostPlayer.id);
          }
        }
      });
    }
    return () => {
      // 不在此处断开，由路由切换时处理
    };
  }, [gameId, connected]);

  // 阶段变化时自动跳转
  useEffect(() => {
    if (!gameId) return;
    const phase = gameState?.phase;
    if (phase === 'vote') {
      navigate(`/vote/${gameId}`);
    }
    if (phase === 'result') {
      navigate(`/result/${gameId}`);
    }
  }, [gameState?.phase, gameId, navigate]);

  // 公聊自动滚动到底部
  useEffect(() => {
    publicChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.chatMessages?.public]);

  // 私聊自动滚动
  useEffect(() => {
    privateChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.chatMessages?.private, privateChatTarget]);

  const scriptData = script as ScriptData;
  const currentPlayer = gameState?.players.find((p: Player) => p.id === playerId);
  const isMurderer = currentPlayer?.isMurderer ?? false;
  const isHost = currentPlayer?.isHost ?? false;

  // 公聊消息
  const publicMessages = gameState?.chatMessages?.public ?? [];

  // 私聊消息（当前选中的目标）
  const privateMessages =
    privateChatTarget && gameState?.chatMessages?.private
      ? gameState.chatMessages.private[privateChatTarget] ?? []
      : [];

  // 玩家列表（排除自己）
  const otherPlayers = gameState?.players.filter((p: Player) => p.id !== playerId) ?? [];

  // 已销毁线索数
  const destroyedCount = gameState?.clues?.destroyed?.length ?? 0;

  // 笔记
  const myNotes = currentPlayer?.notes ?? [];

  // 发送公聊
  const handleSendPublic = useCallback(async () => {
    if (!gameId || !publicMessage.trim()) return;
    try {
      await store.sendPublicMessage(gameId, publicMessage.trim());
      setPublicMessage('');
    } catch {
      // error handled by store
    }
  }, [gameId, publicMessage, store]);

  // 发送私聊
  const handleSendPrivate = useCallback(async () => {
    if (!gameId || !privateChatTarget || !privateMessage.trim()) return;
    try {
      await store.sendPrivateMessage(gameId, privateChatTarget, privateMessage.trim());
      setPrivateMessage('');
    } catch {
      // error handled by store
    }
  }, [gameId, privateChatTarget, privateMessage, store]);

  // 保存笔记
  const handleSaveNote = useCallback(async () => {
    if (!gameId || !noteText.trim()) return;
    try {
      await store.addNote(gameId, noteText.trim());
      setNoteText('');
    } catch {
      // error handled by store
    }
  }, [gameId, noteText, store]);

  // 销毁线索
  const handleDestroyClue = useCallback(
    async (clueId: string) => {
      if (!gameId) return;
      if (destroyedCount > 0) {
        setError('你只能销毁1条线索');
        return;
      }
      try {
        await store.destroyClue(gameId, clueId);
        setShowBackpack(false);
      } catch {
        // error handled by store
      }
    },
    [gameId, destroyedCount, store, setError]
  );

  // 进入投票阶段
  const handleEnterVote = useCallback(async () => {
    if (!gameId) return;
    try {
      // 先让机器人发言
      await store.executeBotActions(gameId);
      await store.updatePhase(gameId, 'vote');
    } catch {
      // error handled by store
    }
  }, [gameId, store]);

  // 机器人发言
  const handleBotSpeak = useCallback(async () => {
    if (!gameId) return;
    try {
      await store.executeBotActions(gameId);
    } catch { /* error handled by store */ }
  }, [gameId, store]);

  // 是否有机器人
  const hasBots = gameState?.players.some((p: Player) => (p as any).isBot) ?? false;

  // 获取私聊目标玩家信息
  const privateChatPlayer = privateChatTarget
    ? gameState?.players.find((p: Player) => p.id === privateChatTarget)
    : null;

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <p className="text-gray-500 animate-pulse">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col relative z-10">
      <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
      {/* 顶部状态栏 */}
      <header className="bg-gray-900/90 border-b border-red-900/30 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-bold tracking-wider"
            style={{ color: '#DC2626', textShadow: '0 0 15px rgba(220,38,38,0.7)' }}
          >
            推理博弈
          </h1>
          <span className="text-gray-600 text-sm">
            {scriptData?.meta?.title ?? '归魂庄园'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 背包按钮 */}
          <button
            onClick={() => setShowBackpack(!showBackpack)}
            className={`relative px-3 py-1.5 rounded border transition-all text-sm ${
              showBackpack
                ? 'bg-red-950 border-red-700 text-red-300'
                : 'bg-gray-900 border-red-900/30 text-gray-400 hover:text-red-300 hover:border-red-800'
            }`}
          >
            🎒 背包 ({currentPlayer?.inventory?.length ?? 0})
          </button>

          {/* 笔记按钮 */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-1.5 rounded border transition-all text-sm ${
              showNotes
                ? 'bg-red-950 border-red-700 text-red-300'
                : 'bg-gray-900 border-red-900/30 text-gray-400 hover:text-red-300 hover:border-red-800'
            }`}
          >
            📝 笔记
          </button>

          {/* 主持人：进入投票 */}
          {isHost && (
            <>
              {hasBots && (
                <button
                  onClick={handleBotSpeak}
                  className="px-4 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-purple-400 text-sm
                             border border-purple-800/30 rounded transition-all"
                >
                  🤖 机器人发言
                </button>
              )}
              <button
                onClick={handleEnterVote}
                className="px-4 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 text-sm tracking-wider font-bold
                           border border-red-800/50 rounded transition-all hover:shadow-[0_0_20px_rgba(139,0,0,0.4)]"
              >
                进入投票阶段
              </button>
            </>
          )}

          <button
            onClick={() => navigate(`/lobby?mode=host&gameId=${gameId}`)}
            className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
          >
            返回大厅
          </button>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-2 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm flex items-center justify-between flex-shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ===== 1. 公聊大厅 (70%) ===== */}
        <div className="flex-[7] flex flex-col min-w-0">
          {/* 公聊标题 */}
          <div className="px-6 py-3 border-b border-red-900/20 bg-gray-900/30 flex-shrink-0">
            <h2
              className="text-base font-bold tracking-wider"
              style={{ color: '#DC2626', textShadow: '0 0 8px rgba(139,0,0,0.3)' }}
            >
              公聊大厅
            </h2>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {publicMessages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-700 text-sm">还没有消息，开始讨论吧...</p>
              </div>
            )}

            {publicMessages.map((msg: ChatMessage) => {
              const isMine = msg.from === playerId;
              const isSystem = msg.from === 'system';

              // 系统消息
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-gray-600 text-xs italic">{msg.content}</span>
                  </div>
                );
              }

              // 自己的消息（右对齐）
              if (isMine) {
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-gray-500 text-xs">{formatTime(msg.timestamp)}</span>
                      <span className="text-red-400 text-xs font-medium">
                        {msg.fromName}
                        {currentPlayer?.characterName && (
                          <span className="text-red-600 ml-1">[{currentPlayer.characterName}]</span>
                        )}
                      </span>
                    </div>
                    <div className="max-w-[70%] bg-red-950/40 border border-red-900/30 rounded-lg rounded-tr-none px-4 py-2">
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              }

              // 他人消息（左对齐）
              const sender = gameState.players.find((p: Player) => p.id === msg.from);
              return (
                <div key={msg.id} className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-400 text-xs font-medium">
                      {msg.fromName}
                      {sender?.characterName && (
                        <span className="text-gray-500 ml-1">[{sender.characterName}]</span>
                      )}
                    </span>
                    <span className="text-gray-600 text-xs">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="max-w-[70%] bg-gray-800/60 border border-gray-700/30 rounded-lg rounded-tl-none px-4 py-2">
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={publicChatEndRef} />
          </div>

          {/* 底部输入框 */}
          <div className="px-6 py-4 border-t border-red-900/20 bg-gray-900/30 flex-shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPublic();
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={publicMessage}
                onChange={(e) => setPublicMessage(e.target.value)}
                placeholder="输入你的推理..."
                className="flex-1 bg-gray-900 border border-red-900/30 rounded px-4 py-2.5 text-gray-300
                           text-sm placeholder-gray-600 focus:outline-none focus:border-red-800/50
                           transition-colors"
              />
              <button
                type="submit"
                disabled={!publicMessage.trim()}
                className="px-6 py-2.5 bg-red-900 hover:bg-red-800 text-red-200 text-sm font-bold
                           rounded border border-red-800/50 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed
                           hover:shadow-[0_0_15px_rgba(139,0,0,0.3)]"
              >
                发送
              </button>
            </form>
          </div>
        </div>

        {/* ===== 2. 私聊面板 (30%) ===== */}
        <div className="flex-[3] border-l border-red-900/20 flex flex-col min-w-0">
          {privateChatTarget ? (
            // 私聊窗口
            <>
              <div className="px-4 py-3 border-b border-red-900/20 bg-gray-900/30 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">正在与</span>
                  <span className="text-red-400 font-bold text-sm">
                    {privateChatPlayer?.characterName ?? privateChatPlayer?.name ?? '未知'}
                  </span>
                  <span className="text-gray-400 text-sm">私聊</span>
                </div>
                <button
                  onClick={() => setPrivateChatTarget(null)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                >
                  ✕ 关闭
                </button>
              </div>

              {/* 私聊消息列表 */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {privateMessages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-700 text-xs">开始私聊...</p>
                  </div>
                )}

                {privateMessages.map((msg: ChatMessage) => {
                  const isMine = msg.from === playerId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex flex-col max-w-[85%]">
                        <span className={`text-xs mb-0.5 ${isMine ? 'text-right text-gray-500' : 'text-left text-gray-500'}`}>
                          {isMine ? '我' : msg.fromName}
                          {' '}
                          {formatTime(msg.timestamp)}
                        </span>
                        <div
                          className={`rounded-lg px-3 py-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isMine
                              ? 'bg-red-950/40 border border-red-900/30 rounded-tr-none'
                              : 'bg-gray-800/60 border border-gray-700/30 rounded-tl-none'
                          }`}
                        >
                          <p className="text-gray-300">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={privateChatEndRef} />
              </div>

              {/* 私聊输入框 */}
              <div className="px-4 py-3 border-t border-red-900/20 bg-gray-900/30 flex-shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendPrivate();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={privateMessage}
                    onChange={(e) => setPrivateMessage(e.target.value)}
                    placeholder="输入私聊内容..."
                    className="flex-1 bg-gray-900 border border-red-900/30 rounded px-3 py-2 text-gray-300
                               text-sm placeholder-gray-600 focus:outline-none focus:border-red-800/50
                               transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!privateMessage.trim()}
                    className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-200 text-xs font-bold
                               rounded border border-red-800/50 transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed
                               hover:shadow-[0_0_10px_rgba(139,0,0,0.3)]"
                  >
                    发送
                  </button>
                </form>
              </div>
            </>
          ) : (
            // 玩家列表
            <>
              <div className="px-4 py-3 border-b border-red-900/20 bg-gray-900/30 flex-shrink-0">
                <h3 className="text-gray-400 text-sm font-bold tracking-wider">私聊</h3>
                <p className="text-gray-600 text-xs mt-1">点击玩家发起私聊</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {otherPlayers.length === 0 && (
                  <p className="text-gray-700 text-xs text-center py-8">暂无其他玩家</p>
                )}

                {otherPlayers.map((player: Player) => (
                  <button
                    key={player.id}
                    onClick={() => setPrivateChatTarget(player.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-800/50
                               bg-gray-900/60 hover:bg-gray-900/80 hover:border-red-900/30
                               transition-all text-left"
                  >
                    <span className="text-2xl">
                      {player.avatar ?? (player.isMurderer ? '🩸' : '👤')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-sm font-medium truncate">
                        {player.characterName ?? player.name}
                      </p>
                      <p className="text-gray-600 text-xs truncate">{player.name}</p>
                    </div>
                    <span className="text-gray-700 text-xs">→</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== 3. 笔记面板（底部可折叠） ===== */}
      {showNotes && (
        <div className="border-t border-red-900/20 bg-gray-900/50 flex-shrink-0">
          {/* 折叠标题栏 */}
          <button
            onClick={() => setShowNotes(false)}
            className="w-full px-6 py-2 flex items-center justify-between
                       hover:bg-gray-900/80 transition-colors"
          >
            <span className="text-gray-400 text-sm font-bold tracking-wider">📝 笔记</span>
            <span className="text-gray-600 text-xs">点击收起 ▲</span>
          </button>

          <div className="px-6 pb-4">
            <div className="flex gap-4" style={{ height: '160px' }}>
              {/* 输入区 */}
              <div className="flex-1 flex flex-col">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="记录你的推理和发现..."
                  className="flex-1 bg-gray-900 border border-red-900/30 rounded px-4 py-3 text-gray-300
                             text-sm placeholder-gray-600 focus:outline-none focus:border-red-800/50
                             resize-none transition-colors"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600 text-xs">
                    {myNotes.length > 0 ? `已有 ${myNotes.length} 条笔记` : '暂无笔记'}
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim()}
                    className="px-4 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-xs font-bold
                               rounded border border-red-800/50 transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    保存笔记
                  </button>
                </div>
              </div>

              {/* 已有笔记列表 */}
              <div className="flex-1 overflow-y-auto bg-gray-900/60 border border-red-900/20 rounded p-3">
                <p className="text-gray-600 text-xs mb-2">历史笔记</p>
                {myNotes.length === 0 ? (
                  <p className="text-gray-700 text-xs italic py-2">还没有笔记</p>
                ) : (
                  <div className="space-y-2">
                    {myNotes.map((note: string, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-900/80 border border-gray-800/50 rounded px-3 py-2"
                      >
                        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap break-words">
                          {note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 笔记折叠状态下的展开按钮 */}
      {!showNotes && (
        <div className="border-t border-red-900/20 bg-gray-900/50 flex-shrink-0">
          <button
            onClick={() => setShowNotes(true)}
            className="w-full px-6 py-2 flex items-center justify-center gap-2
                       hover:bg-gray-900/80 transition-colors text-gray-500 text-sm"
          >
            <span>📝</span>
            <span>笔记</span>
            <span className="text-gray-700 text-xs">▼</span>
          </button>
        </div>
      )}

      {/* 背包侧面板 */}
      {showBackpack && (
        <BackpackPanel
          script={scriptData}
          currentPlayer={currentPlayer}
          isMurderer={isMurderer}
          destroyedCount={destroyedCount}
          onClose={() => setShowBackpack(false)}
          onDestroy={handleDestroyClue}
        />
      )}
    </div>
  );
}
