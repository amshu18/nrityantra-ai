import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionReportView } from "@/components/natya/SessionReportView";
import { loadSessions } from "@/lib/natya/session";
import { isGuest } from "@/lib/natya/guest";
import type { SessionReport } from "@/lib/natya/types";

export const Route = createFileRoute("/reports")({
  ssr: false,
  beforeLoad: async () => {
    if (isGuest()) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Practice Reports — Nrityaantra" },
      {
        name: "description",
        content:
          "Review scored Bharatanatyam practice sessions: parameter averages, itemised score deductions, time-stamped mistakes and improvement plans.",
      },
      { property: "og:title", content: "Practice Reports — Nrityaantra" },
      {
        property: "og:description",
        content: "Scored Bharatanatyam sessions with deductions, mistakes and a personalised practice plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const [sessions, setSessions] = useState<SessionReport[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSessions();
    setSessions(s);
    setActive(s[0]?.id ?? null);
  }, []);

  const current = sessions.find((s) => s.id === active);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14">
      <Button asChild variant="ghost" className="mb-6 -ml-3">
        <Link to="/">
          <ArrowLeft /> Back to studio
        </Link>
      </Button>
      <h1 className="text-3xl font-semibold sm:text-4xl">Practice reports</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sessions are stored on this device. Each report lists parameter averages, deductions and next steps.
      </p>

      {sessions.length === 0 ? (
        <p className="panel mt-8 p-6 text-sm text-muted-foreground">
          No sessions yet. Run a live analysis in the studio and stop it to generate your first report.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  s.id === active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.adavu} · {s.overall} · {new Date(s.startedAt).toLocaleDateString()}
              </button>
            ))}
          </div>
          {current && <SessionReportView report={current} />}
        </div>
      )}
    </main>
  );
}
