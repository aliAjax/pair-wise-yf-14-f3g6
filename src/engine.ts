import type { Cue, Fixture, OldCue, SaveMode, Version } from "./types";

export const DEFAULT_LEVEL = 0;

/**
 * 计算某灯在第 i 条 Cue 的有效亮度：
 * 从该 Cue 向前找最近一个带锁定标记的显式值，否则为 0。
 */
export function effectiveAt(cues: Cue[], i: number, fid: string): number {
  for (let k = i; k >= 0; k--) {
    if (cues[k].locks[fid]) {
      return cues[k].values[fid] ?? DEFAULT_LEVEL;
    }
  }
  return DEFAULT_LEVEL;
}

/** 重算某条 Cue 的全部有效亮度 */
export function recomputeCue(cues: Cue[], i: number, fixtures: Fixture[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fixtures) out[f.id] = effectiveAt(cues, i, f.id);
  return out;
}

/** 作废的灯：已确认快照与重算结果不一致 */
export function staleFixtures(cues: Cue[], i: number, fixtures: Fixture[]): string[] {
  const eff = recomputeCue(cues, i, fixtures);
  return fixtures.filter((f) => (cues[i].confirmed[f.id] ?? 0) !== eff[f.id]).map((f) => f.id);
}

export function isStale(cues: Cue[], i: number, fixtures: Fixture[]): boolean {
  return staleFixtures(cues, i, fixtures).length > 0;
}

/**
 * 保存一次灯具改动。
 * - only: 只改当前 Cue，并在下一条 Cue 插入旧值阻挡（顺延在此停止）
 * - propagate: 改当前 Cue 并让新值顺延下游，直到遇到锁定标记才停；
 *              下游未确认前保持旧快照（作废），预览不跟着变。
 */
export function saveEdit(
  cues: Cue[],
  fixtures: Fixture[],
  cueId: string,
  fixtureId: string,
  value: number,
  mode: SaveMode
): { cues: Cue[]; blockedAt: string | null } {
  const idx = cues.findIndex((c) => c.id === cueId);
  if (idx < 0) return { cues, blockedAt: null };

  const next = cues.map((c) => ({
    ...c,
    values: { ...c.values },
    locks: { ...c.locks },
    confirmed: { ...c.confirmed },
  }));
  const oldEffective = effectiveAt(next, idx, fixtureId);
  let blockedAt: string | null = null;

  // 当前 Cue 写入显式锁定值
  next[idx].locks[fixtureId] = true;
  next[idx].values[fixtureId] = value;

  if (mode === "only" && idx + 1 < next.length && !next[idx + 1].locks[fixtureId]) {
    // 在下一条 Cue 用旧值插入阻挡，顺延到此停止
    next[idx + 1].locks[fixtureId] = true;
    next[idx + 1].values[fixtureId] = oldEffective;
    blockedAt = next[idx + 1].id;
  }

  // 当前 Cue 已确认（保存即确认）
  next[idx].confirmed = recomputeCue(next, idx, fixtures);
  if (blockedAt) {
    const bi = next.findIndex((c) => c.id === blockedAt);
    next[bi].confirmed = recomputeCue(next, bi, fixtures);
  }
  // propagate 模式下下游 confirmed 保持旧值 → 作废，等手动确认重算
  return { cues: next, blockedAt };
}

/** 确认重算：把某条 Cue 的已确认快照更新为当前重算结果 */
export function confirmRecompute(cues: Cue[], fixtures: Fixture[], cueId: string): Cue[] {
  const idx = cues.findIndex((c) => c.id === cueId);
  if (idx < 0) return cues;
  const next = cues.map((c) => ({ ...c, confirmed: { ...c.confirmed } }));
  next[idx].confirmed = recomputeCue(next, idx, fixtures);
  return next;
}

/**
 * 升级旧数据：旧数据没有锁定标记，
 * 按当时的显式值逐条回填锁定标记。
 */
export function migrateCues(oldCues: OldCue[], fixtures: Fixture[]): Cue[] {
  const cues: Cue[] = oldCues.map((oc) => {
    const values: Record<string, number> = {};
    const locks: Record<string, boolean> = {};
    for (const [fid, lvl] of Object.entries(oc.levels)) {
      values[fid] = lvl;
      locks[fid] = true; // 按显式值回填锁定标记
    }
    return { id: oc.id, no: oc.no, label: oc.label, note: oc.note, values, locks, confirmed: {} };
  });
  for (let i = 0; i < cues.length; i++) {
    cues[i].confirmed = recomputeCue(cues, i, fixtures);
  }
  return cues;
}

/** 加入一个控制台版本，返回更新后的版本列表与冲突（若有先到版本） */
export function addVersion(
  versions: Version[],
  v: Omit<Version, "status">
): { versions: Version[]; conflict: Version | null } {
  const group = versions.filter((x) => x.cueId === v.cueId && x.fixtureId === v.fixtureId);
  const earliest = group.length ? group.reduce((a, b) => (a.time <= b.time ? a : b)) : null;
  // 时间相等时，后加入的 v 视为晚到
  const isLate = !!earliest && v.time >= earliest.time;

  const withNew = [...versions, { ...v, status: isLate ? ("late" as const) : ("effective" as const) }];
  // 同组内最早时间者生效，其余标记晚到
  const normalized = withNew.map((x) => {
    const g = withNew.filter((y) => y.cueId === x.cueId && y.fixtureId === x.fixtureId);
    const e = g.reduce((a, b) => (a.time <= b.time ? a : b));
    return { ...x, status: (x.id === e.id ? "effective" : "late") as Version["status"] };
  });
  return { versions: normalized, conflict: isLate ? earliest : null };
}

/** 晚到版本与先到生效版本的差异描述 */
export function diffVersions(late: Version, effective: Version, fixtureCode: string): string[] {
  const fmt = (t: number) => new Date(t).toLocaleTimeString("zh-CN", { hour12: false });
  const out: string[] = [];
  out.push(`灯具 ${fixtureCode}：先到 ${effective.value}%（${fmt(effective.time)}），晚到 ${late.value}%（${fmt(late.time)}）`);
  if (late.value !== effective.value) {
    out.push(`亮度差 ${Math.abs(late.value - effective.value)}%，以先到版本为准`);
  } else {
    out.push(`亮度一致，仅控制台不同`);
  }
  return out;
}
