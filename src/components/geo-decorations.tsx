/**
 * 几何装饰组件 - 纯 CSS 实现的浮动图形
 *
 * 在背景层添加浮动的圆形、线条、点阵等几何元素，
 * 增强视觉深度和趣味性，同时保持工业风基调。
 *
 * 所有动画都在 globals.css 中定义，这里只负责渲染 DOM 结构。
 */

export function GeoDecorations() {
  return (
    <div className="geo-layer" aria-hidden="true">
      {/* 浮动圆形 */}
      <div className="geo-circle" />
      <div className="geo-circle" />
      <div className="geo-circle" />

      {/* 浮动线条 */}
      <div className="geo-line" />
      <div className="geo-line" />

      {/* 点阵 */}
      <div className="geo-dots" />
    </div>
  );
}
