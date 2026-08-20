import type { MetricKey } from "./types";

export type Adavu = {
  id: string;
  name: string;
  family: string;
  description: string;
  /** target beats per minute of footwork (thattu) */
  tempo: number;
  /** ideal knee angle in araimandi (degrees) */
  kneeAngle: number;
  /** ideal ankle separation as a fraction of shoulder width */
  stance: number;
  /** ideal elbow/arm elevation relative to shoulder line (degrees) */
  armElevation: number;
  padabheda: string;
  focus: MetricKey[];
};

export const ADAVUS: Adavu[] = [
  {
    id: "tatta",
    name: "Tatta Adavu",
    family: "Foundation",
    description: "Striking the floor in araimandi with alternating feet, hands on waist (katihastam).",
    tempo: 96,
    kneeAngle: 128,
    stance: 1.5,
    armElevation: -60,
    padabheda: "Samapadam / Anchita",
    focus: ["araimandi", "footwork", "posture", "sync"],
  },
  {
    id: "natta",
    name: "Natta Adavu",
    family: "Foundation",
    description: "Stretching the leg sideways with arms extended in natyarambhe.",
    tempo: 84,
    kneeAngle: 132,
    stance: 2.1,
    armElevation: 0,
    padabheda: "Anchita / Kunchita",
    focus: ["araimandi", "hasta", "padabheda", "symmetry"],
  },
  {
    id: "mettu",
    name: "Mettu Adavu",
    family: "Foundation",
    description: "Raising and dropping the heels while holding a steady araimandi.",
    tempo: 108,
    kneeAngle: 126,
    stance: 1.4,
    armElevation: -60,
    padabheda: "Agratala sanchara",
    focus: ["araimandi", "footwork", "sync"],
  },
  {
    id: "nattadavu-korvai",
    name: "Kuditta Mettu",
    family: "Intermediate",
    description: "Jumping on the spot in araimandi, with alapadma hands opening outward.",
    tempo: 100,
    kneeAngle: 122,
    stance: 1.6,
    armElevation: 10,
    padabheda: "Samapadam",
    focus: ["araimandi", "footwork", "hasta", "posture"],
  },
  {
    id: "tirmana",
    name: "Tirmana Adavu",
    family: "Advanced",
    description: "Concluding sequence with wide stances and arms raised above the shoulder line.",
    tempo: 120,
    kneeAngle: 120,
    stance: 2.4,
    armElevation: 35,
    padabheda: "Anchita / Swastikam",
    focus: ["padabheda", "hasta", "symmetry", "sync"],
  },
];

export const getAdavu = (id: string) => ADAVUS.find((a) => a.id === id) ?? ADAVUS[0]!;
