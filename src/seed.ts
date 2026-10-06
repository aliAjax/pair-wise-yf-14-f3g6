import {
  Board,
  Cell,
  Cue,
  Fixture,
  LegacyBoard,
  migrateLegacy,
} from "./model";

export interface Seed {
  fixtures: Fixture[];
  cues: Cue[];
  board: Board;
  legacy: LegacyBoard;
  legacyCues: Cue[];
  notes: string;
}

export const FIXTURES: Fixture[] = [
  { id: "F1", channel: 1, name: "面光-L", type: "面光", gel: "暖白 L201", color: "#ffe9b8", focus: "舞台左前区", x: 18, y: 12 },
  { id: "F2", channel: 2, name: "面光-C", type: "面光", gel: "暖白 L201", color: "#ffe9b8", focus: "演区中线", x: 50, y: 9 },
  { id: "F3", channel: 3, name: "面光-R", type: "面光", gel: "暖白 L201", color: "#ffe9b8", focus: "舞台右前区", x: 82, y: 12 },
  { id: "F4", channel: 4, name: "侧光-L", type: "侧光", gel: "冷蓝 L117", color: "#8ec9ff", focus: "左沿纵深", x: 7, y: 46 },
  { id: "F5", channel: 5, name: "侧光-R", type: "侧光", gel: "冷蓝 L117", color: "#8ec9ff", focus: "右沿纵深", x: 93, y: 46 },
  { id: "F6", channel: 6, name: "侧光低-L", type: "侧光", gel: "钢蓝 L161", color: "#5f8fd6", focus: "左台口", x: 9, y: 72 },
  { id: "F7", channel: 7, name: "逆光-L", type: "逆光", gel: "品红 L327", color: "#d896ff", focus: "后区左", x: 26, y: 84 },
  { id: "F8", channel: 8, name: "逆光-C", type: "逆光", gel: "品红 L327", color: "#d896ff", focus: "后区中", x: 50, y: 88 },
  { id: "F9", channel: 9, name: "逆光-R", type: "逆光", gel: "品红 L327", color: "#d896ff", focus: "后区右", x: 74, y: 84 },
  { id: "F10", channel: 21, name: "追光-FOH", type: "效果光", gel: "浅黄 L152", color: "#fff0a0", focus: "追演员位", x: 50, y: 30 },
];

export const CUES: Cue[] = [
  { id: "Q1", no: "Cue 1", name: "序场·冷蓝侧光", note: "二幕开场" },
  { id: "Q2", no: "Cue 2", name: "追光入场", note: "需演员走位确认" },
  { id: "Q3", no: "Cue 3", name: "情绪转折", note: "侧光压暗" },
  { id: "Q4", no: "Cue 4", name: "暖色谢幕", note: "版本 B" },
];

const ex = (value: number, locked = true): Cell => ({ kind: "explicit", value, locked });
const tr = (): Cell => ({ kind: "track" });

// v2 正式数据：显式锁定 + 顺延引用混用，能直接看到阻挡点
export const BOARD: Board = {
  Q1: { 1: ex(80), 2: ex(80), 3: ex(80), 4: ex(65), 5: ex(65), 6: ex(40), 7: ex(50), 8: ex(50), 9: ex(50) },
  Q2: { 1: tr(), 2: tr(), 3: tr(), 4: tr(), 5: tr(), 6: tr(), 7: tr(), 8: tr(), 9: tr(), 21: ex(80) },
  Q3: { 1: tr(), 2: tr(), 3: tr(), 4: ex(30), 5: ex(30), 6: tr(), 7: tr(), 8: tr(), 9: tr(), 21: tr() },
  Q4: { 1: ex(0), 2: ex(0), 3: ex(0), 4: tr(), 5: tr(), 6: tr(), 7: tr(), 8: tr(), 9: tr(), 21: tr() },
};

// v1 旧数据（排练备份恢复用）：没有锁定标记
export const LEGACY: LegacyBoard = {
  Q1: { 1: 80, 2: 80, 3: 80, 4: 65, 5: 65, 6: 40, 7: 50, 8: 50, 9: 50 },
  Q2: { 21: 80 },
  Q4: { 1: 0, 2: 0, 3: 0 },
};

export const LEGACY_CUES: Cue[] = CUES.map((c) => ({ ...c }));

export function buildSeed(): Seed {
  return {
    fixtures: FIXTURES.map((f) => ({ ...f })),
    cues: CUES.map((c) => ({ ...c })),
    board: structuredClone(BOARD),
    legacy: structuredClone(LEGACY),
    legacyCues: LEGACY_CUES.map((c) => ({ ...c })),
    notes: "排练版 2026-10-06 · 序场—谢幕共 4 条 Cue",
  };
}

// 升级演练：把 v1 旧数据按当时显式值回填锁定
export function buildLegacySeed(): {
  fixtures: Fixture[];
  cues: Cue[];
  board: Board;
  backfilled: number;
  perCue: Record<string, number>;
  notes: string;
} {
  const { board, backfilled, perCue } = migrateLegacy(LEGACY);
  return {
    fixtures: FIXTURES.map((f) => ({ ...f })),
    cues: LEGACY_CUES.map((c) => ({ ...c })),
    board,
    backfilled,
    perCue,
    notes: "由 v1 旧数据升级 · 显式值已回填锁定",
  };
}
