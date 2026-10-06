import {
  CONSOLE_LABEL,
  ConsoleId,
  Cue,
  Fixture,
  MODE_LABEL,
  Projection,
  SaveMode,
} from "../model";

interface Props {
  seat: ConsoleId;
  onSeat: (s: ConsoleId) => void;
  fixture: Fixture | null;
  cue: Cue | null;
  resolvedValue: number | null;
  draftValue: number | null;
  onDraft: (v: number) => void;
  proj: Projection | null;
  cueName: (id: string) => string;
  onSave: (mode: SaveMode) => void;
}

export function RehearsalPanel({
  seat,
  onSeat,
  fixture,
  cue,
  resolvedValue,
  draftValue,
  onDraft,
  proj,
  cueName,
  onSave,
}: Props) {
  const changed =
    fixture != null && draftValue != null && draftValue !== resolvedValue;

  return (
    <section className="panel rehearsal-panel">
      <div className="heading">
        <div>
          <p>排练台 · 通道调整</p>
          <h2>调整并选择保存做法</h2>
        </div>
        <div className="seg">
          <button className={seat === "main" ? "on" : ""} onClick={() => onSeat("main")}>
            {CONSOLE_LABEL.main}
          </button>
          <button className={seat === "backup" ? "on" : ""} onClick={() => onSeat("backup")}>
            {CONSOLE_LABEL.backup}
          </button>
        </div>
      </div>

      {!fixture || !cue ? (
        <p className="empty-tip">在灯位图或 Cue 表中点选一盏灯开始排练调整。</p>
      ) : (
        <div className="rehearse-body">
          <div className="fixture-card">
            <header>
              <b>CH{String(fixture.channel).padStart(3, "0")} · {fixture.name}</b>
              <span>{fixture.type} · {fixture.gel} · 焦点：{fixture.focus}</span>
            </header>
            <div className="slider-row">
              <span>{cue.no} {cue.name}</span>
              <strong>{draftValue ?? resolvedValue ?? 0}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={draftValue ?? resolvedValue ?? 0}
              onChange={(e) => onDraft(Number(e.target.value))}
            />
            <div className="value-compare">
              当前已确认 <b>{resolvedValue == null ? "未引用" : `${resolvedValue}%`}</b>
              {changed && draftValue !== null && (
                <em>→ 排练改动 {draftValue}%（未确认前场景预览不变）</em>
              )}
            </div>
          </div>

          <div className="projection">
            <h3>下游影响试算（改动即作废）</h3>
            {(!proj || !proj.firstRefCueId) && <p className="hint">本 Cue 之后没有 Cue 引用该通道。</p>}
            {proj?.firstRefCueId && (
              <>
                <p className="hint">
                  下游第一条引用：<b>{cueName(proj.firstRefCueId)}</b>
                  {proj.blockerCueId && <> · 显式阻挡点：<b>{cueName(proj.blockerCueId)}</b></>}
                </p>
                {proj.affectedCueIds.length > 0 && (
                  <div className="affected-list">
                    顺延做法会带变：
                    {proj.affectedCueIds.map((id) => (
                      <span key={id} className="chip warn-chip">{cueName(id)}</span>
                    ))}
                    到阻挡点停止
                  </div>
                )}
                {proj.affectedCueIds.length === 0 && proj.blockerCueId && (
                  <div className="affected-list">
                    紧邻的下游引用已是锁定阻挡，顺延做法到此停止，后面不会变。
                  </div>
                )}
              </>
            )}
          </div>

          <div className="save-modes">
            <button
              className="mode-btn only"
              disabled={!changed}
              onClick={() => onSave("only")}
              title="写入当前 Cue；下游保持不变，必要时在下一条引用处回填旧值作为阻挡"
            >
              <b>{MODE_LABEL.only}</b>
              <span>下游 Cue 不跟随变动</span>
            </button>
            <button
              className="mode-btn propagate"
              disabled={!changed}
              onClick={() => onSave("propagate")}
              title="当前 Cue 写入并向下顺延，引用它的顺延格逐条带变，直到遇到显式锁定阻挡"
            >
              <b>{MODE_LABEL.propagate}</b>
              <span>向下带变，遇阻挡才停</span>
            </button>
          </div>
          {!changed && <p className="hint">通道值与已确认值一致，先在排练中改值再保存。</p>}
        </div>
      )}
    </section>
  );
}
