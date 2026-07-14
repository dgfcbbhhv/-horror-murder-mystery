/**
 * 恐怖氛围背景组件（极简版本）
 * 渲染为 body 级别的 fixed 元素，独立于 React 树，避免与内容合成层冲突
 * 注意：此组件需要在 DOM 中只渲染一次，会自动去重
 */

interface HorrorBackgroundProps {
  /** 是否启用视频模式（需要 public/video/bg.mp4） */
  useVideo?: boolean;
  /** 雨滴密度 0-1（暂未使用） */
  rainIntensity?: number;
  /** 是否启用闪电（暂未使用） */
  lightning?: boolean;
}

export default function HorrorBackground({
  useVideo = false,
}: HorrorBackgroundProps) {
  return (
    <>
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: 'linear-gradient(180deg, #050507 0%, #0a0a0a 50%, #000000 100%)',
        }}
      />
      {/* 顶部血月渐变（也用 fixed z=-1） */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.15) 0%, transparent 50%)',
        }}
      />
    </>
  );
}

