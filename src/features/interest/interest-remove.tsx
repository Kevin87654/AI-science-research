"use client";

/**
 * 兴趣方向标签右上角的红色减号（B 负责，第三轮迭代新增）。
 *
 * 画像页与入门前置路线共用：外层标签 / chip 需要套一层 `position: relative`
 * 的容器（见 `.interest-wrap`），这个按钮绝对定位在右上角。
 * 点击时 `stopPropagation`，避免在 chip 本身就是按钮（路线页选中）时触发选中。
 */
export function InterestRemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="interest-remove"
      aria-label={`移除兴趣方向「${label}」`}
      title={`移除「${label}」`}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
    >
      −
    </button>
  );
}
