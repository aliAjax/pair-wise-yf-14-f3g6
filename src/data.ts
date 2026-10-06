import type { Fixture, OldCue } from "./types";

export const FIXTURES: Fixture[] = [
  { id: "f1", code: "FX-01", channel: "CH 021", color: "#ffd9a0", focus: "舞台左前", type: "面光", x: 16, y: 80 },
  { id: "f2", code: "FX-02", channel: "CH 022", color: "#ffd9a0", focus: "舞台右前", type: "面光", x: 84, y: 80 },
  { id: "f3", code: "FX-03", channel: "CH 023", color: "#a0c4ff", focus: "门口", type: "侧光", x: 8, y: 46 },
  { id: "f4", code: "FX-04", channel: "CH 024", color: "#a0c4ff", focus: "窗口", type: "侧光", x: 92, y: 46 },
  { id: "f5", code: "FX-05", channel: "CH 025", color: "#c4a0ff", focus: "舞台中后", type: "逆光", x: 50, y: 16 },
  { id: "f6", code: "FX-06", channel: "CH 026", color: "#ffe9a0", focus: "台面", type: "面光", x: 50, y: 62 },
  { id: "f7", code: "FX-07", channel: "CH 027", color: "#ff9ec4", focus: "追光位", type: "效果光", x: 30, y: 30 },
  { id: "f8", code: "FX-08", channel: "CH 028", color: "#9effd0", focus: "天幕", type: "逆光", x: 70, y: 14 },
];

/** 旧数据：只有显式 levels，没有锁定标记 */
export const OLD_CUES: OldCue[] = [
  {
    id: "c1",
    no: "Cue 12",
    label: "冷蓝侧光",
    note: "二幕开场",
    levels: { f1: 65, f2: 65, f3: 80, f4: 80, f5: 40 },
  },
  {
    id: "c2",
    no: "Cue 18",
    label: "追光入场",
    note: "需演员走位确认",
    levels: { f7: 100, f3: 60 },
  },
  {
    id: "c3",
    no: "Cue 24",
    label: "暖色谢幕",
    note: "版本B",
    levels: { f1: 80, f2: 80, f6: 100, f7: 50 },
  },
  {
    id: "c4",
    no: "Cue 30",
    label: "暗场转场",
    note: "",
    levels: { f5: 20 },
  },
];

export const TYPE_FILTERS = ["全部", "面光", "侧光", "逆光", "效果光"] as const;
