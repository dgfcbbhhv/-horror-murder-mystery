import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type { ScriptData, Player } from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

function TypewriterText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current <= text.length) {
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <div className="text-gray-400 leading-relaxed whitespace-pre-wrap text-base italic">
      {displayed}
      {indexRef.current < text.length && (
        <span className="inline-block w-0.5 h-4 bg-red-500 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'create';
  const hostGameIdParam = searchParams.get('gameId') || '';

  const store = useGameStore();
  const {
    gameId,
    playerId,
    gameState,
    script,
    error,
    setError,
    connected,
  } = store;

  // 输入状态
  const [hostName, setHostName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');

  // 游戏状态
  const [gameCreated, setGameCreated] = useState(false);
  const [gameJoined, setGameJoined] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showOpening, setShowOpening] = useState(false);

  // 轮询定时器
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ================================================================
  // 主持人后台模式 - 连接 WebSocket 并加载数据
  // ================================================================
  useEffect(() => {
    if (mode === 'host' && hostGameIdParam) {
      store.setGameId(hostGameIdParam);
      store.fetchScript();
      store.connectWebSocket(hostGameIdParam);
      store.fetchGameState(hostGameIdParam).then(() => {
        // 从 gameState 中找到 host player 并设置 playerId
        const state = useGameStore.getState();
        const hostPlayer = state.gameState?.players.find((p: Player) => p.isHost);
        if (hostPlayer) {
          store.setPlayerId(hostPlayer.id);
        }
      });
      setWsConnected(true);
      setGameJoined(true);
    }
  }, [mode, hostGameIdParam]);

  // 当 gameId 存在且 WebSocket 未连接时自动连接
  useEffect(() => {
    if (gameId && !wsConnected) {
      store.connectWebSocket(gameId);
      setWsConnected(true);
      store.fetchScript();
    }
  }, [gameId, wsConnected]);

  // ================================================================
  // 加入游戏模式 - 轮询等待主持人开始游戏
  // ================================================================
  useEffect(() => {
    if (mode === 'join' && gameJoined && gameId && !wsConnected) {
      store.connectWebSocket(gameId);
      setWsConnected(true);
      store.fetchScript();
    }
  }, [mode, gameJoined, gameId, wsConnected]);

  // 加入游戏后的轮询（WebSocket 未连接时作为后备）
  useEffect(() => {
    if (mode === 'join' && gameJoined && gameId && !connected) {
      pollRef.current = setInterval(() => {
        store.fetchGameState(gameId);
      }, 2000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [mode, gameJoined, gameId, connected]);

  // ================================================================
  // 自动跳转：phase 变化时导航到对应页面
  // ================================================================
  useEffect(() => {
    const effectiveGameId = gameId || hostGameIdParam;
    const phase = gameState?.phase;
    if (!phase || !effectiveGameId) return;

    if (phase === 'search') {
      if (showOpening) {
        const timer = setTimeout(() => {
          navigate(`/search/${effectiveGameId}`);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }

    if (phase === 'discuss') {
      navigate(`/discuss/${effectiveGameId}`);
    }

    if (phase === 'vote') {
      navigate(`/vote/${effectiveGameId}`);
    }

    if (phase === 'result') {
      navigate(`/result/${effectiveGameId}`);
    }
  }, [gameState?.phase, gameId, hostGameIdParam, showOpening, navigate]);

  // ================================================================
  // 创建游戏
  // ================================================================
  const handleCreateGame = useCallback(async () => {
    if (!hostName.trim()) {
      setError('请输入主持人名字');
      return;
    }
    try {
      await store.createGame(hostName.trim(), 4);
      setGameCreated(true);
    } catch {
      // error 由 store 处理
    }
  }, [hostName, store, setError]);

  // ================================================================
  // 加入游戏
  // ================================================================
  const handleJoinGame = useCallback(async () => {
    if (!joinGameId.trim() || !joinPlayerName.trim()) {
      setError('请输入游戏ID和玩家名字');
      return;
    }
    try {
      await store.joinGame(joinGameId.trim(), joinPlayerName.trim());
      setGameJoined(true);
    } catch {
      // error 由 store 处理
    }
  }, [joinGameId, joinPlayerName, store, setError]);

  // ================================================================
  // 开始游戏 - 关键修复：startGame 后 phase 变为 search，
  // 需要设置 showOpening 来触发角色卡片显示
  // ================================================================
  const handleStartGame = useCallback(async () => {
    const effectiveGameId = gameId || hostGameIdParam;
    if (!effectiveGameId) return;
    try {
      await store.startGame(effectiveGameId);
      setShowOpening(true);
    } catch {
      // error 由 store 处理
    }
  }, [gameId, hostGameIdParam, store]);

  // ================================================================
  // 推进阶段
  // ================================================================
  const handleAdvancePhase = useCallback(
    async (phase: 'search' | 'discuss' | 'vote' | 'result') => {
      const effectiveGameId = gameId || hostGameIdParam;
      if (!effectiveGameId) return;
      try {
        await store.updatePhase(effectiveGameId, phase);
      } catch {
        // error 由 store 处理
      }
    },
    [gameId, hostGameIdParam, store]
  );

  // ================================================================
  // 进入搜证阶段 - 从角色卡片页面直接跳转到 SearchPage
  // ================================================================
  const handleEnterSearch = useCallback(() => {
    const effectiveGameId = gameId || hostGameIdParam;
    if (!effectiveGameId) return;
    navigate(`/search/${effectiveGameId}`);
  }, [gameId, hostGameIdParam, navigate]);

  // ================================================================
  // 工具方法
  // ================================================================
  const isHost = playerId
    ? gameState?.players.find((p: Player) => p.id === playerId)?.isHost ?? false
    : mode === 'host';

  const playerCount = gameState?.players.length ?? 0;
  const maxPlayers = (script as ScriptData)?.meta?.playerCount ?? 4;
  const phase = gameState?.phase ?? 'lobby';

  // ================================================================
  // 渲染：等待玩家加入（lobby 阶段）
  // ================================================================
  const renderWaitingRoom = () => (
    <div className="flex flex-col items-center gap-8">
      {/* 游戏ID 显示 */}
      <div className="text-center">
        <p className="text-gray-400 text-sm tracking-wider mb-3">游戏ID</p>
        <p
          className="text-6xl font-bold tracking-[0.3em]"
          style={{
            color: '#F87171',
            textShadow: '0 0 25px rgba(248,113,113,0.9), 0 0 50px rgba(220,38,38,0.5), 0 0 100px rgba(220,38,38,0.25)',
          }}
        >
          {gameId}
        </p>
      </div>

      {/* 等待玩家列表 */}
      <div className="w-full max-w-md">
        <h2 className="text-red-500 text-lg font-bold tracking-wider mb-4 text-center">
          等待玩家加入...
        </h2>
        <div className="space-y-2">
          {gameState?.players.map((player: Player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 bg-gray-900/80 border border-red-900/20 rounded"
            >
              <span className="text-xl">{player.avatar || '👤'}</span>
              <span className="text-gray-300">{player.name}</span>
              {player.isHost && (
                <span className="ml-auto text-xs text-red-500 bg-red-950/50 px-2 py-0.5 rounded">
                  主持人
                </span>
              )}
            </div>
          ))}
          {/* 空位 */}
          {Array.from({ length: maxPlayers - playerCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 px-4 py-3 bg-gray-900/40 border border-dashed border-red-900/10 rounded"
            >
              <span className="text-xl opacity-30">⬜</span>
              <span className="text-gray-700">等待加入...</span>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-600 text-sm mt-3">
          {playerCount}/{maxPlayers} 玩家
        </p>
      </div>

      {/* 填充机器人按钮（仅主持人可见，人数不足时显示） */}
      {isHost && playerCount < maxPlayers && (
        <button
          onClick={async () => {
            const effectiveGameId = gameId || hostGameIdParam;
            if (!effectiveGameId) return;
            try {
              await store.fillBots(effectiveGameId);
            } catch { /* error 由 store 处理 */ }
          }}
          className="px-6 py-3 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 text-sm tracking-wider
                     border border-purple-800/40 rounded transition-all duration-300
                     hover:shadow-[0_0_20px_rgba(128,0,128,0.3)] flex items-center gap-2"
        >
          🤖 自动填充机器人 ({maxPlayers - playerCount}个空位)
        </button>
      )}

      {/* 开始游戏按钮（仅主持人可见） */}
      {isHost && playerCount === maxPlayers && (
        <button
          onClick={handleStartGame}
          className="px-10 py-4 bg-red-950 hover:bg-red-900 text-red-300 text-lg tracking-[0.2em] font-bold
                     border border-red-800/50 rounded transition-all duration-300
                     hover:shadow-[0_0_30px_rgba(139,0,0,0.4)]"
        >
          开始游戏
        </button>
      )}

      {/* 非主持人等待提示 */}
      {!isHost && (
        <p className="text-gray-500 text-sm tracking-wider animate-pulse">
          等待主持人开始游戏...
        </p>
      )}
    </div>
  );

  // ================================================================
  // 渲染：角色卡片（所有角色 - 创建模式主持人可见）
  // ================================================================
  const renderCharacterCards = () => {
    const scriptData = script as ScriptData;
    const characters = scriptData?.characters ?? [];
    const players = gameState?.players ?? [];

    return (
      <div className="w-full max-w-4xl mx-auto">
        <h2
          className="text-2xl font-bold text-center mb-8 tracking-widest"
          style={{
            color: '#DC2626',
            textShadow: '0 0 15px rgba(220,38,38,0.7)',
          }}
        >
          角色分配
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {players.map((player: Player) => {
            const character = characters.find((c) => c.id === player.characterId);
            if (!character) return null;

            return (
              <div
                key={player.id}
                className="bg-gray-900/80 border border-red-900/30 rounded-lg p-6
                           hover:border-red-800/50 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{character.avatar}</span>
                  <div>
                    <h3 className="text-red-400 text-lg font-bold">{character.name}</h3>
                    <p className="text-gray-500 text-sm">{character.roleType}</p>
                  </div>
                  {player.id === playerId && (
                    <span className="ml-auto text-xs text-red-500 bg-red-950/50 px-2 py-0.5 rounded">
                      我的角色
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-red-700/80 font-semibold mb-1">人物故事</p>
                    <p className="text-gray-400 leading-relaxed">{character.story.background}</p>
                  </div>
                  <div>
                    <p className="text-red-700/80 font-semibold mb-1">隐藏任务</p>
                    <p className="text-gray-400 leading-relaxed">{character.hiddenTask.content}</p>
                  </div>
                  <div>
                    <p className="text-red-700/80 font-semibold mb-1">不在场证明</p>
                    <p className="text-gray-500 italic leading-relaxed">{character.alibi}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ================================================================
  // 渲染：单人角色卡片（加入模式下的玩家只看自己的）
  // ================================================================
  const renderMyCharacterCard = () => {
    const scriptData = script as ScriptData;
    const characters = scriptData?.characters ?? [];
    const currentPlayer = gameState?.players.find((p: Player) => p.id === playerId);
    if (!currentPlayer) return null;

    const character = characters.find((c) => c.id === currentPlayer.characterId);
    if (!character) return null;

    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-gray-900/80 border border-red-900/30 rounded-lg p-8">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-5xl">{character.avatar}</span>
            <div>
              <h3 className="text-red-400 text-2xl font-bold">{character.name}</h3>
              <p className="text-gray-500">{character.roleType}</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-red-700/80 font-semibold mb-1">人物故事</p>
              <p className="text-gray-400 leading-relaxed">{character.story.background}</p>
            </div>
            <div>
              <p className="text-red-700/80 font-semibold mb-1">隐藏任务</p>
              <p className="text-gray-400 leading-relaxed">{character.hiddenTask.content}</p>
            </div>
            <div>
              <p className="text-red-700/80 font-semibold mb-1">不在场证明</p>
              <p className="text-gray-500 italic leading-relaxed">{character.alibi}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ================================================================
  // 渲染：角色卡片 + 开场旁白（游戏开始后显示）
  // ================================================================
  const renderOpening = () => (
    <div>
      {/* 角色卡片 */}
      <div className="mb-10">
        {isHost ? renderCharacterCards() : renderMyCharacterCard()}
      </div>

      {/* 开场旁白 */}
      <div className="max-w-3xl mx-auto mb-10">
        <h3
          className="text-xl font-bold text-center mb-6 tracking-wider"
          style={{
            color: '#DC2626',
            textShadow: '0 0 12px rgba(220,38,38,0.6)',
          }}
        >
          开场旁白
        </h3>
        <div className="bg-gray-900/80 border border-red-900/20 rounded-lg p-8">
          <TypewriterText
            text={(script as ScriptData)?.worldBackground?.openingNarration ?? '正在加载...'}
            speed={40}
          />
        </div>
        <div className="mt-2 text-center">
          <button
            onClick={() => handleEnterSearch()}
            className="text-gray-600 text-sm hover:text-gray-400 transition-colors"
          >
            跳过动画，直接进入搜证
          </button>
        </div>
      </div>

      {/* 进入搜证阶段按钮（所有玩家可见） */}
      <div className="text-center flex flex-col items-center gap-3">
        <button
          onClick={handleEnterSearch}
          className="px-10 py-4 bg-red-950 hover:bg-red-900 text-red-300 text-lg tracking-[0.2em] font-bold
                     border border-red-800/50 rounded transition-all duration-300
                     hover:shadow-[0_0_30px_rgba(139,0,0,0.4)]"
        >
          进入搜证阶段
        </button>
        {/* 机器人自动搜证按钮 */}
        {isHost && gameState?.players.some((p: Player) => (p as any).isBot) && (
          <button
            onClick={async () => {
              const effectiveGameId = gameId || hostGameIdParam;
              if (!effectiveGameId) return;
              try {
                await store.executeBotActions(effectiveGameId);
                setError('🤖 机器人已自动搜证完毕！');
                setTimeout(() => setError(null), 2000);
              } catch { /* error 由 store 处理 */ }
            }}
            className="px-6 py-2 bg-purple-950/40 hover:bg-purple-900/40 text-purple-400 text-sm
                       border border-purple-800/30 rounded transition-all"
          >
            🤖 让机器人自动搜证
          </button>
        )}
      </div>
    </div>
  );

  // ================================================================
  // 1. 主持人后台模式
  // ================================================================
  if (mode === 'host') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <h1
          className="relative z-20 text-4xl font-bold mb-8 tracking-widest"
          style={{
            color: '#FCA5A5',
            textShadow: '0 0 20px rgba(252,165,165,0.9), 0 0 40px rgba(220,38,38,0.7), 0 0 80px rgba(220,38,38,0.4)',
          }}
        >
          主持人后台
        </h1>

        {error && (
          <div className="mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {gameState && (
          <div className="w-full max-w-md space-y-4">
            <div className="bg-gray-900/80 border border-red-900/30 rounded-lg p-6">
              <p className="text-gray-500 text-sm">游戏ID</p>
              <p className="text-2xl text-red-500 font-bold tracking-wider">{gameId || gameState.id}</p>
            </div>

            <div className="bg-gray-900/80 border border-red-900/30 rounded-lg p-6">
              <p className="text-gray-500 text-sm mb-2">当前阶段</p>
              <p className="text-red-400 text-lg font-bold">{phase}</p>
            </div>

            <div className="bg-gray-900/80 border border-red-900/30 rounded-lg p-6">
              <p className="text-gray-500 text-sm mb-2">玩家列表 ({playerCount}/{maxPlayers})</p>
              {gameState.players.map((p: Player) => (
                <p key={p.id} className="text-gray-300 text-sm py-1">
                  {p.avatar} {p.name} {p.isHost ? '(主持人)' : ''}
                </p>
              ))}
            </div>

            {/* 阶段推进按钮 */}
            <div className="flex flex-col gap-3 mt-6">
              {phase === 'lobby' && playerCount === maxPlayers && (
                <button
                  onClick={handleStartGame}
                  className="px-6 py-3 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all"
                >
                  开始游戏（分配角色）
                </button>
              )}
              {phase === 'search' && (
                <>
                  <button
                    onClick={handleEnterSearch}
                    className="px-6 py-3 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all"
                  >
                    进入搜证页面
                  </button>
                  <button
                    onClick={() => handleAdvancePhase('discuss')}
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-700/50 transition-all"
                  >
                    直接进入推理阶段
                  </button>
                </>
              )}
              {phase === 'discuss' && (
                <button
                  onClick={() => handleAdvancePhase('vote')}
                  className="px-6 py-3 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all"
                >
                  进入投票阶段
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================================================================
  // 2. 创建游戏表单
  // ================================================================
  if (!gameCreated && mode === 'create') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <h1
          className="relative z-20 text-4xl font-bold mb-8 tracking-widest"
          style={{
            color: '#FCA5A5',
            textShadow: '0 0 20px rgba(252,165,165,0.9), 0 0 40px rgba(220,38,38,0.7), 0 0 80px rgba(220,38,38,0.4)',
          }}
        >
          创建游戏
        </h1>

        {error && (
          <div className="mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        <div className="w-full max-w-sm space-y-6">
          <div>
            <label className="block text-gray-500 text-sm mb-2 tracking-wider">主持人名字</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGame()}
              placeholder="输入你的名字..."
              className="w-full px-4 py-3 bg-gray-900 border border-red-900/40 rounded
                         text-red-300 placeholder-gray-600 focus:outline-none focus:border-red-700
                         transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-500 text-sm mb-2 tracking-wider">玩家人数</label>
            <div className="flex gap-3">
              {[4].map((num) => (
                <button
                  key={num}
                  className="flex-1 px-4 py-3 bg-red-950/40 border-2 border-red-800/50 rounded
                             text-red-400 text-lg font-bold hover:bg-red-900/50 transition-all"
                >
                  {num}人
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateGame}
            className="w-full px-6 py-4 bg-red-950 hover:bg-red-900 text-red-300 text-lg tracking-[0.2em] font-bold
                       border border-red-800/50 rounded transition-all duration-300
                       hover:shadow-[0_0_30px_rgba(139,0,0,0.4)]"
          >
            创建游戏
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 border border-red-900/20 rounded text-gray-600 hover:text-gray-400 transition-colors text-sm"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // 3. 加入游戏表单
  // ================================================================
  if (!gameJoined && mode === 'join') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <h1
          className="relative z-20 text-4xl font-bold mb-8 tracking-widest"
          style={{
            color: '#FCA5A5',
            textShadow: '0 0 20px rgba(252,165,165,0.9), 0 0 40px rgba(220,38,38,0.7), 0 0 80px rgba(220,38,38,0.4)',
          }}
        >
          加入游戏
        </h1>

        {error && (
          <div className="mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        <div className="w-full max-w-sm space-y-6">
          <div>
            <label className="block text-gray-500 text-sm mb-2 tracking-wider">游戏ID</label>
            <input
              type="text"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              placeholder="输入6位游戏ID..."
              className="w-full px-4 py-3 bg-gray-900 border border-red-900/40 rounded
                         text-red-300 placeholder-gray-600 focus:outline-none focus:border-red-700
                         transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-500 text-sm mb-2 tracking-wider">你的名字</label>
            <input
              type="text"
              value={joinPlayerName}
              onChange={(e) => setJoinPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
              placeholder="输入你的名字..."
              className="w-full px-4 py-3 bg-gray-900 border border-red-900/40 rounded
                         text-red-300 placeholder-gray-600 focus:outline-none focus:border-red-700
                         transition-colors"
            />
          </div>

          <button
            onClick={handleJoinGame}
            className="w-full px-6 py-4 bg-red-950 hover:bg-red-900 text-red-300 text-lg tracking-[0.2em] font-bold
                       border border-red-800/50 rounded transition-all duration-300
                       hover:shadow-[0_0_30px_rgba(139,0,0,0.4)]"
          >
            加入游戏
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 border border-red-900/20 rounded text-gray-600 hover:text-gray-400 transition-colors text-sm"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // 4. 已加入/创建游戏 - 根据 phase 显示不同界面
  // ================================================================

  // 4a. Lobby 阶段 - 等待玩家加入
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <h1
          className="relative z-20 text-4xl font-bold mb-12 tracking-widest"
          style={{
            color: '#FCA5A5',
            textShadow: '0 0 20px rgba(252,165,165,0.9), 0 0 40px rgba(220,38,38,0.7)',
          }}
        >
          {mode === 'create' ? '游戏大厅' : '等待游戏开始'}
        </h1>

        {error && (
          <div className="mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {renderWaitingRoom()}
      </div>
    );
  }

  // 4b. Search 阶段 - 显示角色卡片 + 开场旁白，可跳转到搜证页面
  if (phase === 'search') {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        {error && (
          <div className="mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm max-w-4xl mx-auto">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
          </div>
        )}

        {renderOpening()}
      </div>
    );
  }

  // 4c. 其他阶段 - 提示跳转
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 relative z-10">
      <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
      <p className="text-gray-400 text-lg">当前阶段: {phase}</p>
      {phase === 'discuss' && (
        <button
          onClick={() => {
            const effectiveGameId = gameId || hostGameIdParam;
            if (effectiveGameId) navigate(`/discuss/${effectiveGameId}`);
          }}
          className="mt-6 px-8 py-3 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all"
        >
          进入推理讨论
        </button>
      )}
      {phase === 'vote' && (
        <button
          onClick={() => {
            const effectiveGameId = gameId || hostGameIdParam;
            if (effectiveGameId) navigate(`/vote/${effectiveGameId}`);
          }}
          className="mt-6 px-8 py-3 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800/50 transition-all"
        >
          进入投票阶段
        </button>
      )}
    </div>
  );
}
