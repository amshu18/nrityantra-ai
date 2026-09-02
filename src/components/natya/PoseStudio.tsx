import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CircleStop, Download, Loader2, Play, Square, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ADAVUS, getAdavu } from "@/lib/natya/adavus";
import {
  analyzeFrame,
  detectMode,
  FootworkTracker,
  gradeFor,
  L,
  SUGGESTION_BANK,
  upperBodyVisible,
  type CameraMode,
} from "@/lib/natya/analysis";
import { classifyMudra, MUDRA_NOTES } from "@/lib/natya/mudra";

import { saveCloudSession } from "@/lib/natya/cloud";
import { saveSession } from "@/lib/natya/session";
import type { FrameAnalysis, Metric, MetricKey, Mistake, Pt, SessionReport } from "@/lib/natya/types";

import { MetricBar, ScoreRing } from "./ScoreRing";
import { SessionReportView } from "./SessionReportView";



const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
  [0, 11], [0, 12],
];

type Status = "idle" | "loading" | "ready" | "running" | "error";

export function PoseStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any>(null);
  const handRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const footRef = useRef(new FootworkTracker());
  const startRef = useRef(0);
  const scoresRef = useRef<Record<MetricKey, number[]>>({} as any);
  const mistakesRef = useRef<Mistake[]>([]);
  const timelineRef = useRef<{ t: number; score: number }[]>([]);
  const lastIssueRef = useRef<Record<string, number>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const modeRef = useRef<CameraMode>("full");
  const modeVotesRef = useRef(0);
  const mudraSeenRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [adavuId, setAdavuId] = useState(ADAVUS[0]!.id);
  const adavuRef = useRef(getAdavu(adavuId));
  const [analysis, setAnalysis] = useState<FrameAnalysis | null>(null);
  const [mode, setMode] = useState<CameraMode>("full");
  const [feed, setFeed] = useState<Mistake[]>([]);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);



  useEffect(() => {
    adavuRef.current = getAdavu(adavuId);
  }, [adavuId]);

  const adavu = getAdavu(adavuId);

  const draw = useCallback((pose: any, hands: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const lm = pose?.landmarks?.[0];
    if (lm) {
      ctx.strokeStyle = "rgba(245, 190, 90, 0.9)";
      ctx.lineWidth = 3;
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a]!.x * canvas.width, lm[a]!.y * canvas.height);
        ctx.lineTo(lm[b]!.x * canvas.width, lm[b]!.y * canvas.height);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255, 236, 200, 0.95)";
      lm.forEach((p: Pt) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    for (const hand of hands?.landmarks ?? []) {
      ctx.fillStyle = "rgba(120, 220, 170, 0.95)";
      for (const p of hand) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }, []);



  const loop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !poseRef.current) return;
    const now = performance.now();
    let pose: any = null;
    let hands: any = null;
    try {
      pose = poseRef.current.detectForVideo(video, now);
      hands = handRef.current?.detectForVideo(video, now);
    } catch {
      /* frame skipped */
    }
    draw(pose, hands);

    const lm = pose?.landmarks?.[0];
    if (lm && upperBodyVisible(lm)) {
      const t = now - startRef.current;
      const cfg = adavuRef.current;

      // --- adaptive framing: switch to upper-body scoring when legs leave the frame
      const detected = detectMode(lm);
      if (detected === modeRef.current) {
        modeVotesRef.current = 0;
      } else if (++modeVotesRef.current > 12) {
        modeVotesRef.current = 0;
        modeRef.current = detected;
        setMode(detected);
        if (detected === "upper") footRef.current.reset();
      }
      const mode = modeRef.current;

      if (mode === "full") footRef.current.push(Math.min(lm[L.lAnkle]!.y, lm[L.rAnkle]!.y), now, cfg.tempo);

      const handed: string[] = (hands?.handedness ?? []).map((h: any) => h[0]?.categoryName ?? "");
      const mudras = { left: "—", right: "—" };
      (hands?.landmarks ?? []).forEach((h: any, i: number) => {
        const name = classifyMudra(h);
        if (handed[i] === "Left") mudras.right = name;
        else mudras.left = name;
      });
      for (const m of [mudras.left, mudras.right]) if (m && m !== "—") mudraSeenRef.current.add(m);
      const res = analyzeFrame(
        lm,
        cfg,
        mudras,
        {
          tempo: mode === "full" ? footRef.current.tempo() : null,
          steadiness: mode === "full" ? footRef.current.steadiness() : null,
        },
        mode,
      );

      setAnalysis(res);
      scoresRef.current = scoresRef.current || ({} as any);
      for (const m of res.metrics) {
        (scoresRef.current[m.key] ||= []).push(m.score);
      }
      if (timelineRef.current.length === 0 || t - timelineRef.current[timelineRef.current.length - 1]!.t > 500)
        timelineRef.current.push({ t: Math.round(t), score: res.overall });

      for (const issue of res.issues) {
        const key = issue.metric + issue.severity;
        if (now - (lastIssueRef.current[key] ?? -9999) < 3500) continue;
        lastIssueRef.current[key] = now;
        const mistake: Mistake = {
          id: `${key}-${Math.round(t)}`,
          t: Math.round(t),
          metric: issue.metric,
          message: issue.message,
          severity: issue.severity,
          deduction: issue.severity === "major" ? 3 : 1,
        };
        mistakesRef.current.push(mistake);
        setFeed((f) => [mistake, ...f].slice(0, 12));
      }
      setElapsed(t);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const start = useCallback(async () => {
    setError(null);
    setReport(null);
    setStatus("loading");
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      poseRef.current = await vision.PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      handRef.current = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      footRef.current.reset();
      scoresRef.current = {} as any;
      mistakesRef.current = [];
      timelineRef.current = [];
      lastIssueRef.current = {};
      setFeed([]);

      startRef.current = performance.now();

      try {
        const canvasStream = canvasRef.current!.captureStream(24);
        chunksRef.current = [];
        const rec = new MediaRecorder(canvasStream, { mimeType: "video/webm" });
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.onstop = () => setVideoUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: "video/webm" })));
        rec.start();
        recorderRef.current = rec;
      } catch {
        recorderRef.current = null;
      }

      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Could not start the camera or load the pose models.");
      setStatus("error");
    }
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    const video = videoRef.current;
    (video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;

    const labels: Record<string, string> = {
      araimandi: "Araimandi",
      posture: "Body posture",
      symmetry: "Symmetry",
      hasta: "Mudra & hastas",
      padabheda: "Padabheda",
      footwork: "Footwork",
      sync: "Tala sync",
    };
    const averages = (Object.keys(scoresRef.current) as MetricKey[]).map((key) => {
      const arr = scoresRef.current[key];
      return { key, label: labels[key]!, score: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) };
    });
    if (averages.length) {
      const overall = Math.round(averages.reduce((a, m) => a + m.score, 0) / averages.length);
      const byMetric = new Map<MetricKey, { count: number; points: number }>();
      for (const m of mistakesRef.current) {
        const cur = byMetric.get(m.metric) ?? { count: 0, points: 0 };
        byMetric.set(m.metric, { count: cur.count + 1, points: cur.points + m.deduction });
      }
      const weakest = [...averages].sort((a, b) => a.score - b.score).slice(0, 3);
      const rep: SessionReport = {
        id: `s-${Date.now()}`,
        adavu: adavuRef.current.name,
        startedAt: Date.now(),
        durationMs: Math.round(performance.now() - startRef.current),
        overall,
        grade: gradeFor(overall),
        averages,
        deductions: [...byMetric.entries()].map(([metric, v]) => ({
          metric,
          label: labels[metric]!,
          count: v.count,
          points: v.points,
        })).sort((a, b) => b.points - a.points),
        mistakes: mistakesRef.current.slice(0, 200),
        timeline: timelineRef.current,
        suggestions: weakest.map((w) => `${w.label} (${w.score}): ${SUGGESTION_BANK[w.key]}`),
      };
      saveSession(rep);
      setReport(rep);
    }
    setStatus("ready");
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  }, []);

  const running = status === "running";
  const live: Metric[] = analysis?.metrics ?? [];

  return (
    <section id="studio" className="mx-auto w-full max-w-7xl px-5 py-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">Live studio</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Full-body analysis in real time</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          MediaPipe tracks 33 body landmarks and 21 points per hand. Stand 2–3 metres from the camera so your feet
          stay in frame, choose an adavu, and begin.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="panel relative aspect-video overflow-hidden">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="h-full w-full object-cover" />
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 text-center">
                {status === "loading" ? (
                  <>
                    <Loader2 className="size-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading pose & hand models…</p>
                  </>
                ) : (
                  <>
                    <Camera className="size-8 text-primary" />
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {error ?? "Camera preview appears here. Nothing leaves your device — all analysis runs in the browser."}
                    </p>
                  </>
                )}
              </div>
            )}
            {running && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                REC {(elapsed / 1000).toFixed(1)}s
              </div>
            )}
          </div>


          <div className="flex flex-wrap items-center gap-3">
            <select
              value={adavuId}
              onChange={(e) => setAdavuId(e.target.value)}
              disabled={running}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground disabled:opacity-60"
            >
              {ADAVUS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.family}
                </option>
              ))}
            </select>
            {running ? (
              <Button onClick={stop} variant="destructive">
                <Square /> Stop & score
              </Button>
            ) : (
              <Button onClick={start} disabled={status === "loading"}>
                <Play /> Start analysis
              </Button>
            )}
            {videoUrl && !running && (
              <Button asChild variant="outline">
                <a href={videoUrl} download={`bharatanatyam-${adavuId}.webm`}>
                  <Download /> Recording
                </a>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {adavu.description} · target {adavu.tempo} bpm · {adavu.padabheda}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel flex items-center gap-5 p-5">
            <ScoreRing score={analysis?.overall ?? 0} />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Live evaluation</p>
              <p className="font-display text-xl text-foreground">{gradeFor(analysis?.overall ?? 0)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Right: <span className="text-primary">{analysis?.mudra.right ?? "—"}</span> · Left:{" "}
                <span className="text-primary">{analysis?.mudra.left ?? "—"}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {MUDRA_NOTES[analysis?.mudra.right ?? ""] ?? "Hold a clear hasta towards the camera."}
              </p>
            </div>
          </div>

          <div className="panel space-y-4 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Parameters</h3>
            {live.length === 0 && <p className="text-sm text-muted-foreground">Start a session to see live scores.</p>}
            {live.map((m) => (
              <MetricBar key={m.key} label={m.label} score={m.score} detail={m.detail} />
            ))}
          </div>

          <div className="panel space-y-3 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Corrections</h3>
            {feed.length === 0 && <p className="text-sm text-muted-foreground">No corrections yet — keep dancing.</p>}
            <ul className="space-y-2">
              {feed.map((f) => (
                <li key={f.id} className="flex gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-sm">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${f.severity === "major" ? "bg-destructive" : "bg-warning"}`}
                  />
                  <span>
                    <span className="text-foreground">{f.message}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {(f.t / 1000).toFixed(1)}s · −{f.deduction}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {report && (
        <div className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-sm text-primary">
            <CircleStop className="size-4" /> Session report
          </div>
          <SessionReportView report={report} videoUrl={videoUrl} />
        </div>
      )}
    </section>
  );
}
