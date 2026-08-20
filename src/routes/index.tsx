import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Footprints, Hand, LineChart, Repeat2, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/hero-dancer.jpg";
import { Button } from "@/components/ui/button";
import { PoseStudio } from "@/components/natya/PoseStudio";
import { ADAVUS } from "@/lib/natya/adavus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Natya AI — Bharatanatyam Performance Analysis" },
      {
        name: "description",
        content:
          "AI Bharatanatyam coach: MediaPipe full-body pose tracking that evaluates mudras, adavus, padabhedas, posture, footwork and tala sync with real-time feedback and scored reports.",
      },
      { property: "og:title", content: "Natya AI — Bharatanatyam Performance Analysis" },
      {
        property: "og:description",
        content:
          "Real-time pose and hand tracking that scores araimandi, mudras, padabhedas, footwork and synchronisation, then reports every deduction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Activity, title: "Full-body pose tracking", body: "33 skeletal landmarks per frame measure araimandi depth, spine alignment and shoulder level." },
  { icon: Hand, title: "Mudra recognition", body: "21 points per hand classify asamyuta hastas such as Pataka, Tripataka, Alapadma and Mushti." },
  { icon: Footprints, title: "Padabheda & footwork", body: "Stance width, turnout and thattu strikes are measured against each adavu's prescribed geometry." },
  { icon: Repeat2, title: "Tala synchronisation", body: "Strike intervals are compared with the target tempo to detect rushing, lagging and uneven rhythm." },
  { icon: ShieldCheck, title: "Unbiased scoring", body: "Fixed, weighted parameters produce the same score for every dancer — no guru bias, no favouritism." },
  { icon: LineChart, title: "Reports & recordings", body: "Every session is recorded, mistakes are time-stamped, and deductions are itemised with a practice plan." },
];

function Home() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-primary">Natya AI</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl">
              An <span className="text-gradient-gold">unbiased AI guru</span> for Bharatanatyam
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Dance in front of your camera. MediaPipe tracks your entire body and both hands while the analysis
              engine evaluates mudras, adavus, padabhedas, posture, footwork and synchronisation — correcting you as
              you move and scoring you when you finish.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#studio">Start live analysis</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/reports">View past reports</Link>
              </Button>
            </div>
          </div>
          <div className="panel glow overflow-hidden">
            <img
              src={heroImg}
              width={1536}
              height={1024}
              alt="Bharatanatyam dancer in araimandi with AI pose-tracking skeleton overlay"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="panel p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-xl">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <PoseStudio />

      <section className="mx-auto w-full max-w-7xl px-5 pb-20">
        <h2 className="text-2xl font-semibold sm:text-3xl">Adavu library & evaluation parameters</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each adavu carries its own reference geometry. Scores are computed against these fixed targets, so two
          dancers performing the same adavu are judged identically.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-3">Adavu</th>
                <th className="pb-3">Family</th>
                <th className="pb-3">Araimandi knee</th>
                <th className="pb-3">Stance</th>
                <th className="pb-3">Tempo</th>
                <th className="pb-3">Padabheda</th>
              </tr>
            </thead>
            <tbody>
              {ADAVUS.map((a) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="py-3 text-foreground">{a.name}</td>
                  <td className="py-3 text-muted-foreground">{a.family}</td>
                  <td className="py-3 text-muted-foreground">{a.kneeAngle}°</td>
                  <td className="py-3 text-muted-foreground">{a.stance}× shoulders</td>
                  <td className="py-3 text-muted-foreground">{a.tempo} bpm</td>
                  <td className="py-3 text-muted-foreground">{a.padabheda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Natya AI · all video processing happens locally in your browser.
      </footer>
    </main>
  );
}
