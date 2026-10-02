import type { SessionReport } from "@/lib/natya/types";
import { MetricBar, ScoreRing } from "./ScoreRing";

export function SessionReportView({ report, videoUrl }: { report: SessionReport; videoUrl?: string | null }) {
  const totalDeduction = report.deductions.reduce((a, d) => a + d.points, 0);
  return (
    <div className="panel space-y-8 p-6">
      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing score={report.overall} size={150} />
        <div>
          <h3 className="font-display text-2xl">{report.adavu}</h3>
          <p className="text-sm text-muted-foreground">
            {new Date(report.startedAt).toLocaleString()} · {(report.durationMs / 1000).toFixed(0)}s ·{" "}
            {report.mistakes.length} flagged moments
          </p>
          <p className="mt-2 text-primary">{report.grade}</p>
          <p className="text-sm text-muted-foreground">Total deductions: −{totalDeduction} points</p>
        </div>
        {videoUrl && (
          <video src={videoUrl} controls className="ml-auto w-full max-w-xs rounded-lg border border-border" />
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Average per parameter</h4>
          {report.averages.map((a) => (
            <MetricBar key={a.key} label={a.label} score={a.score} detail="" />
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Score deductions</h4>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-2">Area</th>
                <th className="pb-2">Errors</th>
                <th className="pb-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {report.deductions.map((d) => (
                <tr key={d.metric} className="border-t border-border/60">
                  <td className="py-2 text-foreground">{d.label}</td>
                  <td className="py-2 text-muted-foreground">{d.count}</td>
                  <td className="py-2 text-right text-destructive">−{d.points}</td>
                </tr>
              ))}
              {report.deductions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-muted-foreground">
                    No deductions recorded — a clean run.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h4 className="pt-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Improvement plan
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {report.suggestions.map((s) => (
              <li key={s} className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Mistake timeline
        </h4>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
          {report.mistakes.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 text-sm">
              <span className="w-14 shrink-0 tabular-nums text-xs text-muted-foreground">
                {(m.t / 1000).toFixed(1)}s
              </span>
              <span
                className={`size-2 shrink-0 rounded-full ${m.severity === "major" ? "bg-destructive" : "bg-warning"}`}
              />
              <span className="text-foreground">{m.message}</span>
              <span className="ml-auto text-xs text-destructive">−{m.deduction}</span>
            </div>
          ))}
          {report.mistakes.length === 0 && <p className="text-sm text-muted-foreground">Nothing flagged.</p>}
        </div>
      </div>
    </div>
  );
}
