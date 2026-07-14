import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type { ScriptData, Clue, ClueType, Player } from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

// 惊吓效果全屏覆盖组件
function ScareOverlay({
  effect,
  onComplete,
}: {
  effect: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'flash' | 'text' | 'done'>('flash');
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // 阶段1: 红屏闪烁
    const t1 = setTimeout(() => {
      setPhase('text');
      setShowText(true);
    }, 800);

    // 阶段2: 文字显示
    const t2 = setTimeout(() => {
      setShowText(false);
      setPhase('done');
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 红色闪烁背景 */}
      <div
        className={`absolute inset-0 bg-red-900/80 transition-opacity duration-300 ${
          phase === 'flash' ? 'opacity-100' : 'opacity-30'
        }`}
        style={{
          animation: phase === 'flash' ? 'scareFlash 0.15s ease-in-out 4' : 'none',
        }}
      />

      {/* 恐怖文字 */}
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p
            className="text-3xl font-bold text-red-400 text-center px-8"
            style={{
              textShadow: '0 0 30px rgba(220,38,38,0.8), 0 0 60px rgba(220,38,38,0.4)',
              animation: 'scareTextPulse 0.5s ease-in-out infinite',
            }}
          >
            {effect}
          </p>
        </div>
      )}

      <style>{`
        @keyframes scareFlash {
          0%, 100% { background-color: rgba(127, 0, 0, 0.9); }
          50% { background-color: rgba(0, 0, 0, 0.95); }
        }
        @keyframes scareTextPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// 线索类型标签
function ClueTypeBadge({ type }: { type: ClueType }) {
  const config: Record<ClueType, { label: string; color: string; icon: string }> = {
    key: { label: '关键线索', color: 'bg-amber-950 text-amber-400 border-amber-700', icon: '🔑' },
    normal: { label: '普通线索', color: 'bg-gray-800 text-gray-400 border-gray-700', icon: '📋' },
    murderer_cover: { label: '凶手掩盖', color: 'bg-red-950 text-red-400 border-red-700', icon: '⚠️' },
  };
  const c = config[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}

export default function SearchPage() {
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

  // 房间状态
  const [activeRoomId, setActiveRoomId] = useState('room_hall');

  // 模态框状态
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [showClueModal, setShowClueModal] = useState(false);

  // 惊吓效果
  const [scareEffect, setScareEffect] = useState<string | null>(null);

  // 背包面板
  const [showBackpack, setShowBackpack] = useState(false);

  // 房间切换惊吓
  const [roomScare, setRoomScare] = useState<string | null>(null);

  // 已读提示
  const [readClues, setReadClues] = useState<Set<string>>(new Set());

  // 连接 WebSocket 并加载数据
  useEffect(() => {
    if (gameId) {
      store.fetchScript();
      store.fetchGameState(gameId).then(() => {
        // 如果 playerId 未设置，自动使用 host player
        const state = useGameStore.getState();
        if (!state.playerId && state.gameState) {
          const hostPlayer = state.gameState.players.find((p: any) => p.isHost);
          if (hostPlayer) {
            store.setPlayerId(hostPlayer.id);
          }
        }
      });
      if (!connected) {
        store.connectWebSocket(gameId);
      }
    }
    return () => {
      // 清理
    };
  }, [gameId]);

  // 阶段变化时自动跳转
  useEffect(() => {
    if (!gameId) return;
    const phase = gameState?.phase;
    if (phase === 'discuss') {
      navigate(`/discuss/${gameId}`);
    }
    if (phase === 'vote') {
      navigate(`/vote/${gameId}`);
    }
    if (phase === 'result') {
      navigate(`/result/${gameId}`);
    }
  }, [gameState?.phase, gameId, navigate]);

  // 自动设置第一个房间
  useEffect(() => {
    const scriptData = script as ScriptData;
    if (scriptData?.rooms?.length) {
      setActiveRoomId(scriptData.rooms[0].id);
    }
  }, [script]);

  const scriptData = script as ScriptData;
  const rooms = scriptData?.rooms ?? [];
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  // 当前玩家
  const currentPlayer = gameState?.players.find((p: Player) => p.id === playerId);
  const isMurderer = currentPlayer?.isMurderer ?? false;
  const isHost = currentPlayer?.isHost ?? false;

  // 已收集的线索ID
  const collectedClueIds = new Set(currentPlayer?.inventory ?? []);
  // 已销毁的线索ID
  const destroyedClueIds = new Set(gameState?.clues?.destroyed ?? []);

  // 统计
  const totalClues = rooms.reduce((sum, r) => sum + r.props.length, 0);
  const allCollectedIds = new Set(
    gameState?.clues?.collected?.map((c: { clueId: string }) => c.clueId) ?? []
  );

  // 切换房间
  const handleRoomChange = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      // 随机触发房间惊吓
      const targetRoom = rooms.find((r) => r.id === roomId);
      if (targetRoom?.scareTrigger && Math.random() < 0.25) {
        setRoomScare(targetRoom.scareTrigger);
        setTimeout(() => setRoomScare(null), 2500);
      }
    },
    [rooms]
  );

  // 点击道具
  const handleClueClick = useCallback(
    (clue: Clue) => {
      // 已销毁的不能点击
      if (destroyedClueIds.has(clue.id)) return;

      setSelectedClue(clue);
      setShowClueModal(true);
    },
    [destroyedClueIds]
  );

  // 收集线索
  const handleCollectClue = useCallback(async () => {
    if (!gameId || !selectedClue) return;
    try {
      await store.collectClue(gameId, selectedClue.id);
      setReadClues((prev) => new Set(prev).add(selectedClue.id));
      setShowClueModal(false);
      setSelectedClue(null);
    } catch {
      // error 由 store 处理
    }
  }, [gameId, selectedClue, store]);

  // 销毁线索
  const handleDestroyClue = useCallback(
    async (clueId: string) => {
      if (!gameId) return;
      // 检查是否已销毁过
      if (destroyedClueIds.size > 0) {
        setError('你只能销毁1条线索');
        return;
      }
      try {
        await store.destroyClue(gameId, clueId);
        setShowBackpack(false);
      } catch {
        // error 由 store 处理
      }
    },
    [gameId, destroyedClueIds, store, setError]
  );

  // 显示惊吓效果
  const handleScareEffect = useCallback(() => {
    if (selectedClue?.scareEffect) {
      setShowClueModal(false);
      setScareEffect(selectedClue.scareEffect);
    }
  }, [selectedClue]);

  // 已收集的线索列表
  const myInventory = currentPlayer?.inventory ?? [];
  const inventoryClues: Clue[] = [];
  for (const room of rooms) {
    for (const prop of room.props) {
      if (myInventory.includes(prop.id)) {
        inventoryClues.push(prop);
      }
    }
  }

  // 按类型分组
  const groupedInventory: Record<ClueType, Clue[]> = {
    key: [],
    normal: [],
    murderer_cover: [],
  };
  for (const clue of inventoryClues) {
    groupedInventory[clue.type].push(clue);
  }

  // 推进阶段
  const handleAdvancePhase = useCallback(async () => {
    if (!gameId) return;
    try {
      // 先执行机器人搜证
      await store.executeBotActions(gameId);
      await store.updatePhase(gameId, 'discuss');
    } catch {
      // error 由 store 处理
    }
  }, [gameId, store]);

  // 机器人自动搜证
  const handleBotSearch = useCallback(async () => {
    if (!gameId) return;
    try {
      await store.executeBotActions(gameId);
      setError('🤖 机器人已完成自动搜证！');
      setTimeout(() => setError(null), 2000);
    } catch { /* error 由 store 处理 */ }
  }, [gameId, store, setError]);

  // 是否有机器人
  const hasBots = gameState?.players.some((p: Player) => (p as any).isBot) ?? false;

  // 如果没有 gameId 或 gameState，显示加载
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
      <header className="bg-gray-900/90 border-b border-red-900/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-bold tracking-wider"
            style={{
              color: '#DC2626',
              textShadow: '0 0 15px rgba(220,38,38,0.7)',
            }}
          >
            实景搜证
          </h1>
          <span className="text-gray-600 text-sm">
            {scriptData?.meta?.title ?? '归魂庄园'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 线索进度 */}
          <div className="text-sm text-gray-500">
            已收集: {allCollectedIds.size}/{totalClues}
          </div>

          {/* 背包按钮 */}
          <button
            onClick={() => setShowBackpack(!showBackpack)}
            className={`relative px-3 py-1.5 rounded border transition-all text-sm ${
              showBackpack
                ? 'bg-red-950 border-red-700 text-red-300'
                : 'bg-gray-900 border-red-900/30 text-gray-400 hover:text-red-300 hover:border-red-800'
            }`}
          >
            🎒 背包 ({myInventory.length})
          </button>

          {/* 返回按钮 */}
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
        <div className="mx-6 mt-4 px-4 py-2 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      {/* 主内容区：三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧房间列表 */}
        <aside className="w-52 flex-shrink-0 bg-gray-900/50 border-r border-red-900/20 overflow-y-auto">
          <div className="p-3">
            <p className="text-gray-600 text-xs tracking-wider mb-3 px-2">探索地点</p>
            <nav className="space-y-1">
              {rooms.map((room) => {
                const isActive = room.id === activeRoomId;
                const roomCollectedCount = room.props.filter((p) =>
                  allCollectedIds.has(p.id)
                ).length;
                return (
                  <button
                    key={room.id}
                    onClick={() => handleRoomChange(room.id)}
                    className={`w-full text-left px-3 py-3 rounded transition-all duration-200 ${
                      isActive
                        ? 'bg-red-950/40 border border-red-800/50 text-red-300'
                        : 'border border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{room.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{room.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {roomCollectedCount}/{room.props.length} 线索
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 中间房间详情 */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeRoom && (
            <div>
              {/* 房间标题 */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{activeRoom.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-red-400 tracking-wider">
                    {activeRoom.name}
                  </h2>
                </div>
              </div>

              {/* 房间描述 */}
              <p className="text-gray-400 italic leading-relaxed mb-8 text-sm border-l-2 border-red-900/40 pl-4">
                {activeRoom.description}
              </p>

              {/* 道具网格 */}
              <div>
                <p className="text-gray-500 text-xs tracking-wider mb-4">
                  可调查物品 ({activeRoom.props.length})
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {activeRoom.props.map((prop) => {
                    const isCollected = allCollectedIds.has(prop.id);
                    const isMine = collectedClueIds.has(prop.id);
                    const isDestroyed = destroyedClueIds.has(prop.id);
                    const isNew = !readClues.has(prop.id);

                    return (
                      <button
                        key={prop.id}
                        onClick={() => handleClueClick(prop)}
                        disabled={isDestroyed}
                        className={`relative text-left p-4 rounded-lg border transition-all duration-200 ${
                          isDestroyed
                            ? 'bg-gray-900/30 border-red-900/10 opacity-40 cursor-not-allowed'
                            : isCollected
                              ? 'bg-gray-900/50 border-gray-700/30 hover:border-gray-600'
                              : isMine
                                ? 'bg-green-950/30 border-green-800/40 hover:border-green-700'
                                : 'bg-gray-900/60 border-red-900/30 hover:border-red-800/50 hover:bg-gray-900/80'
                        }`}
                      >
                        {/* 闪烁提示（未收集的新线索） */}
                        {!isCollected && !isDestroyed && isNew && (
                          <div className="absolute inset-0 rounded-lg pointer-events-none">
                            <div className="absolute inset-0 rounded-lg animate-pulse bg-red-500/5" />
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{prop.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className={`text-sm font-semibold ${
                                  isDestroyed
                                    ? 'text-gray-700 line-through'
                                    : isCollected
                                      ? 'text-gray-500'
                                      : 'text-gray-300'
                                }`}
                              >
                                {prop.name}
                              </p>
                              <ClueTypeBadge type={prop.type} />
                            </div>

                            {/* 状态标记 */}
                            <div className="flex items-center gap-2 mt-1">
                              {isMine && !isDestroyed && (
                                <span className="text-green-500 text-xs">✅ 已收集</span>
                              )}
                              {isCollected && !isMine && !isDestroyed && (
                                <span className="text-gray-600 text-xs">📋 已被他人收集</span>
                              )}
                              {isDestroyed && (
                                <span className="text-red-500 text-xs line-through">❌ 已销毁</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* 右侧快捷信息面板 */}
        <aside className="w-56 flex-shrink-0 bg-gray-900/50 border-l border-red-900/20 p-4 overflow-y-auto">
          <p className="text-gray-600 text-xs tracking-wider mb-3">我的信息</p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">角色</p>
              <p className="text-red-400 font-bold">{currentPlayer?.characterName ?? currentPlayer?.name}</p>
            </div>
            {currentPlayer?.isMurderer && (
              <div className="px-2 py-1.5 bg-red-950/40 border border-red-800/30 rounded text-xs text-red-400">
                ⚠️ 你是凶手 - 可以销毁1条线索
              </div>
            )}
            <div>
              <p className="text-gray-500">已收集</p>
              <p className="text-gray-300">{myInventory.length} 条线索</p>
            </div>
            {currentPlayer?.hiddenTask && (
              <div>
                <p className="text-gray-500">隐藏任务</p>
                <p className="text-red-500/80 text-xs mt-1 leading-relaxed">
                  {currentPlayer.hiddenTask.title}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 底部：主持人推进按钮 */}
      {isHost && (
        <footer className="bg-gray-900/90 border-t border-red-900/30 px-6 py-4 flex justify-center gap-4">
          {hasBots && (
            <button
              onClick={handleBotSearch}
              className="px-6 py-3 bg-purple-950/40 hover:bg-purple-900/40 text-purple-400 text-sm
                         border border-purple-800/30 rounded transition-all"
            >
              🤖 机器人自动搜证
            </button>
          )}
          <button
            onClick={handleAdvancePhase}
            className="px-10 py-3 bg-red-950 hover:bg-red-900 text-red-300 text-lg tracking-[0.2em] font-bold
                       border border-red-800/50 rounded transition-all duration-300
                       hover:shadow-[0_0_30px_rgba(139,0,0,0.4)]"
          >
            进入推理阶段
          </button>
        </footer>
      )}

      {/* 线索详情模态框 */}
      {showClueModal && selectedClue && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setShowClueModal(false);
            setSelectedClue(null);
          }}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-gray-950 border border-red-900/40 rounded-lg p-6
                       shadow-[0_0_40px_rgba(139,0,0,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => {
                setShowClueModal(false);
                setSelectedClue(null);
              }}
              className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors"
            >
              ✕
            </button>

            {/* 线索信息 */}
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl">{selectedClue.icon}</span>
              <div>
                <h3 className="text-red-400 text-lg font-bold mb-1">{selectedClue.name}</h3>
                <ClueTypeBadge type={selectedClue.type} />
              </div>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {selectedClue.description}
            </p>

            {/* 标签 */}
            {selectedClue.tags && selectedClue.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedClue.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-red-950/30 border border-red-900/20 rounded text-xs text-red-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              {/* 如果有惊吓效果，先触发惊吓 */}
              {selectedClue.scareEffect && (
                <button
                  onClick={handleScareEffect}
                  className="flex-1 px-4 py-2.5 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all text-sm"
                >
                  深入调查
                </button>
              )}
              <button
                onClick={handleCollectClue}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700/50 transition-all text-sm"
              >
                收集线索
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全屏惊吓效果 */}
      {scareEffect && (
        <ScareOverlay effect={scareEffect} onComplete={() => setScareEffect(null)} />
      )}

      {/* 房间切换惊吓 */}
      {roomScare && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-red-900/40 animate-pulse" />
          <p
            className="relative text-2xl font-bold text-red-400 text-center px-8 z-10"
            style={{
              textShadow: '0 0 30px rgba(220,38,38,0.8)',
              animation: 'scareTextPulse 0.5s ease-in-out infinite',
            }}
          >
            {roomScare}
          </p>
        </div>
      )}

      {/* 背包侧面板 */}
      {showBackpack && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-30 bg-black/60"
            onClick={() => setShowBackpack(false)}
          />

          {/* 侧面板 */}
          <div
            className="fixed right-0 top-0 bottom-0 z-30 w-80 bg-gray-950 border-l border-red-900/30
                       shadow-[-20px_0_40px_rgba(0,0,0,0.5)] overflow-y-auto
                       animate-[slideInRight_0.3s_ease-out]"
          >
            <div className="p-5">
              {/* 标题 */}
              <div className="flex items-center justify-between mb-6">
                <h3
                  className="text-lg font-bold tracking-wider"
                  style={{
                    color: '#DC2626',
                    textShadow: '0 0 12px rgba(220,38,38,0.6)',
                  }}
                >
                  我的背包
                </h3>
                <button
                  onClick={() => setShowBackpack(false)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 线索数统计 */}
              <p className="text-gray-500 text-xs mb-4">
                已收集 {myInventory.length} 条线索
              </p>

              {/* 关键线索 */}
              {groupedInventory.key.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-amber-400 text-sm font-semibold mb-3">🔑 关键线索</h4>
                  <div className="space-y-3">
                    {groupedInventory.key.map((clue) => (
                      <ClueInventoryCard
                        key={clue.id}
                        clue={clue}
                        isMurderer={isMurderer}
                        destroyedCount={destroyedClueIds.size}
                        onDestroy={handleDestroyClue}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 普通线索 */}
              {groupedInventory.normal.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-gray-400 text-sm font-semibold mb-3">📋 普通线索</h4>
                  <div className="space-y-3">
                    {groupedInventory.normal.map((clue) => (
                      <ClueInventoryCard
                        key={clue.id}
                        clue={clue}
                        isMurderer={isMurderer}
                        destroyedCount={destroyedClueIds.size}
                        onDestroy={handleDestroyClue}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 凶手掩盖 */}
              {groupedInventory.murderer_cover.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-red-400 text-sm font-semibold mb-3">⚠️ 凶手掩盖</h4>
                  <div className="space-y-3">
                    {groupedInventory.murderer_cover.map((clue) => (
                      <ClueInventoryCard
                        key={clue.id}
                        clue={clue}
                        isMurderer={isMurderer}
                        destroyedCount={destroyedClueIds.size}
                        onDestroy={handleDestroyClue}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 空背包 */}
              {myInventory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-4">🎒</p>
                  <p className="text-gray-600 text-sm">背包空空如也</p>
                  <p className="text-gray-700 text-xs mt-1">去各个房间收集线索吧</p>
                </div>
              )}
            </div>
          </div>

          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}

      {/* 全局动画 */}
      <style>{`
        @keyframes scareTextPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// 背包中的线索卡片
function ClueInventoryCard({
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
        <span className="inline-block">
          <ClueTypeBadge type={clue.type} />
        </span>
      </div>

      {/* 详情弹出 */}
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
            <ClueTypeBadge type={clue.type} />
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
