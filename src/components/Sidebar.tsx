import { FixtureType } from "../model";

export interface Metric {
  label: string;
  value: number | string;
  tone?: "warn" | "ok";
}

interface SidebarProps {
  metrics: Metric[];
  filter: FixtureType | "all";
  onFilter: (f: FixtureType | "all") => void;
  schemaVersion: number;
  onLoadLegacy: () => void;
  onReset: () => void;
}

const FILTERS: (FixtureType | "all")[] = ["all", "面光", "侧光", "逆光", "效果光"];

export function Sidebar({
  metrics,
  filter,
  onFilter,
  schemaVersion,
  onLoadLegacy,
  onReset,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <section className="panel">
        <p className="panel-kicker">状态指标</p>
        <div className="metric-list">
          {metrics.map((m) => (
            <div key={m.label} className={"metric " + (m.tone ?? "")}>
              <small>{m.label}</small>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">灯具筛选</p>
        <div className="chips vertical">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? "chip on" : "chip"}
              onClick={() => onFilter(f)}
            >
              {f === "all" ? "全部灯位" : f}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">数据与升级</p>
        <p className="hint">
          当前数据格式：<b>v{schemaVersion}</b>
          {schemaVersion === 1
            ? "（v1 旧数据：无锁定标记）"
            : "（显式值带锁定标记）"}
        </p>
        {schemaVersion === 1 ? (
          <button className="primary wide" onClick={onLoadLegacy}>
            执行升级：按当时显式值回填锁定
          </button>
        ) : (
          <button className="wide" onClick={onLoadLegacy}>
            载入 v1 旧数据演练升级
          </button>
        )}
        <button className="wide ghost" onClick={onReset}>
          重置为排练种子
        </button>
      </section>
    </aside>
  );
}

export interface LogEntry {
  id: string;
  time: number;
  text: string;
  kind: "save" | "conflict" | "confirm" | "migrate" | "system";
}

export function AuditLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="panel audit-panel">
      <div className="heading">
        <div>
          <p>可核对记录</p>
          <h2>排练台审计日志</h2>
        </div>
      </div>
      {entries.length === 0 && <p className="empty-tip">还没有操作记录。</p>}
      <ol className="audit-list">
        {entries.map((e) => (
          <li key={e.id} className={"log " + e.kind}>
            <time>{new Date(e.time).toLocaleTimeString("zh-CN", { hour12: false })}</time>
            <span>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NotesPanel({
  title,
  notes,
  onTitle,
  onNotes,
}: {
  title: string;
  notes: string;
  onTitle: (v: string) => void;
  onNotes: (v: string) => void;
}) {
  return (
    <section className="panel notes-panel">
      <div className="heading">
        <div>
          <p>演出版本备注</p>
          <h2>版本信息</h2>
        </div>
      </div>
      <label className="note-field">
        <span>演出名称</span>
        <input value={title} onChange={(e) => onTitle(e.target.value)} />
      </label>
      <label className="note-field">
        <span>排练 / 版本备注</span>
        <textarea rows={3} value={notes} onChange={(e) => onNotes(e.target.value)} />
      </label>
    </section>
  );
}
