import type { Cue, Fixture } from "../types";
import { isStale, staleFixtures } from "../engine";

interface CueListProps {
  cues: Cue[];
  fixtures: Fixture[];
  currentId: string;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
}

/** Cue 列表：显示每条 Cue 的锁定灯数、作废灯数，可确认重算 */
export default function CueList({ cues, fixtures, currentId, onSelect, onConfirm }: CueListProps) {
  return (
    <div className="cue-list">
      {cues.map((cue, idx) => {
        const stale = isStale(cue, idx, fixtures);
        const staleIds = staleFixtures(cue, idx, fixtures);
        const lockCount = Object.keys(cue.locks).filter((fid) => cue.locks[fid]).length;
        const isCurrent = cue.id === currentId;
        return (
          <article
            key={cue.id}
            className={"cue-row" + (isCurrent ? " current" : "") + (stale ? " stale" : "")}
            onClick={() => onSelect(cue.id)}
          >
            <div className="cue-no">
              <b>{cue.no}</b>
              {stale && <span className="badge stale">作废·待重算</span>}
            </div>
            <div className="cue-body">
              <h3>{cue.label}</h3>
              <p>
                {cue.note || "—"} · 锁定 {lockCount} 灯
                {stale && ` · ${staleIds.length} 灯待确认`}
              </p>
            </div>
            <div className="cue-actions">
              {stale && (
                <button
                  type="button"
                  className="mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirm(cue.id);
                  }}
                >
                  确认重算
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
