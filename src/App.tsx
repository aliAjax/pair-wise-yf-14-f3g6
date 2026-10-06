import { useMemo, useState } from "react";
import type { ConsoleId, Cue, Fixture, OldCue, SaveMode, Version } from "./types";
import { FIXTURES, OLD_CUES, TYPE_FILTERS } from "./data";
import {
  addVersion,
  confirmRecompute,
  isStale,
  migrateCues,
  saveEdit,
  staleFixtures,
} from "./engine";
import StagePlot from "./components/StagePlot";
import CueList from "./components/CueList";
import Preview from "./components/Preview";
import ConsolePanel from "./components/ConsolePanel";

let versionSeq = 0;
const nextVersionId = () => `v${++versionSeq}`;

export default function App() {
  const [migrated, setMigrated] = useState(false);
  const [cues, setCues] = useState<Cue[]>([]);
  const [oldCues] = useState<OldCue[]>(OLD_CUES);

  const [currentCueId, setCurrentCueId] = useState<string>(OLD_CUES[0].id);
  const [filter, setFilter] = useState<string>("全部");
  const [selectedFid, setSelectedFid] = useState<string>(FIXTURES[0].id);
  const [stagedValue, setStagedValue] = useState<number>(FIXTURES[0] ? 0 : 0);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<SaveMode>("propagate");
  const [versions, setVersions] = useState<Version[]>([]);
  const [conflictNote, setConflictNote] = useState<string | null>(null);
  const [blockedNote, setBlockedNote] = useState<string | null>(null);

  const fixtures = FIXTURES;

  const currentCue = useMemo(
    () => cues.find((c) => c.id === currentCueId),
    [cues, currentCueId]
  );

  const visibleFixtures = useMemo(() => {
    if (filter === "全部") return fixtures;
    return fixtures.filter((f) => f.type === filter);
  }, [fixtures, filter]);

  const staleCount = useMemo(
    () => cues.filter((c, i) => isStale(c, i, fixtures)).length,
    [cues, fixtures]
  );

  const currentStaleIds = useMemo(
    () => (currentCue ? staleFixtures(cues, cues.findIndex((c) => c.id === currentCue.id), fixtures) : []),
    [cues, currentCue, fixtures]
  );

  // 选中灯在当前 Cue 的已确认亮度（编辑起点）
  const confirmedLevel = currentCue?.confirmed[selectedFid] ?? 0;
  const selectedFixture = fixtures.find((f) => f.id === selectedFid);

  function handleSelectFixture(fid: string) {
    setSelectedFid(fid);
    const lvl = currentCue?.confirmed[fid] ?? 0;
    setStagedValue(lvl);
    setDirty(false);
  }

  function handleSelectCue(id: string) {
    setCurrentCueId(id);
    const lvl = cues.find((c) => c.id === id)?.confirmed[selectedFid] ?? 0;
    setStagedValue(lvl);
    setDirty(false);
  }

  function handleSlider(v: number) {
    setStagedValue(v);
    setDirty(v !== confirmedLevel);
  }

  function handleMigrate() {
    const migratedCues = migrateCues(oldCues, fixtures);
    setCues(migratedCues);
    setMigrated(true);
    setCurrentCueId(migratedCues[0].id);
    setStagedValue(migratedCues[0].confirmed[selectedFid] ?? 0);
    setDirty(false);
  }

  function handleSave(consoleId: ConsoleId) {
    if (!currentCue) return;
    const { cues: next, blockedAt } = saveEdit(cues, fixtures, currentCue.id, selectedFid, stagedValue, mode);
    setCues(next);

    const { versions: nextVersions, conflict } = addVersion(versions, {
      id: nextVersionId(),
      console: consoleId,
      cueId: currentCue.id,
      fixtureId: selectedFid,
      value: stagedValue,
      time: Date.now(),
    });
    setVersions(nextVersions);

    if (conflict) {
      const fix = fixtures.find((f) => f.id === selectedFid);
      setConflictNote(
        `${consoleId === "main" ? "主控台" : "备份台"}保存与先到版本冲突：${fix?.code} 在 ${currentCue.no} 先到 ${conflict.value}% 已生效，本次 ${stagedValue}% 列为晚到差异。`
      );
    } else {
      setConflictNote(null);
    }

    if (mode === "only" && blockedAt) {
      const blockedCue = next.find((c) => c.id === blockedAt);
      setBlockedNote(`已在下一条 ${blockedCue?.no} 插入旧值阻挡（${confirmedLevel}%），顺延在此停止，后面 Cue 不跟着变。`);
    } else {
      setBlockedNote(null);
    }
    setDirty(false);
  }

  function handleConfirm(cueId: string) {
    setCues((prev) => confirmRecompute(prev, fixtures, cueId));
  }

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62002 · 排练台</p>
        <h1>剧场灯光 Cue 表核对台</h1>
        <span>
          排练中改动灯具通道值后，下游引用它的 Cue 自动作废重算；未重新确认前当前场景预览不跟着变。
          保存时区分「只改当前 Cue」与「继续顺延」，顺延遇锁定标记即停；主控台与备份台同时保存同一盏灯时先到生效、晚到列差异。
        </span>
      </section>

      {!migrated && (
        <section className="migrate-banner">
          <div>
            <strong>检测到旧版数据（{oldCues.length} 条 Cue）没有锁定标记。</strong>
            <p>升级时将按当时的显式值逐条回填锁定标记，回填后即可使用作废重算与顺延核对。</p>
          </div>
          <button type="button" className="primary" onClick={handleMigrate}>
            升级数据·回填锁定标记
          </button>
        </section>
      )}

      <section className="metrics">
        <article>
          <small>灯具数量</small>
          <strong>{fixtures.length}</strong>
        </article>
        <article>
          <small>Cue 数量</small>
          <strong>{migrated ? cues.length : oldCues.length}</strong>
        </article>
        <article>
          <small>当前场景</small>
          <strong>{currentCue?.no ?? "—"}</strong>
        </article>
        <article>
          <small>作废·待重算</small>
          <strong className={staleCount > 0 ? "warn" : ""}>{staleCount}</strong>
        </article>
      </section>

      {migrated && (
        <>
          <section className="workspace">
            <aside className="panel">
              <h2>灯具筛选</h2>
              <div className="chips">
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={filter === t ? "active" : ""}
                    onClick={() => setFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <h2 className="mt">灯位</h2>
              <div className="fixture-list">
                {visibleFixtures.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={"fixture-row" + (selectedFid === f.id ? " selected" : "")}
                    onClick={() => handleSelectFixture(f.id)}
                  >
                    <i style={{ background: f.color }} />
                    <div>
                      <b>{f.code}</b>
                      <span>{f.channel}</span>
                    </div>
                    <em>{currentCue?.confirmed[f.id] ?? 0}%</em>
                  </button>
                ))}
              </div>
            </aside>

            <section className="panel">
              <div className="heading">
                <div>
                  <p>当前 Cue 编辑</p>
                  <h2>
                    {currentCue?.no} · {currentCue?.label}
                  </h2>
                </div>
                <span className={"badge " + (dirty ? "dirty" : "ok")}>
                  {dirty ? "未保存改动" : "已与预览一致"}
                </span>
              </div>

              <div className="editor-fixture">
                <div className="editor-fixture-head">
                  <i style={{ background: selectedFixture?.color }} />
                  <div>
                    <b>{selectedFixture?.code}</b>
                    <span>
                      {selectedFixture?.channel} · {selectedFixture?.focus} · {selectedFixture?.type}
                    </span>
                  </div>
                </div>
                <div className="slider-row">
                  <span>通道亮度</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={stagedValue}
                    onChange={(e) => handleSlider(Number(e.target.value))}
                  />
                  <b className="slider-value">{stagedValue}%</b>
                </div>
                <p className="editor-hint">
                  已确认 {confirmedLevel}% → 当前编辑 {stagedValue}%
                  {dirty && "（预览暂不跟随，保存并确认后才更新）"}
                </p>
              </div>

              <div className="save-modes">
                <label className={"mode" + (mode === "only" ? " active" : "")}>
                  <input
                    type="radio"
                    name="savemode"
                    checked={mode === "only"}
                    onChange={() => setMode("only")}
                  />
                  <div>
                    <b>只改当前 Cue</b>
                    <span>在下一条 Cue 插入旧值阻挡，后面 Cue 不跟着变</span>
                  </div>
                </label>
                <label className={"mode" + (mode === "propagate" ? " active" : "")}>
                  <input
                    type="radio"
                    name="savemode"
                    checked={mode === "propagate"}
                    onChange={() => setMode("propagate")}
                  />
                  <div>
                    <b>继续顺延</b>
                    <span>新值顺延下游，遇锁定标记才停；未确认前下游作废</span>
                  </div>
                </label>
              </div>

              <div className="save-actions">
                <button type="button" className="primary" onClick={() => handleSave("main")}>
                  主控台保存
                </button>
                <button type="button" onClick={() => handleSave("backup")}>
                  备份台保存
                </button>
              </div>

              {conflictNote && <div className="notice conflict">⚠ {conflictNote}</div>}
              {blockedNote && <div className="notice blocked">⛔ {blockedNote}</div>}
              {currentStaleIds.length > 0 && (
                <div className="notice stale">
                  当前 Cue 有 {currentStaleIds.length} 灯因上游顺延作废待重算，请到下方 Cue 列表确认。
                </div>
              )}
            </section>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p>舞台平面</p>
                <h2>灯位与当前亮度</h2>
              </div>
            </div>
            <StagePlot
              fixtures={fixtures}
              levels={currentCue?.confirmed ?? {}}
              selectedId={selectedFid}
              onSelect={handleSelectFixture}
              staleIds={currentStaleIds}
              height={280}
            />
          </section>

          <section className="workspace mt">
            <section className="panel">
              <div className="heading">
                <div>
                  <p>Cue 列表</p>
                  <h2>触发顺序与作废状态</h2>
                </div>
              </div>
              <CueList
                cues={cues}
                fixtures={fixtures}
                currentId={currentCueId}
                onSelect={handleSelectCue}
                onConfirm={handleConfirm}
              />
            </section>

            <section className="panel">
              <Preview cue={currentCue} cues={cues} fixtures={fixtures} dirty={dirty} stale={currentStaleIds.length > 0} />
            </section>
          </section>

          <section className="panel mt">
            <ConsolePanel versions={versions} cues={cues} fixtures={fixtures} onClear={() => setVersions([])} />
          </section>
        </>
      )}
    </main>
  );
}
