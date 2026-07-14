import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type { ScriptData, GamePhase, Player, ScareEvent, HiddenClue } from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

const PHASES: { key: GamePhase; label: string; icon: string }[] = [
  { key: 'search', label: '搜证', icon: '🔍' },
  { key: 'discuss', label: '推理', icon: '💬' },
  { key: 'vote', label: '投票', icon: '🗳️' },
  { key: 'result', label: '结果', icon: '📊' },
];

const BGM_OPTIONS = [
  { key: 'default', label: '默认氛围', icon: '🎵' },
  { key: 'tense', label: '紧张音效', icon: '🎻' },
  { key: 'scare', label: '惊吓音效', icon: '💀' },
] as const;

export default function AdminPage() {
  const { gameId } = useParams<{ gameId: string }>();

  const store = useGameStore();
  const {
    gameState,
    script,
    error,
    setError,
    connected,
  } = store;

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedHiddenClueId, setSelectedHiddenClueId] = useState('');
  const [activeBgm, setActiveBgm] = useState<string>('default');
  const [grantedClueFeedback, setGrantedClueFeedback] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scriptData = script as ScriptData;
  const scareEvents = scriptData?.scareEvents ?? [];
  const hiddenClues = scriptData?.hiddenClues ?? [];
  const rooms = scriptData?.rooms ?? [];

  const currentPhase = gameState?.phase ?? 'lobby';
  const players = gameState?.players ?? [];
  const onlineCount = players.length;
  const triggeredScares = new Set(gameState?.scareEventsTriggered ?? []);
  const hiddenCluesGranted = gameState?.hiddenCluesGranted ?? [];
  const collectedClues = gameState?.clues?.collected ?? [];
  const destroyedClues = new Set(gameState?.clues?.destroyed ?? []);

  // 已投票玩家ID集合
  const votedPlayerIds = new Set((gameState?.votes ?? []).map((v: { voterId: string }) => v.voterId));

  // WebSocket 连接
  useEffect(() => {
    if (gameId && !connected) {
      store.connectWebSocket(gameId);
      store.fetchScript();
    }
    return () => {
      store.disconnectWebSocket();
    };
  }, [gameId, connected]);

  // 3秒轮询刷新
  useEffect(() => {
    if (!gameId) return;
    pollRef.current = setInterval(() => {
      store.fetchGameState(gameId);
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId]);

  // 阶段控制
  const handlePhaseChange = useCallback(
    async (phase: GamePhase) => {
      if (!gameId) return;
      try {
        await store.updatePhase(gameId, phase);
      } catch {
        // error handled by store
      }
    },
    [gameId, store]
  );

  // 触发恐怖事件
  const handleTriggerScare = useCallback(
    async (eventId: string) => {
      if (!gameId) return;
      try {
        await store.triggerScareEvent(gameId, eventId);
      } catch {
        // error handled by store
      }
    },
    [gameId, store]
  );

  // 发放隐藏线索
  const handleGrantHiddenClue = useCallback(async () => {
    if (!gameId || !selectedPlayerId || !selectedHiddenClueId) return;
    try {
      await store.grantHiddenClue(gameId, selectedPlayerId, selectedHiddenClueId);
      const clue = hiddenClues.find((c) => c.id === selectedHiddenClueId);
      const player = players.find((p: Player) => p.id === selectedPlayerId);
      setGrantedClueFeedback(
        `已向 ${player?.name ?? selectedPlayerId} 发放线索: ${clue?.name ?? selectedHiddenClueId}`
      );
      setTimeout(() => setGrantedClueFeedback(null), 3000);
      setSelectedHiddenClueId('');
    } catch {
      // error handled by store
    }
  }, [gameId, selectedPlayerId, selectedHiddenClueId, hiddenClues, players, store]);

  // BGM 控制
  const handleBgmChange = useCallback((key: string) => {
    setActiveBgm(key);
    console.log(`[Admin BGM] 切换音效: ${key}`);
    // 实际音效由前端 Audio API 播放
  }, []);

  // 检查隐藏线索是否已发放给某玩家
  const isClueGranted = useCallback(
    (clueId: string, playerId: string) => {
      return hiddenCluesGranted.some(
        (g: { clueId: string; playerId: string }) => g.clueId === clueId && g.playerId === playerId
      );
    },
    [hiddenCluesGranted]
  );

  // 获取玩家收集的线索数
  const getPlayerClueCount = useCallback(
    (player: Player) => player.inventory.length,
    []
  );

  // 每个房间线索统计
  const getRoomClueStats = useCallback(() => {
    return rooms.map((room) => {
      const total = room.props.length;
      const collected = room.props.filter((p: { id: string }) =>
        collectedClues.some((c: { clueId: string }) => c.clueId === p.id)
      ).length;
      const destroyed = room.props.filter((p: { id: string }) =>
        destroyedClues.has(p.id)
      ).length;
      return { room, total, collected, destroyed };
    });
  }, [rooms, collectedClues, destroyedClues]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <div className="text-center">
          <p className="text-purple-400 text-lg animate-pulse mb-2">加载游戏数据...</p>
          <p className="text-gray-600 text-sm">正在连接服务器</p>
        </div>
      </div>
    );
  }

  const roomStats = getRoomClueStats();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col relative z-10">
      <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
      {/* 顶部标题栏 */}
      <header className="bg-gray-900/90 border-b border-purple-900/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-bold tracking-wider"
            style={{
              color: '#7C3AED',
              textShadow: '0 0 15px rgba(124,58,237,0.4)',
            }}
          >
            主持人控制台
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
              connected
                ? 'bg-green-950/60 text-green-400 border border-green-800/40'
                : 'bg-red-950/60 text-red-400 border border-red-800/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            {connected ? '已连接' : '未连接'}
          </span>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-2 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-300 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* 发放反馈 */}
      {grantedClueFeedback && (
        <div className="mx-6 mt-4 px-4 py-2 bg-purple-950/60 border border-purple-800/50 rounded text-purple-300 text-sm">
          {grantedClueFeedback}
        </div>
      )}

      {/* 主内容区：两栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== 左侧：游戏状态监控 (60%) ===== */}
        <div className="w-[60%] overflow-y-auto p-6 space-y-6">
          {/* 1. 游戏信息卡片 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">游戏信息</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-xs mb-1">游戏 ID</p>
                <p className="text-2xl font-bold text-red-500 tracking-wider font-mono">
                  {gameId}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">当前阶段</p>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                    currentPhase === 'search'
                      ? 'bg-amber-950 text-amber-400 border border-amber-700'
                      : currentPhase === 'discuss'
                        ? 'bg-blue-950 text-blue-400 border border-blue-700'
                        : currentPhase === 'vote'
                          ? 'bg-red-950 text-red-400 border border-red-700'
                          : currentPhase === 'result'
                            ? 'bg-green-950 text-green-400 border border-green-700'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {currentPhase === 'search'
                    ? '搜证'
                    : currentPhase === 'discuss'
                      ? '推理'
                      : currentPhase === 'vote'
                        ? '投票'
                        : currentPhase === 'result'
                          ? '结果'
                          : currentPhase}
                </span>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">在线玩家</p>
                <p className="text-2xl font-bold text-purple-400">{onlineCount}</p>
              </div>
            </div>
          </div>

          {/* 2. 玩家状态列表 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">
              玩家状态 ({players.length})
            </h2>
            <div className="space-y-3">
              {players.map((player: Player) => {
                const isVoted = votedPlayerIds.has(player.id);
                const clueCount = getPlayerClueCount(player);
                return (
                  <div
                    key={player.id}
                    className={`bg-gray-900/60 border rounded-lg p-4 transition-all ${
                      player.isMurderer
                        ? 'border-red-900/50 hover:border-red-800/60'
                        : 'border-gray-800/50 hover:border-gray-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* 头像 */}
                        <div className="w-10 h-10 rounded-full bg-purple-950/60 border border-purple-800/30 flex items-center justify-center text-lg">
                          {player.avatar ?? '👤'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-gray-200 font-semibold">{player.name}</p>
                            {player.isMurderer && (
                              <span className="text-red-500 text-sm" title="凶手">
                                凶手
                              </span>
                            )}
                            {player.isHost && (
                              <span className="text-purple-400 text-xs px-1.5 py-0.5 bg-purple-950/50 border border-purple-800/30 rounded">
                                主持人
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-xs">
                              {player.characterName ?? player.roleName ?? '未分配角色'}
                            </span>
                            {player.roleName && (
                              <span className="text-gray-600 text-xs">
                                ({player.roleName})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 状态指示器 */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800/30">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600 text-xs">线索:</span>
                        <span className="text-purple-400 text-sm font-semibold">
                          {clueCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-600 text-xs">投票:</span>
                        {isVoted ? (
                          <span className="text-green-400 text-sm">已投票</span>
                        ) : (
                          <span className="text-gray-500 text-sm">未投票</span>
                        )}
                      </div>
                      {player.hiddenTask && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 text-xs">隐藏任务:</span>
                          <span className="text-amber-400 text-xs truncate max-w-[120px]" title={player.hiddenTask.title}>
                            {player.hiddenTask.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {players.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-sm">暂无玩家</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 线索收集概览 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">线索收集概览</h2>
            <div className="space-y-3">
              {roomStats.map(({ room, total, collected, destroyed }) => (
                <div
                  key={room.id}
                  className="bg-gray-900/60 border border-gray-800/50 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{room.icon}</span>
                      <span className="text-gray-300 text-sm">{room.name}</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {collected}/{total}
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-700 rounded-full transition-all duration-500"
                      style={{
                        width: total > 0 ? `${(collected / total) * 100}%` : '0%',
                      }}
                    />
                  </div>
                  {destroyed > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-red-500 text-xs">已销毁线索</span>
                      <span className="text-red-400 text-xs font-semibold">{destroyed}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 右侧：控制面板 (40%) ===== */}
        <div className="w-[40%] border-l border-purple-900/20 overflow-y-auto p-6 space-y-6">
          {/* 1. 阶段控制 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">阶段控制</h2>
            <div className="grid grid-cols-2 gap-2">
              {PHASES.map(({ key, label, icon }) => {
                const isActive = currentPhase === key;
                const phaseOrder = ['search', 'discuss', 'vote', 'result'];
                const currentIndex = phaseOrder.indexOf(currentPhase);
                const btnIndex = phaseOrder.indexOf(key);
                // 不允许跳回之前的阶段，只允许前进
                const isDisabled = btnIndex <= currentIndex;

                return (
                  <button
                    key={key}
                    onClick={() => handlePhaseChange(key)}
                    disabled={isDisabled}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all text-sm font-semibold ${
                      isActive
                        ? 'bg-purple-900/60 border-purple-600 text-purple-200 ring-1 ring-purple-500/50'
                        : isDisabled
                          ? 'bg-gray-900/40 border-gray-800/50 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-900/60 border-purple-900/30 text-gray-400 hover:bg-purple-950/40 hover:text-purple-300 hover:border-purple-700/50'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 恐怖事件触发 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">
              恐怖事件 ({scareEvents.length})
            </h2>
            <div className="space-y-2">
              {scareEvents.map((event: ScareEvent) => {
                const isTriggered = triggeredScares.has(event.id);
                return (
                  <div
                    key={event.id}
                    className={`bg-gray-900/60 border rounded-lg p-3 transition-all ${
                      isTriggered
                        ? 'border-gray-800/30 opacity-50'
                        : 'border-gray-800/50 hover:border-purple-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl flex-shrink-0">{event.icon}</span>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold ${
                              isTriggered ? 'text-gray-500' : 'text-gray-300'
                            }`}
                          >
                            {event.name}
                          </p>
                          <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTriggerScare(event.id)}
                        disabled={isTriggered}
                        className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                          isTriggered
                            ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/30'
                            : 'bg-purple-900 hover:bg-purple-800 text-purple-300 border border-purple-700/50'
                        }`}
                      >
                        {isTriggered ? '已触发' : '触发'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {scareEvents.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-600 text-sm">暂无可触发事件</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 隐藏线索发放 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">
              隐藏线索发放 ({hiddenClues.length})
            </h2>

            {/* 选择目标玩家 */}
            <div className="mb-3">
              <label className="block text-gray-500 text-xs mb-1.5">目标玩家</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-sm
                           focus:outline-none focus:border-purple-700/50 transition-colors"
              >
                <option value="">-- 选择玩家 --</option>
                {players.map((p: Player) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.characterName ?? p.roleName ?? '未分配'})
                  </option>
                ))}
              </select>
            </div>

            {/* 选择隐藏线索 */}
            <div className="mb-4">
              <label className="block text-gray-500 text-xs mb-1.5">隐藏线索</label>
              <select
                value={selectedHiddenClueId}
                onChange={(e) => setSelectedHiddenClueId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-gray-300 text-sm
                           focus:outline-none focus:border-purple-700/50 transition-colors"
              >
                <option value="">-- 选择线索 --</option>
                {hiddenClues.map((clue: HiddenClue) => {
                  const alreadyGranted = Boolean(
                    selectedPlayerId && isClueGranted(clue.id, selectedPlayerId)
                  );
                  return (
                    <option
                      key={clue.id}
                      value={clue.id}
                      disabled={alreadyGranted}
                    >
                      {clue.name} {alreadyGranted ? '(已发放)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 发放按钮 */}
            <button
              onClick={handleGrantHiddenClue}
              disabled={!selectedPlayerId || !selectedHiddenClueId}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                selectedPlayerId && selectedHiddenClueId
                  ? 'bg-purple-900 hover:bg-purple-800 text-purple-300 border border-purple-700/50'
                  : 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/30'
              }`}
            >
              发放隐藏线索
            </button>

            {/* 已发放线索列表 */}
            {hiddenCluesGranted.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800/30">
                <p className="text-gray-600 text-xs mb-2">已发放记录</p>
                <div className="space-y-1.5">
                  {hiddenCluesGranted.map((granted: { clueId: string; playerId: string }, idx: number) => {
                    const clue = hiddenClues.find((c) => c.id === granted.clueId);
                    const player = players.find((p: Player) => p.id === granted.playerId);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900/40 rounded px-2 py-1"
                      >
                        <span className="text-purple-400 truncate">
                          {clue?.name ?? granted.clueId}
                        </span>
                        <span>→</span>
                        <span className="text-gray-400 truncate">
                          {player?.name ?? granted.playerId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hiddenClues.length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-600 text-sm">暂无可发放的隐藏线索</p>
              </div>
            )}
          </div>

          {/* 4. BGM/音效控制 */}
          <div className="bg-gray-900 border border-purple-900/30 rounded-lg p-5">
            <h2 className="text-gray-500 text-xs tracking-wider mb-4">BGM / 音效控制</h2>
            <div className="flex gap-2">
              {BGM_OPTIONS.map(({ key, label, icon }) => {
                const isActive = activeBgm === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleBgmChange(key)}
                    className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border transition-all text-xs ${
                      isActive
                        ? 'bg-purple-900/60 border-purple-600 text-purple-200 ring-1 ring-purple-500/50'
                        : 'bg-gray-900/60 border-gray-800/50 text-gray-500 hover:border-purple-800/40 hover:text-purple-400'
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-gray-700 text-xs mt-3 text-center">
              音效通过前端 Audio API 播放
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
