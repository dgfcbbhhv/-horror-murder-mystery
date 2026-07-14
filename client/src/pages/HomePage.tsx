import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import HorrorBackground from '../components/HorrorBackground';

export default function HomePage() {
  const navigate = useNavigate();
  const { error, setError } = useGameStore();
  const [showRules, setShowRules] = useState(false);
  const [hostGameId, setHostGameId] = useState('');

  const handleHostEnter = useCallback(() => {
    if (!hostGameId.trim()) {
      setError('请输入游戏ID');
      return;
    }
    navigate(`/lobby?mode=host&gameId=${encodeURIComponent(hostGameId.trim())}`);
  }, [hostGameId, navigate, setError]);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center select-none z-10">
      {/* 恐怖氛围背景 */}
      <HorrorBackground useVideo={false} rainIntensity={0.7} lightning={false} />

      {/* 飘浮粒子效果 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-red-900/20"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* 雾气效果 */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-red-950/10 via-transparent to-red-950/10" />
      <div
        className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(120,0,0,0.15) 0%, transparent 70%)',
        }}
      />

      {/* 装饰性血丝线条 */}
      <div className="absolute top-20 left-1/4 w-px h-32 bg-gradient-to-b from-red-800/0 via-red-800/30 to-red-800/0 -rotate-12" />
      <div className="absolute top-16 right-1/4 w-px h-40 bg-gradient-to-b from-red-800/0 via-red-800/20 to-red-800/0 rotate-12" />

      {/* 主标题 */}
      <h1 className="relative text-7xl font-bold mb-4 tracking-widest select-none">
        <span
          className="inline-block"
          style={{
            color: '#8B0000',
            textShadow: '0 0 20px rgba(139,0,0,0.8), 0 0 40px rgba(139,0,0,0.4), 0 0 80px rgba(139,0,0,0.2)',
            animation: 'bloodFlicker 3s ease-in-out infinite',
          }}
        >
          暗夜迷踪
        </span>
      </h1>

      {/* 副标题 */}
      <p
        className="relative text-lg tracking-[0.3em] mb-16"
        style={{
          color: '#A0522D',
          textShadow: '0 0 10px rgba(160,82,45,0.5)',
        }}
      >
        归魂庄园 · 真人沉浸式恐怖剧本杀
      </p>

      {/* 错误提示 */}
      {error && (
        <div className="relative mb-6 px-6 py-3 bg-red-950/60 border border-red-800/50 rounded text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-500 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* 主持人入口 */}
      <div className="relative mb-4 flex items-center gap-3">
        <input
          type="text"
          value={hostGameId}
          onChange={(e) => setHostGameId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleHostEnter()}
          placeholder="输入游戏ID进入后台..."
          className="w-56 px-4 py-3 bg-gray-900/80 border border-red-900/50 rounded
                     text-red-300 placeholder-gray-600 focus:outline-none focus:border-red-700
                     transition-colors text-sm"
        />
        <button
          onClick={handleHostEnter}
          className="px-6 py-3 bg-red-950/80 border border-red-800/50 rounded
                     text-red-400 hover:bg-red-900/60 hover:text-red-300
                     transition-all duration-200 text-sm tracking-wider"
        >
          主持人入口
        </button>
      </div>

      {/* 主要按钮组 */}
      <div className="relative flex flex-col items-center gap-5">
        <button
          onClick={() => navigate('/lobby?mode=create')}
          className="w-64 px-8 py-4 bg-red-950/60 border-2 border-red-800/40 rounded
                     text-red-400 text-lg tracking-[0.2em] font-semibold
                     hover:bg-red-900/50 hover:border-red-700/60 hover:text-red-300
                     hover:shadow-[0_0_30px_rgba(139,0,0,0.3)]
                     transition-all duration-300"
        >
          玩家入口
        </button>

        <button
          onClick={() => setShowRules(true)}
          className="w-64 px-8 py-4 border border-red-900/30 rounded
                     text-red-600/80 text-lg tracking-[0.2em]
                     hover:border-red-800/50 hover:text-red-500
                     hover:shadow-[0_0_20px_rgba(139,0,0,0.2)]
                     transition-all duration-300"
        >
          规则说明
        </button>
      </div>

      {/* 底部提示 */}
      <p className="absolute bottom-8 text-red-950/40 text-xs tracking-[0.2em]">
        请在黑暗环境中佩戴耳机体验
      </p>

      {/* 规则弹窗 */}
      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowRules(false)}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-gray-950 border border-red-900/40 rounded-lg p-8
                       shadow-[0_0_60px_rgba(139,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 text-red-600/60 hover:text-red-400 text-xl transition-colors"
            >
              ✕
            </button>

            <h2
              className="text-2xl font-bold mb-6 tracking-widest text-center"
              style={{
                color: '#8B0000',
                textShadow: '0 0 15px rgba(139,0,0,0.5)',
              }}
            >
              游戏规则
            </h2>

            <div className="space-y-4 text-sm leading-relaxed text-gray-400">
              <div>
                <h3 className="text-red-500/80 font-semibold mb-1">游戏简介</h3>
                <p>
                  「暗夜迷踪」是一款真人沉浸式恐怖剧本杀。4名玩家分别扮演归魂庄园中的角色，
                  其中1人为隐藏在众人之中的凶手。通过实景搜证、线索推理和投票指认，找出真凶或成功逃脱。
                </p>
              </div>

              <div>
                <h3 className="text-red-500/80 font-semibold mb-1">游戏流程</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li><span className="text-red-400">开局大厅</span> — 创建或加入游戏，分配角色，聆听开场旁白</li>
                  <li><span className="text-red-400">实景搜证</span> — 探索庄园各个房间，收集关键线索</li>
                  <li><span className="text-red-400">推理讨论</span> — 玩家公开或私密讨论，整理线索</li>
                  <li><span className="text-red-400">投票指认</span> — 匿名投票选出嫌疑人</li>
                  <li><span className="text-red-400">真相揭晓</span> — 公布结果，展示结局</li>
                </ol>
              </div>

              <div>
                <h3 className="text-red-500/80 font-semibold mb-1">重要提示</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>凶手可以销毁1条对自己不利的线索</li>
                  <li>请仔细阅读角色故事和隐藏任务</li>
                  <li>讨论阶段注意保护自己的秘密</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => setShowRules(false)}
                className="px-8 py-3 bg-red-950/60 border border-red-800/40 rounded
                           text-red-400 hover:bg-red-900/50 transition-all text-sm tracking-wider"
              >
                我准备好了
              </button>
            </div>
          </div>
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

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
