export type FixtureType = "面光" | "侧光" | "逆光" | "效果光";

export interface Fixture {
  id: string;
  /** 灯具编号 */
  code: string;
  /** 通道号 */
  channel: string;
  /** 色片 (hex) */
  color: string;
  /** 焦点位置 */
  focus: string;
  type: FixtureType;
  /** 舞台平面坐标 % */
  x: number;
  y: number;
}

export interface Cue {
  id: string;
  no: string;
  label: string;
  note: string;
  /** 显式亮度值 (fid -> level 0-100)，与 locks 配套 */
  values: Record<string, number>;
  /** 锁定标记 (fid -> true)：显式钉住该灯，顺延到此停止 */
  locks: Record<string, boolean>;
  /** 已确认的有效亮度快照（预览只认这个） */
  confirmed: Record<string, number>;
}

/** 旧数据：只有 levels，没有锁定标记 */
export interface OldCue {
  id: string;
  no: string;
  label: string;
  note: string;
  levels: Record<string, number>;
}

export type ConsoleId = "main" | "backup";

export interface Version {
  id: string;
  console: ConsoleId;
  cueId: string;
  fixtureId: string;
  value: number;
  /** 到达时间（epoch ms），用于判定先到/晚到 */
  time: number;
  /** effective = 先到生效；late = 晚到，需列出差异 */
  status: "effective" | "late";
}

export type SaveMode = "only" | "propagate";

export const CONSOLE_LABEL: Record<ConsoleId, string> = {
  main: "主控台",
  backup: "备份台",
};
