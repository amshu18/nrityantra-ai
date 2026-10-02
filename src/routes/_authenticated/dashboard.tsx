import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flame, Hand, LogOut, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchCloudSessions, fetchProfile } from "@/lib/natya/cloud";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Practice dashboard — Nrityaantra" },
      {
        name: "description",
        content: "Your Bharatanatyam practice history: accuracy trends, streaks, total practice minutes and mastered mudras and adavus.",
      },
      { property: "og:title", content: "Practice dashboard — Nrityaantra" },
      { property: "og:description", content: "Accuracy trends, practice streaks and mastered adavus from your Bharatanatyam sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessions = useQuery({ queryKey: ["practice-sessions"], queryFn: fetchCloudSessions });
  const profile = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  const rows = sessions.data ?? [];
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.accuracy, 0) / rows.length) : 0;
  const recent = rows.slice(0, 5);
  const older = rows.slice(5, 15);
  const trend =
    recent.length && older.length
      ? Math.round(
          recent.reduce((a, r) => a + r.accuracy, 0) / recent.length -
            older.reduce((a, r) => a + r.accuracy, 0) / older.length,
        )
      : 0;

  const mastered = new Map<string, { best: number; count: number }>();
  for (const r of rows) {
    const cur = mastered.get(r.adavu) ?? { best: 0, count: 0 };
    mastered.set(r.adavu, { best: Math.max(cur.best, r.accuracy), count: cur.count + 1 });
  }
  const mudraSet = new Map<string, number>();
  for (const r of rows) for (const m of r.mudras ?? []) mudraSet.set(m, (mudraSet.get(m) ?? 0) + 1);

  const spark = [...rows].reverse().slice(-20);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to studio
        </Link>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>

      <header className="mt-6">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">Progress</p>
        <h1 className="mt-2 font-display text-4xl">
          {profile.data?.display_name ? `Namaskaram, ${profile.data.display_name}` : "Your practice dashboard"}
        </h1>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Flame} label="Current streak" value={`${profile.data?.practice_streak ?? 0} days`} sub={`Best ${profile.data?.longest_streak ?? 0} days`} />
        <Stat icon={Timer} label="Total practice" value={`${Math.round(Number(profile.data?.total_minutes ?? 0))} min`} sub={`${rows.length} sessions`} />
        <Stat icon={TrendingUp} label="Average accuracy" value={`${avg}%`} sub={trend >= 0 ? `▲ ${trend} pts recently` : `▼ ${Math.abs(trend)} pts recently`} />
        <Stat icon={Hand} label="Mudras seen" value={`${mudraSet.size}`} sub={[...mudraSet.keys()].slice(0, 3).join(", ") || "—"} />
      </div>

      <section className="panel mt-8 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Accuracy trend</h2>
        {spark.length < 2 ? (
          <p className="mt-3 text-sm text-muted-foreground">Complete a couple of sessions to see your trend.</p>
        ) : (
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {spark.map((s) => (
              <div key={s.id} className="flex-1" title={`${s.adavu} · ${s.accuracy}%`}>
                <div className="rounded-t bg-primary/70" style={{ height: `${Math.max(4, s.accuracy)}%` }} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Practice history</h2>
          {sessions.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
          {!sessions.isLoading && rows.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No sessions yet — run a live analysis in the studio.</p>
          )}
          <ul className="mt-4 space-y-2">
            {rows.slice(0, 25).map((r) => (
              <li key={r.id} className="rounded-lg border border-border/70 bg-secondary/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.adavu}</span>
                  <span className="text-primary">{r.accuracy}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.performed_at).toLocaleString()} · {Math.round(Number(r.duration_seconds))}s ·{" "}
                  {r.camera_mode === "upper" ? "upper-body" : "full-body"} · {r.mistake_count} corrections · {r.grade}
                </p>
                {r.feedback?.[0] && <p className="mt-1 text-xs text-muted-foreground">{r.feedback[0]}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mastered steps</h2>
          {mastered.size === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing tracked yet.</p>}
          <ul className="mt-4 space-y-2">
            {[...mastered.entries()]
              .sort((a, b) => b[1].best - a[1].best)
              .map(([adavu, v]) => (
                <li key={adavu} className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/40 p-3 text-sm">
                  <span>{adavu}</span>
                  <span className={v.best >= 85 ? "text-primary" : "text-muted-foreground"}>
                    {v.best}% · {v.count}×{v.best >= 85 ? " · mastered" : ""}
                  </span>
                </li>
              ))}
          </ul>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Mudras practised</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...mudraSet.entries()].sort((a, b) => b[1] - a[1]).map(([m, c]) => (
              <span key={m} className="rounded-full border border-border/70 px-3 py-1 text-xs">
                {m} · {c}
              </span>
            ))}
            {mudraSet.size === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="panel p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
