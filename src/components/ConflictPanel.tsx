import { useState } from "react";
import {
  chLabel,
  ConflictRecord,
  ConsoleId,
  Cue,
  Fixture,
  MODE_LABEL,
  SaveMode,
} from "../model";

interface SimProps {
  fixtures: Fixture[];
  cues: Cue[];
  fixtureId: string;
  cueId: string;
  onSimulate: (a: SimSide, b: SimSide) => void;
  onSelectTarget: (fixtureId: string, cueId: string) => void;
}

export interface SimSide {
  console: ConsoleId;
  value: number;
  mode: SaveMode;
  offsetMs: number;
}

export function ConflictSimulator({
  fixtures,
  cues,
  fixtureId,
  cueId,
  onSimulate,
  onSelectTarget,
}: SimProps) {
  const [a, setA] = useState<SimSide>({ console: "main", value: 72, mode: "propagate", offsetMs: 0 });
  const [b, setB] = useState<SimSide>({ console: "backup", value: 55, mode: "only", offsetMs: 120 });

  return (
    <section className="panel sim-panel">
      <div className="heading">
        <div>
          <p>双台同存演练</p>
          <h2>主控台 × 备份台同时保存</h2>
        </div>
        <span className="hint">同一盏灯的两次保存按到达时刻仲裁：先到生效，晚到列差异</span>
      </div>

      <div className="sim-target">
        <label>
          <span>目标灯具</span>
          <select value={fixtureId} onChange={(e) => onSelectTarget(e.target.value, cueId)}>
            {fixtures.map((f) => (
              <option key={f.id} value={f.id}>
                {chLabel(f.channel)} {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>所在 Cue</span>
          <select value={cueId} onChange={(e) => onSelectTarget(fixtureId, e.target.value)}>
            {cues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.no} {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sim-sides">
        <SideEditor tag="A 版" side={a} onChange={setA} />
        <SideEditor tag="B 版" side={b} onChange={setB} />
      </div>

      <button
        className="primary wide"
        onClick={() => onSimulate(a, b)}
        disabled={a.console === b.console}
      >
        两版同时提交（按各自到达时刻仲裁）
      </button>
      {a.console === b.console && (
        <p className="hint">两版必须分别来自主控台与备份台才能演练同存仲裁。</p>
      )}
    </section>
  );
}

function SideEditor({
  tag,
  side,
  onChange,
}: {
  tag: string;
  side: SimSide;
  onChange: (s: SimSide) => void;
}) {
  return (
    <div className={"sim-side " + side.console}>
      <header>
        <b>{tag}</b>
        <button
          className="link"
          onClick={() =>
            onChange({ ...side, console: side.console === "main" ? "backup" : "main" })
          }
          title="切换操作台"
        >
          {side.console === "main" ? "主控台" : "备份台"} ↻
        </button>
      </header>
      <label>
        <span>亮度值 {side.value}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={side.value}
          onChange={(e) => onChange({ ...side, value: Number(e.target.value) })}
        />
      </label>
      <div className="seg small">
        <button
          className={side.mode === "only" ? "on" : ""}
          onClick={() => onChange({ ...side, mode: "only" })}
        >
          {MODE_LABEL.only}
        </button>
        <button
          className={side.mode === "propagate" ? "on" : ""}
          onClick={() => onChange({ ...side, mode: "propagate" })}
        >
          {MODE_LABEL.propagate}
        </button>
      </div>
      <label>
        <span>到达时刻偏移：{side.offsetMs}ms</span>
        <input
          type="number"
          step={10}
          value={side.offsetMs}
          onChange={(e) => onChange({ ...side, offsetMs: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

interface DiffProps {
  records: ConflictRecord[];
  cueName: (id: string) => string;
  fixtureName: (id: string) => string;
  onReapply: (r: ConflictRecord, useLoser: boolean) => void;
}

export function ConflictList({ records, cueName, fixtureName, onReapply }: DiffProps) {
  return (
    <section className="panel conflict-panel">
      <div className="heading">
        <div>
          <p>同存仲裁台账</p>
          <h2>晚到版本差异（可核对）</h2>
        </div>
      </div>
      {records.length === 0 && <p className="empty-tip">暂无同存冲突记录。</p>}
      <div className="conflict-list">
        {records.map((r) => (
          <article key={r.id} className="conflict-card">
            <header>
              <b>
                {fixtureName(r.fixtureId)} · {cueName(r.winner.cueId)}
              </b>
              <span className="round">第 {r.resolvedRound} 轮</span>
            </header>
            <div className="verdict">
              <span className={"seat-badge " + r.winner.console}>
                {r.winner.console === "main" ? "主控台" : "备份台"} · 先到 {r.winner.value}% · 已生效
              </span>
              <span className={"seat-badge " + r.loser.console}>
                {r.loser.console === "main" ? "主控台" : "备份台"} · 晚到 {r.loser.value}% · 未生效
              </span>
            </div>
            <table className="diff-table">
              <thead>
                <tr>
                  <th>对比项</th>
                  <th>先到版（生效）</th>
                  <th>晚到版（作废）</th>
                  <th>差异</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.winner}</td>
                    <td>{row.loser}</td>
                    <td className={row.delta?.startsWith("-") ? "neg" : "pos"}>
                      {row.delta ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="conflict-actions">
              <button onClick={() => onReapply(r, true)}>改用晚到版重提（{r.loser.value}%）</button>
              <button onClick={() => onReapply(r, false)}>维持先到版不变</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
