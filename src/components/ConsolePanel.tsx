import type { Cue, Fixture, Version } from "../types";
import { CONSOLE_LABEL } from "../types";
import { diffVersions } from "../engine";

interface ConsolePanelProps {
  versions: Version[];
  cues: Cue[];
  fixtures: Fixture[];
  onClear: () => void;
}

/** 主控台/备份台版本与冲突核对 */
export default function ConsolePanel({ versions, cues, fixtures, onClear }: ConsolePanelProps) {
  const groups = new Map<string, Version[]>();
  for (const v of versions) {
    const key = `${v.cueId}|${v.fixtureId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  const conflicts = Array.from(groups.values()).filter((g) => g.some((v) => v.status === "late"));

  return (
    <div className="console-panel">
      <div className="heading">
        <div>
          <p>主控台 / 备份台</p>
          <h2>保存版本核对</h2>
        </div>
        {versions.length > 0 && (
          <button type="button" className="mini" onClick={onClear}>
            清空版本
          </button>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-banner">
          ⚠ 有 {conflicts.length} 组灯具存在主控/备份同时保存，已按先到版本生效，晚到版本差异如下。
        </div>
      )}

      {versions.length === 0 && <p className="empty">尚未从主控台或备份台保存任何灯具。</p>}

      <div className="version-list">
        {Array.from(groups.entries())
          .reverse()
          .map(([key, group]) => {
            const [cueId, fid] = key.split("|");
            const cue = cues.find((c) => c.id === cueId);
            const fix = fixtures.find((f) => f.id === fid);
            const effective = group.find((v) => v.status === "effective") ?? group[0];
            const late = group.filter((v) => v.status === "late");
            return (
              <article key={key} className="version-group">
                <div className="version-head">
                  <b>{cue?.no ?? cueId}</b>
                  <span>{fix?.code ?? fid}</span>
                  <span className="muted">{fix?.channel}</span>
                </div>
                <div className="version-rows">
                  {group
                    .slice()
                    .sort((a, b) => a.time - b.time)
                    .map((v) => (
                      <div key={v.id} className={"version-row " + v.status}>
                        <span className="console-tag">{CONSOLE_LABEL[v.console]}</span>
                        <span className="version-value">{v.value}%</span>
                        <span className="version-time">
                          {new Date(v.time).toLocaleTimeString("zh-CN", { hour12: false })}
                        </span>
                        <span className={"badge " + (v.status === "effective" ? "ok" : "late")}>
                          {v.status === "effective" ? "先生效" : "晚到"}
                        </span>
                      </div>
                    ))}
                </div>
                {late.map((v) => (
                  <div key={v.id} className="diff-box">
                    <strong>与先到版本差异：</strong>
                    {diffVersions(v, effective, fix?.code ?? fid).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    <p className="muted">已按先到版本 {effective.value}% 生效，晚到版本不覆盖。</p>
                  </div>
                ))}
              </article>
            );
          })}
      </div>
    </div>
  );
}
