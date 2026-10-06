import { chLabel, Cue, Fixture } from "../model";

interface Props {
  cue: Cue;
  fixtures: Fixture[];
  confirmedValues: Record<number, number | null>;
  candidateValues: Record<number, number | null>;
  staleChannels: Set<number>;
  hasUnconfirmed: boolean;
  draftPending: boolean;
  view: "confirmed" | "candidate";
  onToggleView: () => void;
}

export function Preview({
  cue,
  fixtures,
  confirmedValues,
  candidateValues,
  staleChannels,
  hasUnconfirmed,
  draftPending,
  view,
  onToggleView,
}: Props) {
  const values = view === "confirmed" ? confirmedValues : candidateValues;
  const lit = fixtures.filter((f) => {
    const v = values[f.channel];
    return v != null && v > 0;
  });
  return (
    <section className="panel preview-panel">
      <div className="heading">
        <div>
          <p>当前场景预览</p>
          <h2>{cue.no} {cue.name}</h2>
        </div>
        <div className="seg">
          <button className={view === "confirmed" ? "on" : ""} onClick={onToggleView}>
            已确认版
          </button>
          <button className={view === "candidate" ? "on" : ""} onClick={onToggleView}>
            若确认后
          </button>
        </div>
      </div>

      {hasUnconfirmed && view === "confirmed" && (
        <div className="banner warn">
          {draftPending
            ? "⏳ 排练中有通道值已改但尚未保存；保存后引用它的下游 Cue 才会计入作废重算，确认前预览保持已确认版本。"
            : "⚠ 有通道改动尚未重新确认：预览保持已确认版本不变，作废 Cue 重算确认后才会更新。"}
        </div>
      )}
      {view === "candidate" && (
        <div className="banner info">
          这是“若确认后”的预演结果，非正式输出；确认后才会成为当前场景。
        </div>
      )}

      <div className="preview-stage">
        {lit.length === 0 && <span className="blackout">黑场</span>}
        {lit.map((f) => {
          const v = values[f.channel] as number;
          return (
            <span
              key={f.id}
              className={"beam" + (staleChannels.has(f.channel) ? " stale-beam" : "")}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                background: `radial-gradient(circle, ${f.color} 0%, transparent 70%)`,
                opacity: 0.18 + (v / 100) * 0.82,
                transform: `scale(${0.5 + v / 100})`,
              }}
            />
          );
        })}
      </div>

      <div className="preview-list">
        {fixtures.map((f) => {
          const v = values[f.channel];
          const stale = staleChannels.has(f.channel);
          return (
            <div
              key={f.id}
              className={"preview-row" + (stale ? " stale" : "") + (v ? " on" : "")}
            >
              <span className="pr-ch">{chLabel(f.channel)}</span>
              <span className="pr-name">{f.name}</span>
              <span className="pr-val">{v == null ? "未引用" : `${v}%`}</span>
              {stale && <span className="pr-flag">待重算</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
