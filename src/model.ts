// 排练台领域模型与纯逻辑：Cue 解析、顺延/阻挡、双台仲裁、旧数据升级回填

export type ConsoleId = "main" | "backup";
export type FixtureType = "面光" | "侧光" | "逆光" | "效果光";
export type SaveMode = "only" | "propagate";

export interface Fixture {
  id: string;
  channel: number;
  name: string;
  type: FixtureType;
  gel: string; // 色片
  color: string; // 灯位图用色
  focus: string; // 焦点位置
  x: number; // 舞台平面坐标（百分比）
  y: number;
}

export interface Cue {
  id: string;
  no: string;
  name: string;
  note: string;
}

// 一个“Cue × 通道”格子：要么是显式值（可作为阻挡），要么顺延引用上游
export interface ExplicitCell {
  kind: "explicit";
  value: number;
  locked: boolean; // 锁定标记：显式阻挡，顺延传播到此为止
}
export interface TrackCell {
  kind: "track"; // 顺延：沿用最近一个显式值
}
export type Cell = ExplicitCell | TrackCell;

export type Board = Record<string, Record<number, Cell>>;
// v1 旧数据：只有数值，没有锁定标记
export type LegacyBoard = Record<string, Record<number, number>>;

// 每个 Cue 每个被引用通道解析后的亮度（null = 顺延但上游从未给值）
export type Snapshot = Record<string, Record<number, number | null>>;

export interface SaveRequest {
  id: string;
  console: ConsoleId;
  cueId: string;
  fixtureId: string;
  channel: number;
  value: number;
  mode: SaveMode;
  arrivedAt: number;
}

export interface DiffRow {
  label: string;
  winner: string;
  loser: string;
  delta?: string;
}

export interface ConflictRecord {
  id: string;
  fixtureId: string;
  winner: SaveRequest;
  loser: SaveRequest;
  rows: DiffRow[];
  resolvedRound: number;
}

export interface Projection {
  firstRefCueId: string | null; // 下游第一条引用该通道的 Cue
  affectedCueIds: string[]; // 顺延时会被带变的 Cue（顺延格子）
  blockerCueId: string | null; // 遇到的显式阻挡 Cue
}

export const CONSOLE_LABEL: Record<ConsoleId, string> = {
  main: "主控台",
  backup: "备份台",
};

export const MODE_LABEL: Record<SaveMode, string> = {
  only: "只改当前Cue",
  propagate: "继续顺延",
};

export function formatTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(
    d.getMilliseconds(),
    3
  )}`;
}

export function chLabel(channel: number): string {
  return `CH${String(channel).padStart(3, "0")}`;
}

// —— v1 → v2 升级：旧数据没有锁定标记，按升级时的显式值原样回填为锁定 ——
export function migrateLegacy(legacy: LegacyBoard): {
  board: Board;
  backfilled: number;
  perCue: Record<string, number>;
} {
  const board: Board = {};
  let backfilled = 0;
  const perCue: Record<string, number> = {};
  for (const [cueId, row] of Object.entries(legacy)) {
    board[cueId] = {};
    let n = 0;
    for (const [ch, value] of Object.entries(row)) {
      board[cueId][Number(ch)] = {
        kind: "explicit",
        value,
        locked: true, // 回填：当时的显式值一律视为锁定阻挡
      };
      n += 1;
    }
    perCue[cueId] = n;
    backfilled += n;
  }
  return { board, backfilled, perCue };
}

// 按 Cue 顺序解析全表：显式值写入载波，顺延格沿用载波
export function resolveLevels(cues: Cue[], board: Board): Snapshot {
  const carry = new Map<number, number | null>();
  const out: Snapshot = {};
  for (const cue of cues) {
    const cells = board[cue.id] ?? {};
    const row: Record<number, number | null> = {};
    for (const [key, cell] of Object.entries(cells)) {
      const channel = Number(key);
      if (cell.kind === "explicit") {
        carry.set(channel, cell.value);
        row[channel] = cell.value;
      } else {
        row[channel] = carry.has(channel) ? (carry.get(channel) as number | null) : null;
      }
    }
    out[cue.id] = row;
  }
  return out;
}

// 从某 Cue 的某通道向下游做传播试算
export function projectDownstream(
  cues: Cue[],
  board: Board,
  cueId: string,
  channel: number
): Projection {
  const start = cues.findIndex((c) => c.id === cueId);
  const result: Projection = {
    firstRefCueId: null,
    affectedCueIds: [],
    blockerCueId: null,
  };
  for (let i = start + 1; i < cues.length; i += 1) {
    const id = cues[i].id;
    const cell = board[id]?.[channel];
    if (!cell) continue; // 未引用该通道，跳过
    if (result.firstRefCueId === null) result.firstRefCueId = id;
    if (cell.kind === "explicit" && cell.locked) {
      result.blockerCueId = id; // 显式锁定阻挡，传播停止
      break;
    }
    result.affectedCueIds.push(id);
  }
  return result;
}

export interface AppliedSave {
  board: Board;
  autoBlockCueId: string | null;
  autoBlockValue: number | null;
  changedCueIds: string[];
}

// 执行一次保存。only：只改当前 Cue，若下一条引用是顺延格，则回填旧值作为阻挡；
// propagate：当前写入显式值，顺延格交给解析流程向下带，遇到锁定阻挡自然停止。
export function applySave(
  cues: Cue[],
  board: Board,
  levelsBefore: Snapshot,
  req: SaveRequest
): AppliedSave {
  const next: Board = structuredClone(board);
  if (!next[req.cueId]) next[req.cueId] = {};
  next[req.cueId][req.channel] = {
    kind: "explicit",
    value: req.value,
    locked: true,
  };

  const proj = projectDownstream(cues, board, req.cueId, req.channel);
  let autoBlockCueId: string | null = null;
  let autoBlockValue: number | null = null;

  if (req.mode === "propagate") {
    // 顺延路径上未锁定的旧显式值（如 v1 未升级数据）转为顺延引用，由锁定阻挡点截断
    for (const id of proj.affectedCueIds) {
      const cell = board[id]?.[req.channel];
      if (cell && cell.kind === "explicit" && !cell.locked) {
        if (!next[id]) next[id] = {};
        next[id][req.channel] = { kind: "track" };
      }
    }
  }

  if (req.mode === "only" && proj.firstRefCueId && proj.blockerCueId !== proj.firstRefCueId) {
    // 下一条引用是“顺延”：在该处回填升级前解析到的旧值并锁定，保住其后所有 Cue
    const oldVal = levelsBefore[proj.firstRefCueId]?.[req.channel];
    if (oldVal !== undefined && oldVal !== null) {
      if (!next[proj.firstRefCueId]) next[proj.firstRefCueId] = {};
      next[proj.firstRefCueId][req.channel] = {
        kind: "explicit",
        value: oldVal,
        locked: true,
      };
      autoBlockCueId = proj.firstRefCueId;
      autoBlockValue = oldVal;
    }
  }

  const after = resolveLevels(cues, next);
  const changedCueIds = cues
    .map((c) => c.id)
    .filter((id) => {
      const a = after[id] ?? {};
      const b = levelsBefore[id] ?? {};
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      return [...keys].some((k) => a[Number(k)] !== b[Number(k)]);
    });

  return { board: next, autoBlockCueId, autoBlockValue, changedCueIds };
}

// 两个快照之间，哪些 Cue 的解析结果不同（即已作废、待重新确认）
export function diffSnapshot(cues: Cue[], now: Snapshot, confirmed: Snapshot): string[] {
  return cues
    .map((c) => c.id)
    .filter((id) => {
      const a = now[id] ?? {};
      const b = confirmed[id] ?? {};
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      return [...keys].some((k) => a[Number(k)] !== b[Number(k)]);
    });
}

// 晚到版本与先到版本的逐条差异
export function diffRequests(winner: SaveRequest, loser: SaveRequest): DiffRow[] {
  const rows: DiffRow[] = [
    {
      label: "通道亮度值",
      winner: `${winner.value}%`,
      loser: `${loser.value}%`,
      delta: `${loser.value - winner.value > 0 ? "+" : ""}${loser.value - winner.value}`,
    },
    { label: "保存做法", winner: MODE_LABEL[winner.mode], loser: MODE_LABEL[loser.mode] },
    { label: "到达时刻", winner: formatTime(winner.arrivedAt), loser: formatTime(loser.arrivedAt) },
    { label: "提交席", winner: CONSOLE_LABEL[winner.console], loser: CONSOLE_LABEL[loser.console] },
  ];
  return rows;
}

export function snapshotOf(levels: Snapshot): Snapshot {
  return structuredClone(levels);
}
