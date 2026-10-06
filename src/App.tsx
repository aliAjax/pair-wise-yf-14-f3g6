import { useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  applySave,
  Board,
  Cell,
  chLabel,
  ConflictRecord,
  ConsoleId,
  Cue,
  diffRequests,
  diffSnapshot,
  Fixture,
  FixtureType,
  formatTime,
  migrateLegacy,
  projectDownstream,
  resolveLevels,
  SaveMode,
  SaveRequest,
  Snapshot,
} from "./model";
import { buildSeed, LEGACY } from "./seed";
import { StageMap } from "./components/StageMap";
import { CueTable } from "./components/CueTable";
import { Preview } from "./components/Preview";
import { RehearsalPanel } from "./components/RehearsalPanel";
import { ConflictList, ConflictSimulator, SimSide } from "./components/ConflictPanel";
import { AuditLog, LogEntry, Metric, NotesPanel, Sidebar } from "./components/Sidebar";

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq += 1)}`;

export default function App() {
  const seed = useRef(buildSeed());
  const [title, setTitle] = useState("《夜色回廊》合成排练");
  const [notes, setNotes] = useState(seed.current.notes);
  const [fixtures] = useState<Fixture[]>(seed.current.fixtures);
  const [cues, setCues] = useState<Cue[]>(seed.current.cues);
  const [board, setBoard] = useState<Board>(seed.current.board);
  const [schemaVersion, setSchemaVersion] = useState(2);

  const [filter, setFilter] = useState<FixtureType | "all">("all");
  const [currentCueId, setCurrentCueId] = useState(cues[0].id);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(fixtures[0].id);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const [seat, setSeat] = useState<ConsoleId>("main");
  const [previewView, setPreviewView] = useState<"confirmed" | "candidate">("confirmed");

  const [confirmed, setConfirmed] = useState<Snapshot>(() =>
    resolveLevels(seed.current.cues, seed.current.board)
  );
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: nextId("log"),
      time: Date.now(),
      kind: "system",
      text: "排练台就绪：显式锁定为阻挡点，未锁定的引用格向下顺延。",
    },
  ]);
  // 每盏灯最近一次“已保存但未被后续确认覆盖”的在途版本（同存仲裁依据）
  const pendingWinner = useRef<Map<string, SaveRequest>>(new Map());
  const [simRound, setSimRound] = useState(0);
  const [simFixtureId, setSimFixtureId] = useState(fixtures[0].id);
  const [simCueId, setSimCueId] = useState(cues[0].id);

  const levels = useMemo(() => resolveLevels(cues, board), [cues, board]);
  const staleIds = useMemo(
    () => new Set(diffSnapshot(cues, levels, confirmed)),
    [cues, levels, confirmed]
  );

  const selectedFixture = fixtures.find((f) => f.id === selectedFixtureId) ?? null;
  const currentCue = cues.find((c) => c.id === currentCueId) ?? cues[0];
  const resolvedValue =
    selectedFixture != null
      ? (levels[currentCue.id]?.[selectedFixture.channel] ?? null)
      : null;

  const addLog = (kind: LogEntry["kind"], text: string) =>
    setLogs((prev) => [{ id: nextId("log"), time: Date.now(), kind, text }, ...prev]);

  const cueName = (id: string) => {
    const c = cues.find((x) => x.id === id);
    return c ? `${c.no} ${c.name}` : id;
  };
  const fixtureName = (id: string) => {
    const f = fixtures.find((x) => x.id === id);
    return f ? `${chLabel(f.channel)} ${f.name}` : id;
  };

  // 作废通道：当前 Cue 中已确认值与重算值不同的通道
  const staleChannelsOf = (cueId: string): Set<number> => {
    const now = levels[cueId] ?? {};
    const ok = confirmed[cueId] ?? {};
    const s = new Set<number>();
    for (const key of new Set([...Object.keys(now), ...Object.keys(ok)])) {
      if (now[Number(key)] !== ok[Number(key)]) s.add(Number(key));
    }
    return s;
  };
  const currentStaleChannels = staleChannelsOf(currentCue.id);

  // —— 保存：only = 只改当前 Cue（必要时回填阻挡）；propagate = 继续顺延到阻挡点 ——
  const commitSave = (req: SaveRequest, pairLoser?: SaveRequest, round = simRound) => {
    const before = resolveLevels(cues, board);
    const result = applySave(cues, board, before, req);
    setBoard(result.board);
    pendingWinner.current.set(req.fixtureId, req);

    const fixture = fixtures.find((f) => f.id === req.fixtureId);
    const modeText = req.mode === "only" ? "只改当前Cue" : "继续顺延";
    let text = `${req.console === "main" ? "主控台" : "备份台"}保存 ${fixture ? chLabel(fixture.channel) : req.channel}＝${req.value}% 到 ${cueName(req.cueId)}（${modeText}）`;
    if (result.autoBlockCueId) {
      text += `；为阻断顺延，在 ${cueName(result.autoBlockCueId)} 回填旧值 ${result.autoBlockValue}% 锁定`;
    }
    if (req.mode === "propagate" && result.changedCueIds.length > 1) {
      text += `；顺延带变 ${result.changedCueIds.filter((id) => id !== req.cueId).map(cueName).join("、")}`;
    }
    text += `；${result.changedCueIds.map(cueName).join("、")} 已作废，待重新确认。`;
    addLog("save", text);

    if (pairLoser) {
      const rows = diffRequests(req, pairLoser);
      setConflicts((prev) => [
        {
          id: nextId("conf"),
          fixtureId: req.fixtureId,
          winner: req,
          loser: pairLoser,
          rows,
          resolvedRound: round,
        },
        ...prev,
      ]);
      addLog(
        "conflict",
        `同存仲裁：${pairLoser.console === "main" ? "主控台" : "备份台"} ${pairLoser.value}%（${formatTime(pairLoser.arrivedAt)}）晚到未生效，与先到版 ${req.value}% 的差异已列入台账。`
      );
    }
  };

  // 排练面板保存：若该灯已有另一席位的在途版本，按到达时刻先到生效
  const saveFromPanel = (mode: SaveMode) => {
    if (!selectedFixture || draftValue == null) return;
    const req: SaveRequest = {
      id: nextId("sv"),
      console: seat,
      cueId: currentCue.id,
      fixtureId: selectedFixture.id,
      channel: selectedFixture.channel,
      value: draftValue,
      mode,
      arrivedAt: Date.now(),
    };
    const pending = pendingWinner.current.get(req.fixtureId);
    if (pending && pending.console !== seat && pending.arrivedAt <= req.arrivedAt) {
      // 另一席先到，继续保持；本次为晚到版，只登记差异
      const rows = diffRequests(pending, req);
      setConflicts((prev) => [
        {
          id: nextId("conf"),
          fixtureId: req.fixtureId,
          winner: pending,
          loser: req,
          rows,
          resolvedRound: simRound,
        },
        ...prev,
      ]);
      addLog(
        "conflict",
        `同存仲裁：本席 ${seat === "main" ? "主控台" : "备份台"} ${req.value}% 晚到，${pending.console === "main" ? "主控台" : "备份台"} ${pending.value}% 先到已生效，差异已列入台账。`
      );
      return;
    }
    setDraftValue(null);
    commitSave(req);
  };

  // 双台同存演练：成对请求内部先按到达时刻仲裁
  const simulate = (a: SimSide, b: SimSide) => {
    const fixture = fixtures.find((f) => f.id === simFixtureId);
    if (!fixture) return;
    const base = Date.now();
    const mk = (s: SimSide): SaveRequest => ({
      id: nextId("sv"),
      console: s.console,
      cueId: simCueId,
      fixtureId: fixture.id,
      channel: fixture.channel,
      value: s.value,
      mode: s.mode,
      arrivedAt: base + s.offsetMs,
    });
    const ra = mk(a);
    const rb = mk(b);
    let winner: SaveRequest;
    let loser: SaveRequest;
    if (ra.arrivedAt === rb.arrivedAt) {
      winner = ra.console === "main" ? ra : rb;
      loser = winner === ra ? rb : ra;
    } else if (ra.arrivedAt < rb.arrivedAt) {
      winner = ra;
      loser = rb;
    } else {
      winner = rb;
      loser = ra;
    }
    const nextRound = simRound + 1;
    setSimRound(nextRound);
    addLog(
      "conflict",
      `同存演练：${fixtureName(fixture.id)} 两版到达 ${formatTime(ra.arrivedAt)} / ${formatTime(
        rb.arrivedAt
      )}，${winner.console === "main" ? "主控台" : "备份台"} ${winner.value}% 先到。`
    );
    commitSave(winner, loser, nextRound);
  };

  // 重新确认：接受当前重算结果成为“已确认版本”，预览随之更新
  const confirmCue = (cueId: string) => {
    setConfirmed((prev) => ({ ...prev, [cueId]: structuredClone(levels[cueId] ?? {}) }));
    for (const [fid, req] of pendingWinner.current) {
      if (req.cueId === cueId) pendingWinner.current.delete(fid);
    }
    addLog("confirm", `${cueName(cueId)} 重算结果已重新确认，当前场景预览更新为最新值。`);
  };
  const confirmAll = () => {
    if (staleIds.size === 0) return;
    const next = structuredClone(confirmed);
    staleIds.forEach((id) => {
      next[id] = structuredClone(levels[id] ?? {});
    });
    setConfirmed(next);
    pendingWinner.current.clear();
    addLog("confirm", `全部 ${staleIds.size} 条作废 Cue 已逐条重新确认。`);
  };

  // 锁定/顺延切换：锁定即显式阻挡，顺延即引用上游
  const toggleLock = (cueId: string, channel: number) => {
    setBoard((prev) => {
      const next = structuredClone(prev);
      if (!next[cueId]) next[cueId] = {};
      const cell = next[cueId][channel];
      if (cell && cell.kind === "explicit" && cell.locked) {
        next[cueId][channel] = { kind: "track" };
        addLog("system", `${cueName(cueId)} 的 ${chLabel(channel)} 取消锁定改为顺延引用，阻挡点移除，下游将重新顺延试算。`);
      } else if (cell && cell.kind === "explicit" && !cell.locked) {
        cell.locked = true;
        addLog("system", `${cueName(cueId)} 的 ${chLabel(channel)} 旧值 ${cell.value}% 补设为显式锁定。`);
      } else {
        const v = levels[cueId]?.[channel] ?? 0;
        next[cueId][channel] = { kind: "explicit", value: v ?? 0, locked: true };
        addLog("system", `${cueName(cueId)} 的 ${chLabel(channel)} 按现值 ${v ?? 0}% 设为显式锁定，顺延到此为止。`);
      }
      return next;
    });
  };

  // —— v1 旧数据：先以“无锁定标记”形态载入，再执行升级回填 ——
  const loadLegacyRaw = () => {
    const raw: Board = {};
    for (const [cueId, row] of Object.entries(LEGACY)) {
      raw[cueId] = {};
      for (const [ch, value] of Object.entries(row)) {
        raw[cueId][Number(ch)] = { kind: "explicit", value, locked: false };
      }
    }
    setBoard(raw);
    setSchemaVersion(1);
    setConfirmed(resolveLevels(seed.current.cues, raw));
    pendingWinner.current.clear();
    setConflicts([]);
    addLog("migrate", "已载入 v1 旧数据：所有显式值均无锁定标记，等待升级回填。");
  };

  const runMigration = () => {
    const { board: migrated, backfilled, perCue } = migrateLegacy(
      Object.fromEntries(
        Object.entries(board).map(([cueId, row]) => [
          cueId,
          Object.fromEntries(
            Object.entries(row)
              .filter(([, c]) => c.kind === "explicit")
              .map(([ch, c]) => [ch, (c as Extract<Cell, { kind: "explicit" }>).value])
          ),
        ])
      )
    );
    setBoard(migrated);
    setSchemaVersion(2);
    setConfirmed(resolveLevels(cues, migrated));
    const detail = Object.entries(perCue)
      .map(([id, n]) => `${cueName(id)} ${n} 格`)
      .join("、");
    addLog("migrate", `升级完成：按当时显式值回填锁定标记共 ${backfilled} 格（${detail}），旧数据现可按阻挡/顺延语义参与排练。`);
  };

  const resetAll = () => {
    const s = buildSeed();
    setCues(s.cues);
    setBoard(s.board);
    setSchemaVersion(2);
    setConfirmed(resolveLevels(s.cues, s.board));
    setConflicts([]);
    pendingWinner.current.clear();
    setSimRound(0);
    setDraftValue(null);
    addLog("system", "已重置为排练种子数据。");
  };

  const onReapply = (r: ConflictRecord, useLoser: boolean) => {
    if (!useLoser) {
      addLog("system", `台账 ${fixtureName(r.fixtureId)}：核对后维持先到版 ${r.winner.value}% 不变。`);
      return;
    }
    const base = r.loser;
    const req: SaveRequest = { ...base, id: nextId("sv"), arrivedAt: Date.now() };
    const pending = pendingWinner.current.get(req.fixtureId);
    if (pending && pending.console !== req.console && pending.arrivedAt < req.arrivedAt) {
      const rows = diffRequests(pending, req);
      setConflicts((prev) => [
        { id: nextId("conf"), fixtureId: req.fixtureId, winner: pending, loser: req, rows, resolvedRound: simRound },
        ...prev,
      ]);
      addLog("conflict", `晚到版重提仍晚于在途先到版 ${pending.value}%，再次登记差异；如需覆盖，请由先到席位确认后再提。`);
    } else {
      commitSave(req);
    }
  };

  const projection =
    selectedFixture != null
      ? projectDownstream(cues, board, currentCue.id, selectedFixture.channel)
      : null;

  const metrics: Metric[] = [
    { label: "灯具数量", value: fixtures.length },
    { label: "Cue数量", value: cues.length },
    { label: "当前场景", value: currentCue.no },
    {
      label: "待确认（已作废）Cue",
      value: staleIds.size,
      tone: staleIds.size > 0 ? "warn" : "ok",
    },
  ];

  const candidateValues = levels[currentCue.id] ?? {};
  const confirmedValues = confirmed[currentCue.id] ?? {};

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62002 · 可核对的排练台 · 端口 62002 · 数据 v{schemaVersion}</p>
        <h1>剧场灯光 Cue 表管理 · 排练台</h1>
        <span>
          通道值改动即令下游引用 Cue 作废重算，未重新确认前当前场景预览保持已确认版本；保存时区分
          <b> 只改当前Cue </b>与<b> 继续顺延（遇显式锁定阻挡才停）</b>；主/备台同存按到达时刻先到生效、晚到列差异；
          v1 旧数据升级时按当时显式值回填锁定。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label} className={m.tone ?? ""}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {staleIds.size > 0 && (
        <div className="stale-banner">
          <span>
            🔁 {staleIds.size} 条 Cue 已作废待重算：{[...staleIds].map(cueName).join("、")}
          </span>
          <div className="stale-actions">
            <button onClick={() => confirmCue(currentCue.id)} disabled={!staleIds.has(currentCue.id)}>
              重新确认当前 Cue
            </button>
            <button className="primary" onClick={confirmAll}>
              逐条重新确认全部
            </button>
          </div>
        </div>
      )}

      <div className="layout">
        <Sidebar
          metrics={metrics}
          filter={filter}
          onFilter={setFilter}
          schemaVersion={schemaVersion}
          onLoadLegacy={schemaVersion === 1 ? runMigration : loadLegacyRaw}
          onReset={resetAll}
        />

        <div className="main-col">
          <StageMap
            fixtures={fixtures}
            filter={filter}
            selectedId={selectedFixtureId}
            currentCueId={currentCue.no}
            values={previewView === "confirmed" ? confirmedValues : candidateValues}
            staleChannelSet={currentStaleChannels}
            onSelect={(id) => {
              setSelectedFixtureId(id);
              setDraftValue(null);
            }}
          />

          <CueTable
            cues={cues}
            fixtures={fixtures}
            board={board}
            levels={levels}
            currentCueId={currentCue.id}
            selectedFixtureId={selectedFixtureId}
            staleCueIds={staleIds}
            activeChannels={new Set(selectedFixture ? [selectedFixture.channel] : [])}
            onSelectCue={setCurrentCueId}
            onSelectFixture={(id) => {
              setSelectedFixtureId(id);
              setDraftValue(null);
            }}
            onToggleLock={toggleLock}
          />

          <div className="two-col">
            <RehearsalPanel
              seat={seat}
              onSeat={setSeat}
              fixture={selectedFixture}
              cue={currentCue}
              resolvedValue={resolvedValue}
              draftValue={draftValue}
              onDraft={setDraftValue}
              proj={projection}
              cueName={cueName}
              onSave={saveFromPanel}
            />
            <Preview
              cue={currentCue}
              fixtures={fixtures.filter((f) => filter === "all" || f.type === filter)}
              confirmedValues={confirmedValues}
              candidateValues={candidateValues}
              staleChannels={currentStaleChannels}
              hasUnconfirmed={staleIds.size > 0 || draftValue != null}
              draftPending={draftValue != null}
              view={previewView}
              onToggleView={() =>
                setPreviewView((v) => (v === "confirmed" ? "candidate" : "confirmed"))
              }
            />
          </div>

          <ConflictSimulator
            fixtures={fixtures}
            cues={cues}
            fixtureId={simFixtureId}
            cueId={simCueId}
            onSimulate={simulate}
            onSelectTarget={(fid, cid) => {
              setSimFixtureId(fid);
              setSimCueId(cid);
              setSelectedFixtureId(fid);
              setCurrentCueId(cid);
              setDraftValue(null);
            }}
          />

          <ConflictList
            records={conflicts}
            cueName={cueName}
            fixtureName={fixtureName}
            onReapply={onReapply}
          />

          <NotesPanel title={title} notes={notes} onTitle={setTitle} onNotes={setNotes} />
          <AuditLog entries={logs} />
        </div>
      </div>
    </main>
  );
}
