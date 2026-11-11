/**
 * 两条时间轴的展示组件（纯展示，不含状态）。
 *
 * 学生页与导师页共用同一套渲染，好处是"导师看到的进度"和"学生自己看到的"
 * 长得完全一样 —— 沟通时说"第三条"不会指到两件不同的事上。
 *
 * 视觉与仓库里学习路线的任务轨道同源：左侧一条竖线 + 方形节点，
 * 节点形状表达状态（实心=已过 / 黄=最近 / 空心=未到 / 虚线=日期未定），
 * 不额外引入图标，保持工业风那套"直角 + 1px 线"的语言。
 */
import type { GraduationMilestone, StudentNode } from "@/contracts";
import { describeDue, formatIsoDate } from "./timeline-meta";

export function SchoolTimeline({
  milestones,
  today,
}: {
  milestones: readonly GraduationMilestone[];
  today: string;
}) {
  return (
    <ol className="tl">
      {milestones.map((milestone, index) => {
        const due = milestone.dueDate ? describeDue(milestone.dueDate, today) : null;
        const state = due ? due.state : "undated";
        return (
          <li className={`tl-item tl-${state}`} key={milestone.id}>
            <div className="tl-side">
              <span className="tl-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="tl-date-label">{milestone.dateLabel}</span>
              {due ? (
                <span className={`tl-due tl-due-${due.state}`}>{due.label}</span>
              ) : null}
            </div>
            <div className="tl-rail" aria-hidden="true" />
            <div className="tl-body">
              <h3 className="tl-title">{milestone.title}</h3>
              <p className="tl-detail">{milestone.detail}</p>
              {milestone.materials.length > 0 ? (
                <ul className="tl-materials" aria-label="需要提交的材料">
                  {milestone.materials.map((material) => (
                    <li className="tl-material" key={material}>
                      {material}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StudentNodeTimeline({
  nodes,
  onRemove,
  emptyHint,
}: {
  nodes: readonly StudentNode[];
  /** 传了才显示删除按钮 —— 导师看学生进度时是只读的。 */
  onRemove?: (nodeId: string) => void;
  emptyHint: string;
}) {
  if (nodes.length === 0) {
    return (
      <div className="tl-empty">
        <p className="tl-empty-title">还没有记录</p>
        <p className="tl-empty-text">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ol className="tl tl-student">
      {nodes.map((node) => (
        <li className="tl-item tl-node" key={node.id}>
          <div className="tl-side">
            <span className="tl-date-label">{formatIsoDate(node.date)}</span>
            <span className="tl-side-note">自己记录</span>
          </div>
          <div className="tl-rail" aria-hidden="true" />
          <div className="tl-body">
            <div className="tl-node-head">
              <h3 className="tl-title">{node.title}</h3>
              {onRemove ? (
                <button
                  className="tl-remove"
                  type="button"
                  onClick={() => onRemove(node.id)}
                  aria-label={`删除节点：${node.title}`}
                >
                  删除
                </button>
              ) : null}
            </div>
            {node.note ? <p className="tl-detail">{node.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
