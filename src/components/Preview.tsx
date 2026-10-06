import type { Cue, Fixture } from "../types";
import StagePlot from "./StagePlot";

interface PreviewProps {
  cue: Cue | undefined;
  cues: Cue[];
  fixtures: Fixture[];
  /** 未保存的改动提示 */
  dirty?: boolean;
  /** 当前 Cue 已作废、待重算 */
  stale?: boolean;
}

/** 当前场景预览：只显示已确认（confirmed）的亮度，未确认改动不在这里体现 */
export default function Preview({ cue, cues, fixtures, dirty, stale }: PreviewProps) {
  if (!cue) {
    return <p className="empty">暂无 Cue</p>;
  }
  const idx = cues.findIndex((c) => c.id === cue.id);
  const confirmed = cue.confirmed;
  const entries = fixtures
    .map((f) => ({ f, level: confirmed[f.id] ?? 0, locked: !!cue.locks[f.id] }))
    .filter((x) => x.level > 0);

  return (
    <div className="preview">
      <div className="preview-head">
        <div>
          <p>当前场景预览</p>
          <h2>
            {cue.no} · {cue.label}
          </h2>
        </div>
        {stale ? (
          <span className="badge stale">作废·待重算</span>
        ) : (
          <span className={"badge " + (dirty ? "dirty" : "ok")}>
            {dirty ? "有未保存改动" : "已确认"}
          </span>
        )}
      </div>
      <StagePlot fixtures={fixtures} levels={confirmed} height={240} />
      <div className="preview-levels">
        {entries.length === 0 && <p className="empty">本 Cue 无灯点亮</p>}
        {entries.map(({ f, level, locked }) => (
          <span key={f.id} className="level-chip">
            <i style={{ background: f.color }} />
            {f.code}
            <b>{level}%</b>
            {locked && <em className="lock">🔒</em>}
          </span>
        ))}
      </div>
      <p className="preview-note">
        预览只显示已确认亮度；排练中改动在保存并确认重算前不会反映到这里。
      </p>
    </div>
  );
}
