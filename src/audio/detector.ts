import * as tf from "@tensorflow/tfjs";
import { parseClassNames } from "./classmap";
import type { WindowResult } from "./events";

const MODEL_URL = "https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1";
const CACHE_URL = "indexeddb://yamnet-tfjs-1";

/** Loads from the browser cache when present, otherwise downloads once and caches. */
async function loadModel(): Promise<tf.GraphModel> {
  try {
    return await tf.loadGraphModel(CACHE_URL);
  } catch {
    // Not cached yet.
  }
  let model: tf.GraphModel;
  try {
    model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
  } catch (err) {
    throw new Error(
      `couldn't download the YAMNet model (check your connection): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    await model.save(CACHE_URL);
  } catch {
    // Caching is best-effort (e.g. private browsing); the model still works.
  }
  return model;
}

let shared: Promise<DogDetector> | null = null;

// Display names as they appear in yamnet_class_map.csv (indices resolved at load time).
// Plain "Whimper" is the human class; the dog one is "Whimper (dog)".
const DOG_CLASSES = ["Dog", "Bark", "Yip", "Howl", "Bow-wow", "Growling", "Whimper (dog)"];

export class DogDetector {
  private constructor(
    private model: tf.GraphModel,
    private dogIdx: { name: string; idx: number }[],
  ) {}

  /** One detector per page: repeated start/stop reuses the loaded model instead of leaking a new one. */
  static load(): Promise<DogDetector> {
    shared ??= DogDetector.create().catch((err) => {
      shared = null; // allow a retry after a failed load
      throw err;
    });
    return shared;
  }

  private static async create(): Promise<DogDetector> {
    const [model, csv] = await Promise.all([
      loadModel(),
      fetch("/yamnet_class_map.csv").then((r) => r.text()),
    ]);
    const names = parseClassNames(csv);
    const dogIdx = DOG_CLASSES.map((name) => {
      const idx = names.indexOf(name);
      if (idx < 0) throw new Error(`YAMNet class not found: ${name}`);
      return { name, idx };
    });
    return new DogDetector(model, dogIdx);
  }

  /** Scores one 15600-sample, 16 kHz window. */
  async score(samples: Float32Array, tMs: number): Promise<WindowResult> {
    // Outputs: [scores [frames, 521], embeddings, spectrogram]; only scores are used.
    const scores = tf.tidy(() => (this.model.predict(tf.tensor1d(samples)) as tf.Tensor[])[0]!);
    const data = await scores.data();
    const frames = scores.shape[0]!;
    scores.dispose();

    let best = 0;
    let topClass = this.dogIdx[0]!.name;
    // Max over frames of the strongest dog class; the "Dog" parent class would
    // dominate if summed, so take max rather than sum.
    for (let f = 0; f < frames; f++) {
      for (const { name, idx } of this.dogIdx) {
        const v = data[f * 521 + idx]!;
        if (v > best) {
          best = v;
          topClass = name;
        }
      }
    }
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
    return {
      score: best,
      topClass,
      rms: Math.sqrt(sum / samples.length),
      t: tMs,
    };
  }
}
