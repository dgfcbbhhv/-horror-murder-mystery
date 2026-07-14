import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import type { Player } from '../types/game';
import HorrorBackground from '../components/HorrorBackground';

const VOTE_DURATION = 60;

export default function VotePage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const {
    playerId,
    gameState,
    script,
    submitVote,
    fetchGameState,
    getPlayerById,
    botVoteAll,
    updatePhase,
  } = useGameStore();

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(VOTE_DURATION);
  const [submitted, setSubmitted] = useState(false);
  const [autoTransition, setAutoTransition] = useState(false);

  const suspects: Player[] = (gameState?.players ?? []).filter(
    (p: Player) => p.id !== playerId
  );

  // 响应式计算投票状态
  const hasVoted = playerId && gameState
    ? gameState.votes.some((v: { voterId: string }) => v.voterId === playerId)
    : false;

  const totalPlayers = gameState?.players.length ?? 0;
  const votedCount = gameState?.votes.length ?? 0;
  const allVoted = totalPlayers > 0 && votedCount >= totalPlayers;

  // 轮询刷新游戏状态
  useEffect(() => {
    if (!gameId) return;
    fetchGameState(gameId).then(() => {
      // 如果 playerId 未设置，自动使用 host player
      const state = useGameStore.getState();
      if (!state.playerId && state.gameState) {
        const hostPlayer = state.gameState.players.find((p: Player) => p.isHost);
        if (hostPlayer) {
          state.setPlayerId(hostPlayer.id);
        }
      }
    });
    const interval = setInterval(() => {
      fetchGameState(gameId);
    }, 3000);
    return () => clearInterval(interval);
  }, [gameId, fetchGameState]);

  // 阶段变化时自动跳转到结果页
  useEffect(() => {
    if (!gameId) return;
    if (gameState?.phase === 'result') {
      navigate(`/result/${gameId}`);
    }
  }, [gameState?.phase, gameId, navigate]);

  // 倒计时
  useEffect(() => {
    if (timeLeft <= 0 || submitted || autoTransition) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted, autoTransition]);

  // 倒计时结束自动提交（如果没投的话随机投一个）
  useEffect(() => {
    if (timeLeft <= 0 && !submitted && !autoTransition && gameId && suspects.length > 0) {
      setSubmitted(true);
      const randomTarget = suspects[Math.floor(Math.random() * suspects.length)];
      submitVote(gameId, randomTarget.id).catch(() => {
        setSubmitted(false);
      });
    }
  }, [timeLeft, submitted, autoTransition, gameId, suspects, submitVote]);

  // 所有人投票完毕后自动判定结局并跳转
  useEffect(() => {
    if (!autoTransition && allVoted && gameId) {
      setAutoTransition(true);
      updatePhase(gameId, 'result').then(() => {
        setTimeout(() => {
          navigate(`/result/${gameId}`);
        }, 1500);
      });
    }
  }, [allVoted, autoTransition, gameId, navigate, updatePhase]);

  const handleSelect = useCallback((targetId: string) => {
    if (submitted || hasVoted) return;
    setSelectedTargetId(targetId);
  }, [submitted, hasVoted]);

  const handleSubmitVote = useCallback(async () => {
    if (!gameId || !selectedTargetId || submitted || hasVoted) return;
    setSubmitted(true);
    try {
      await submitVote(gameId, selectedTargetId);
    } catch {
      setSubmitted(false);
    }
  }, [gameId, selectedTargetId, submitted, hasVoted, submitVote]);

  const selectedPlayer = selectedTargetId ? getPlayerById(selectedTargetId) : null;

  // 获取角色 emoji（从 script.characters 匹配）
  const getCharacterEmoji = (player: Player): string => {
    const chars = (script as { characters?: { id: string; avatar: string }[] })?.characters ?? [];
    const matched = chars.find((c) => c.id === player.characterId);
    return matched?.avatar ?? '👤';
  };

  const getRoleTypeName = (player: Player): string => {
    const chars = (script as { characters?: { id: string; roleType: string }[] })?.characters ?? [];
    const matched = chars.find((c) => c.id === player.characterId);
    return matched?.roleType ?? '';
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center select-none">
      <HorrorBackground useVideo={false} rainIntensity={0.5} lightning={false} />
      {/* 背景粒子 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-red-900/20"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* 雾气 */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-red-950/10 via-transparent to-red-950/10" />

      {/* 倒计时 */}
      <div className="relative mt-10 mb-4 text-center">
        <div
          className="text-8xl font-bold tracking-widest"
          style={{
            color: timeLeft <= 10 ? '#DC2626' : '#EF4444',
            textShadow:
              timeLeft <= 10
                ? '0 0 30px rgba(220,38,38,0.8), 0 0 60px rgba(220,38,38,0.5)'
                : '0 0 20px rgba(239,68,68,0.5)',
            animation: timeLeft <= 10 ? 'urgentPulse 0.5s ease-in-out infinite' : 'none',
          }}
        >
          {timeLeft}
        </div>
        <p className="text-red-600/60 text-sm tracking-[0.3em] mt-2">秒后自动提交</p>
      </div>

      {/* 标题 */}
      <h1
        className="relative text-4xl font-bold mb-8 tracking-widest text-center"
        style={{
          color: '#DC2626',
          textShadow: '0 0 20px rgba(139,0,0,0.8), 0 0 40px rgba(139,0,0,0.4)',
          animation: 'bloodFlicker 3s ease-in-out infinite',
        }}
      >
        ⚖️ 终局投票 — 谁是真凶？
      </h1>

      {/* 机器人投票按钮 */}
      {gameState?.players.some((p: any) => p.isBot) && !hasVoted && (
        <div className="mb-6">
          <button
            onClick={async () => {
              if (!gameId) return;
              try {
                await botVoteAll(gameId);
              } catch { /* ignore */ }
            }}
            className="px-6 py-2 bg-purple-950/40 hover:bg-purple-900/40 text-purple-400 text-sm
                       border border-purple-800/30 rounded transition-all"
          >
            🤖 让机器人投票
          </button>
        </div>
      )}

      {/* 投票进度条 */}
      <div className="relative w-full max-w-md mb-8 px-4">
        <div className="flex justify-between text-xs text-red-600/70 mb-2">
          <span>
            已投票 {votedCount}/{totalPlayers}
          </span>
          <span>
            {votedCount >= totalPlayers ? '✓ 所有人已投票' : '等待投票中...'}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-red-900/30">
          <div
            className="h-full bg-gradient-to-r from-red-900 to-red-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${totalPlayers > 0 ? (votedCount / totalPlayers) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 状态提示 */}
      {(hasVoted || submitted) && !autoTransition && (
        <div className="relative mb-4 px-6 py-3 bg-red-950/40 border border-red-800/30 rounded-lg text-red-400 text-sm tracking-wider flex flex-col items-center gap-3">
          <span>你已投票，等待其他玩家...</span>
          <button
            onClick={async () => {
              if (!gameId) return;
              setAutoTransition(true);
              await updatePhase(gameId, 'result');
              navigate(`/result/${gameId}`);
            }}
            className="px-6 py-2 bg-red-900/60 hover:bg-red-800/60 text-red-300 text-sm
                       border border-red-700/40 rounded transition-all"
          >
            ⏭️ 跳过等待，直接查看结果
          </button>
        </div>
      )}

      {autoTransition && (
        <div className="relative mb-8 px-6 py-3 bg-green-950/40 border border-green-800/30 rounded-lg text-green-400 text-sm tracking-wider">
          投票结束，正在揭晓结果...
        </div>
      )}

      {/* 嫌疑人卡片列表 */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl px-4 pb-32">
        {suspects.map((suspect) => {
          const isSelected = selectedTargetId === suspect.id;
          const isDisabled = submitted || hasVoted;

          return (
            <button
              key={suspect.id}
              onClick={() => handleSelect(suspect.id)}
              disabled={isDisabled}
              className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                isDisabled
                  ? 'border-gray-800/30 bg-gray-950/50 opacity-50 cursor-not-allowed'
                  : isSelected
                    ? 'border-red-500 bg-gray-900 shadow-[0_0_30px_rgba(139,0,0,0.5)] scale-105'
                    : 'border-red-900/30 bg-gray-900 hover:border-red-800/60 hover:bg-gray-900/90 cursor-pointer'
              }`}
            >
              {/* 选中发光效果 */}
              {isSelected && !isDisabled && (
                <div className="absolute inset-0 rounded-xl bg-red-900/10 pointer-events-none" />
              )}

              <div className="flex items-center gap-4">
                {/* 头像/emoji */}
                <div
                  className="text-5xl w-16 h-16 flex items-center justify-center rounded-lg bg-gray-800/50 border border-red-900/20 shrink-0"
                >
                  {getCharacterEmoji(suspect)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-red-400 text-sm tracking-wider mb-1">
                    {getRoleTypeName(suspect)}
                  </div>
                  <div className="text-white text-lg font-semibold truncate">
                    {suspect.name}
                  </div>
                  {suspect.characterName && (
                    <div className="text-gray-500 text-xs truncate mt-0.5">
                      {suspect.characterName}
                    </div>
                  )}
                </div>

                {/* 选中标记 */}
                {isSelected && !isDisabled && (
                  <div className="text-red-500 text-2xl shrink-0">✓</div>
                )}
              </div>

              {/* 投票计数标记 */}
              {(() => {
                const votedFor = gameState?.votes.filter((v: { targetId: string }) => v.targetId === suspect.id).length ?? 0;
                if (votedFor > 0) {
                  return (
                    <div className="absolute top-2 right-2 bg-red-900/60 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-800/40">
                      {votedFor} 票
                    </div>
                  );
                }
                return null;
              })()}
            </button>
          );
        })}
      </div>

      {/* 确认投票按钮 */}
      {selectedTargetId && !hasVoted && !submitted && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-10 flex justify-center">
          <button
            onClick={handleSubmitVote}
            disabled={submitted}
            className="px-12 py-4 bg-red-800 border-2 border-red-700 rounded-lg
                       text-red-200 text-lg tracking-[0.3em] font-semibold
                       hover:bg-red-700 hover:border-red-600 hover:text-white
                       hover:shadow-[0_0_40px_rgba(139,0,0,0.5)]
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔒 确认投票给 {selectedPlayer?.name ?? '...'}
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes bloodFlicker {
          0%, 100% { opacity: 1; }
          5% { opacity: 0.85; }
          10% { opacity: 1; }
          45% { opacity: 0.9; }
          50% { opacity: 0.7; }
          55% { opacity: 0.95; }
          90% { opacity: 0.85; }
          95% { opacity: 1; }
        }

        @keyframes urgentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.3); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
