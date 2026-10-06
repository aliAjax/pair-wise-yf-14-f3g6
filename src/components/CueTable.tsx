import {
  Cell,
  chLabel,
  Cue,
  Fixture,
  Snapshot,
} from "../model";

interface Props {
  cues: Cue[];
  fixtures: Fixture[];
  board: Record<string, Record<number, Cell>>;
  levels: Snapshot;
  currentCueId: string;
  selectedFixtureId: string | null;
  staleCueIds: Set<string>;
  activeChannels: Set<number>;
  onSelectCue: (id: string) => void;
  onSelectFixture: (id: string) => void;
  onToggleLock: (cueId: string, channel: number) => void;
}

export function CueTable({
  cues,
  fixtures,
  board,
  levels,
  currentCueId,
  selectedFixtureId,
  staleCueIds,
  activeChannels,
  onSelectCue,
  onSelectFixture,
  onToggleLock,
}: Props) {
  return (
    <section className="panel cue-panel">
      <div className="heading">
        <div>
          <p>Cue 列表 · 触发顺序</p>
          <h2>Cue 表</h2>
        </div>
        <span className="hint">
          🔒 显式锁定（阻挡点） · ⤵ 顺延引用上游；点格可在锁定/顺延间切换
        </span>
      </div>
      <div className="cue-scroll">
        <table className="cue-table">
          <thead>
            <tr>
              <th className="cue-head-col">Cue</th>
              {fixtures.map((f) => (
                <th
                  key={f.id}
                  className={
                    (activeChannels.has(f.channel) ? "active" : "") +
                    (f.id === selectedFixtureId ? " selected-col" : "")
                  }
                  onClick={() => onSelectFixture(f.id)}
                  title={`${f.name} · ${f.gel} · ${f.focus}`}
                >
                  <span className="th-ch">{chLabel(f.channel)}</span>
                  <span className="th-type">{f.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cues.map((cue) => {
              const isCurrent = cue.id === currentCueId;
              const stale = staleCueIds.has(cue.id);
              return (
                <tr
                  key={cue.id}
                  className={
                    (isCurrent ? "current" : "") +
                    (stale ? " stale-row" : "")
                  }
                  onClick={() => onSelectCue(cue.id)}
                >
                  <td className="cue-head-col">
                    <b>{cue.no}</b>
                    <span className="cue-name">{cue.name}</span>
                    {stale && <em className="stale-tag">已作废·待重算</em>}
                  </td>
                  {fixtures.map((f) => {
                    const cell = board[cue.id]?.[f.channel];
                    const resolved = levels[cue.id]?.[f.channel];
                    if (!cell) return <td key={f.id} className="cell empty" />;
                    return (
                      <td
                        key={f.id}
                        className={
                          "cell " +
                          (cell.kind === "explicit" ? "explicit" : "track") +
                          (activeChannels.has(f.channel) ? " active" : "")
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCue(cue.id);
                          onSelectFixture(f.id);
                        }}
                      >
                        <button
                          className="cell-lock"
                          title={
                            cell.kind === "explicit"
                              ? `显式锁定 ${resolved}%（阻挡）— 点击改为顺延`
                              : `顺延自上游＝${resolved ?? "—"} — 点击改为显式锁定`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLock(cue.id, f.channel);
                          }}
                        >
                          {cell.kind === "explicit"
                            ? cell.locked
                              ? "🔒"
                              : "🔓"
                            : "⤵"}
                        </button>
                        <span className="cell-value">
                          {resolved == null ? "—" : resolved}
                        </span>
                        {cell.kind === "explicit" && !cell.locked && (
                          <span className="backfill-dot pending" title="v1 旧值：尚无锁定标记，等待升级回填" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
