/**
 * Logo 占位。
 *
 * 品牌名是《科研小助理》，但比赛期间还没有正式 logo，所以这里用**几何占位标记**：
 * 黑方块里画一棵"知识树"（主干 + 三条分支 + 节点圆点 + 地平线），
 * 与背景那张白底黑线树是同一套意象，所以放在一起不会有拼贴感。
 *
 * 真 logo 到位后只需要替换这个文件里的 SVG，调用处一处都不用改。
 */
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="科研小助理"
    >
      <rect width="40" height="40" fill="currentColor" />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="square" fill="none">
        <path d="M20 33V18" />
        <path d="M20 24 12 15" />
        <path d="M20 24 28 15" />
        <path d="M20 18 20 10" />
        <path d="M12.5 33H27.5" />
      </g>
      <g fill="#fff">
        <circle cx="12" cy="15" r="2.6" />
        <circle cx="28" cy="15" r="2.6" />
        <circle cx="20" cy="10" r="2.6" />
      </g>
    </svg>
  );
}

/** 方块标记 + 中文名 + 英文副名的完整组合，顶栏与侧栏共用。 */
export function LogoLockup({ size = 46, nameSize }: { size?: number; nameSize?: string }) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-name" style={nameSize ? { fontSize: nameSize } : undefined}>
          科研小助理
        </span>
        <span className="logo-sub">RESEARCH COPILOT</span>
      </span>
    </span>
  );
}
