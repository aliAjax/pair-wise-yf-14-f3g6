import type { Fixture } from "../types";

interface StagePlotProps {
  fixtures: Fixture[];
  /** fid -> level 0-100（预览只传已确认值） */
  levels: Record<string, number>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  staleIds?: string[];
  /** 尺寸 */
  height?: number;
}

/** 舞台平面灯位图：上为天幕/逆光，下为面光 */
export default function StagePlot({
  fixtures,
  levels,
  selectedId,
  onSelect,
  staleIds = [],
  height = 300,
}: StagePlotProps) {
  return (
    <div className="stage" style={{ height }}>
      <div className="stage-label upstage">天幕 · 逆光</div>
      <div className="stage-label downstage">台口 · 面光</div>
      {fixtures.map((f) => {
        const level = levels[f.id] ?? 0;
        const on = level > 0;
        const selected = selectedId === f.id;
        const stale = staleIds.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            className={
              "light" +
              (on ? " on" : "") +
              (selected ? " selected" : "") +
              (stale ? " stale" : "")
            }
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              ["--light-color" as string]: f.color,
              ["--light-level" as string]: level / 100,
            }}
            onClick={() => onSelect?.(f.id)}
            title={`${f.code} · ${f.channel} · ${f.focus} · ${level}%`}
          >
            <span className="light-bulb" />
            <span className="light-tag">{f.code}</span>
            {stale && <span className="light-stale">作废</span>}
          </button>
        );
      })}
    </div>
  );
}
