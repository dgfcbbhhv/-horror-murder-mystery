import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type { ScriptData, Player, Vote } from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

export default function ResultPage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const {
    gameState,
    script,
    getPlayerById,
    fetchGameState,
    fetchScript,
    playerId,
  } = useGameStore();

  const [showScare, setShowScare] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  const outcome = gameState?.outcome ?? null;
  const outcomeResult = outcome?.result ?? 'bad';
  const ending = outcomeResult === 'good'
    ? (script as ScriptData)?.endings?.good
    : (script as ScriptData)?.endings?.bad;

  const votes = gameState?.votes ?? [];
  const players = gameState?.players ?? [];

  // 获取投票详情
  const voteDetails: { voter: Player; target: Player }[] = votes
    .map((v: Vote) => {
      const voter = getPlayerById(v.voterId);
      const target = getPlayerById(v.targetId);
      return voter && target ? { voter, target } : null;
    })
    .filter(Boolean) as { voter: Player; target: Player }[];

  // 获取凶手信息
  const murderer = players.find((p: Player) => p.isMurderer);

  // 获取角色 avatar
  const getCharacterEmoji = (player: Player): string => {
    const chars = (script as ScriptData)?.characters ?? [];
    const matched = chars.find((c) => c.id === player.characterId);
    return matched?.avatar ?? '👤';
  };

  // 获取角色名
  const getRoleTypeName = (player: Player): string => {
    const chars = (script as ScriptData)?.characters ?? [];
    const matched = chars.find((c) => c.id === player.characterId);
    return matched?.roleType ?? '';
  };

  // 刷新状态
  useEffect(() => {
    if (gameId) {
      fetchGameState(gameId);
      if (!script) {
        fetchScript();
      }
    }
  }, [gameId, fetchGameState, fetchScript, script]);

  // 坏结局的惊吓效果
  useEffect(() => {
    if (outcomeResult === 'bad') {
      const timer = setTimeout(() => {
        setShowScare(true);
      }, 1500);

      const hideTimer = setTimeout(() => {
        setShowScare(false);
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [outcomeResult]);

  // 逐段显示动画
  useEffect(() => {
    if (!ending) return;

    const sections = ['title', 'murderer', 'content', 'epilogue', 'votes'];
    const timers: ReturnType<typeof setTimeout>[] = [];

    sections.forEach((section, index) => {
      const timer = setTimeout(() => {
        setVisibleSections((prev) => {
          const next = new Set(prev);
          next.add(section);
          return next;
        });
      }, 500 + index * 800);

      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [ending]);

  const handleRestart = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (!ending) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
        <div className="text-red-600 text-lg tracking-wider animate-pulse">
          正在加载结局...
        </div>
      </div>
    );
  }

  const isGoodEnding = outcomeResult === 'good';

  return (
    <div
      className={`relative min-h-screen overflow-hidden flex flex-col items-center select-none ${
        isGoodEnding ? 'bg-gray-950' : 'bg-black'
      }`}
    >
      <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
      {/* 红屏惊吓效果（坏结局） */}
      {showScare && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          style={{
            background: 'rgba(180,0,0,0.7)',
            animation: 'scareFlash 0.3s ease-in-out 3',
          }}
        />
      )}

      {/* 背景粒子 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: isGoodEnding
                ? 'rgba(217, 164, 4, 0.2)'
                : 'rgba(139, 0, 0, 0.25)',
              animation: `float ${3 + Math.random() * 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* 雾气 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isGoodEnding
            ? 'radial-gradient(ellipse at 50% 0%, rgba(217,164,4,0.08) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.12) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-3xl px-6 py-12 flex flex-col items-center">
        {/* 标题 */}
        <div
          className={`transition-all duration-1000 ${
            visibleSections.has('title')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <h1
            className="text-5xl font-bold mb-2 tracking-widest text-center"
            style={
              isGoodEnding
                ? {
                    color: '#FBBF24',
                    textShadow: '0 0 30px rgba(251,191,36,0.5), 0 0 60px rgba(217,164,4,0.3)',
                  }
                : {
                    color: '#DC2626',
                    textShadow: '0 0 30px rgba(220,38,38,0.6), 0 0 60px rgba(139,0,0,0.3)',
                    animation: 'bloodFlicker 2s ease-in-out infinite',
                  }
            }
          >
            {isGoodEnding ? '🔍 真相大白' : '💀 冤魂不散'}
          </h1>
          <h2
            className="text-2xl font-semibold mb-10 text-center tracking-wider"
            style={{ color: isGoodEnding ? '#D97706' : '#991B1B' }}
          >
            {ending.title}
          </h2>
        </div>

        {/* 凶手身份（好结局） */}
        {isGoodEnding && murderer && (
          <div
            className={`w-full mb-8 transition-all duration-1000 ${
              visibleSections.has('murderer')
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div
              className="p-6 rounded-xl border text-center"
              style={{
                background: 'rgba(217,164,4,0.05)',
                borderColor: 'rgba(217,164,4,0.3)',
              }}
            >
              <p className="text-amber-500/70 text-sm tracking-wider mb-3">真凶身份</p>
              <div className="flex items-center justify-center gap-4">
                <span className="text-5xl">{getCharacterEmoji(murderer)}</span>
                <div className="text-left">
                  <div className="text-amber-300 text-sm tracking-wider">
                    {getRoleTypeName(murderer)}
                  </div>
                  <div className="text-amber-100 text-xl font-bold">
                    {murderer.name}
                  </div>
                  {murderer.characterName && (
                    <div className="text-amber-600/60 text-xs mt-0.5">
                      {murderer.characterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 结局内容 */}
        <div
          className={`w-full mb-8 transition-all duration-1000 ${
            visibleSections.has('content')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div
            className="p-6 rounded-xl border"
            style={{
              background: isGoodEnding
                ? 'rgba(217,164,4,0.03)'
                : 'rgba(139,0,0,0.05)',
              borderColor: isGoodEnding
                ? 'rgba(217,164,4,0.2)'
                : 'rgba(139,0,0,0.3)',
            }}
          >
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap tracking-wider"
              style={{ color: isGoodEnding ? '#FCD34D' : '#FCA5A5' }}
            >
              {ending.content}
            </p>
          </div>
        </div>

        {/* 尾声 */}
        <div
          className={`w-full mb-8 transition-all duration-1000 ${
            visibleSections.has('epilogue')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div
            className="p-6 rounded-xl border border-dashed"
            style={{
              background: isGoodEnding
                ? 'rgba(217,164,4,0.02)'
                : 'rgba(139,0,0,0.03)',
              borderColor: isGoodEnding
                ? 'rgba(217,164,4,0.15)'
                : 'rgba(139,0,0,0.2)',
            }}
          >
            <p
              className="text-sm italic leading-relaxed tracking-wider"
              style={{ color: isGoodEnding ? '#B45309' : '#9CA3AF' }}
            >
              {ending.epilogue}
            </p>
          </div>
        </div>

        {/* 投票详情 */}
        <div
          className={`w-full mb-10 transition-all duration-1000 ${
            visibleSections.has('votes')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <h3
            className="text-sm tracking-[0.3em] mb-4 text-center"
            style={{ color: isGoodEnding ? '#D97706' : '#991B1B' }}
          >
            📊 投票详情
          </h3>
          <div className="space-y-3">
            {voteDetails.length === 0 && (
              <p className="text-gray-600 text-sm text-center">暂无投票数据</p>
            )}
            {voteDetails.map(({ voter, target }) => {
              const isSelf = voter.id === playerId;
              return (
                <div
                  key={voter.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  style={{
                    background: isSelf
                      ? isGoodEnding
                        ? 'rgba(217,164,4,0.05)'
                        : 'rgba(139,0,0,0.05)'
                      : 'transparent',
                    borderColor: isGoodEnding
                      ? 'rgba(217,164,4,0.15)'
                      : 'rgba(139,0,0,0.2)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCharacterEmoji(voter)}</span>
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: isGoodEnding ? '#FBBF24' : '#FCA5A5' }}
                      >
                        {voter.name}
                        {isSelf && (
                          <span
                            className="ml-2 text-xs"
                            style={{ color: isGoodEnding ? '#B45309' : '#991B1B' }}
                          >
                            (你)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">
                        {getRoleTypeName(voter)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-lg"
                      style={{ color: isGoodEnding ? '#D97706' : '#DC2626' }}
                    >
                      →
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCharacterEmoji(target)}</span>
                      <span
                        className="text-sm"
                        style={{ color: isGoodEnding ? '#FBBF24' : '#FCA5A5' }}
                      >
                        {target.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 重新开始按钮 */}
        <button
          onClick={handleRestart}
          className={`px-10 py-4 rounded-lg text-lg tracking-[0.2em] font-semibold
                     transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,0,0,0.5)] ${
                       isGoodEnding
                         ? 'bg-amber-900/60 border-2 border-amber-700/50 text-amber-300 hover:bg-amber-800/60 hover:border-amber-600/60'
                         : 'bg-red-950/60 border-2 border-red-800/50 text-red-400 hover:bg-red-900/60 hover:border-red-700/60'
                     }`}
        >
          {isGoodEnding ? '🎭 重新开始' : '🕯️ 再次挑战'}
        </button>

        {/* 底部留白 */}
        <div className="h-12" />
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes bloodFlicker {
          0%, 100% { opacity: 1; }
          5% { opacity: 0.7; }
          10% { opacity: 1; }
          45% { opacity: 0.85; }
          50% { opacity: 0.55; }
          55% { opacity: 0.95; }
          90% { opacity: 0.8; }
          95% { opacity: 1; }
        }

        @keyframes scareFlash {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.3); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
