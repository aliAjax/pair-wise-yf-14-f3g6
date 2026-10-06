import { Fixture, FixtureType } from "../model";

interface Props {
  fixtures: Fixture[];
  filter: FixtureType | "all";
  selectedId: string | null;
  currentCueId: string;
  values: Record<number, number | null>;
  staleChannelSet: Set<number>;
  onSelect: (id: string) => void;
}

export function StageMap({
  fixtures,
  filter,
  selectedId,
  currentCueId,
  values,
  staleChannelSet,
  onSelect,
}: Props) {
  const shown = fixtures.filter((f) => filter === "all" || f.type === filter);
  return (
    <section className="panel stage-panel">
      <div className="heading">
        <div>
          <p>舞台平面灯位图</p>
          <h2>灯位 · 当前 {currentCueId}</h2>
        </div>
        <span className="hint">点击灯具进入排练调整；虚线圈＝该通道在当前场景已作废待确认</span>
      </div>
      <div className="stage">
        <div className="stage-curtain">舞台台口</div>
        <div className="stage-center">演区</div>
        {shown.map((f) => {
          const v = values[f.channel];
          const pct = v == null ? 0 : v;
          const selected = f.id === selectedId;
          const stale = staleChannelSet.has(f.channel);
          return (
            <button
              key={f.id}
              className={"lamp" + (selected ? " selected" : "") + (stale ? " stale" : "")}
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                opacity: v == null ? 0.3 : 0.25 + (pct / 100) * 0.75,
                background: `radial-gradient(circle, ${f.color} ${pct}%, rgba(255,255,255,0.06) 100%)`,
                boxShadow: selected
                  ? `0 0 0 3px var(--primary), 0 0 ${8 + pct / 4}px ${f.color}`
                  : `0 0 ${6 + pct / 5}px ${f.color}`,
              }}
              title={`${f.name} · ${f.focus} · ${v == null ? "未引用" : v + "%"}`}
              onClick={() => onSelect(f.id)}
            >
              <span className="lamp-id">{f.channel}</span>
              <span className="lamp-value">{v == null ? "—" : pct}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
