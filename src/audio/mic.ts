import { Resampler } from "./resample";
import { Ring } from "./ring";

export const TARGET_RATE = 16000;
export const WINDOW_SAMPLES = 15600; // YAMNet frame: 0.975 s
export const HOP_SAMPLES = 8000; // 0.5 s

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0][0];
    if (ch) this.port.postMessage(ch.slice());
    return true;
  }
}
registerProcessor("tap", Tap);
`;

export interface MicHandle {
  stop(): void;
}

/** Streams 16 kHz mono windows to onWindow, plus a per-chunk level for the meter. */
export async function startMic(
  onWindow: (samples: Float32Array, tMs: number) => void,
  onLevel: (rms: number) => void,
): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  try {
    // Created after an async model load, so the browser may have left it suspended.
    if (ctx.state === "suspended") await ctx.resume();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "tap");
    const mute = ctx.createGain();
    mute.gain.value = 0; // keep the graph pulling without playing the mic back
    source.connect(node).connect(mute).connect(ctx.destination);

    const resampler = new Resampler(ctx.sampleRate / TARGET_RATE);
    const ring = new Ring(WINDOW_SAMPLES);
    let produced = 0; // total 16 kHz samples seen
    let sinceHop = 0;

    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const chunk = e.data;
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) sum += chunk[i]! * chunk[i]!;
      onLevel(Math.sqrt(sum / chunk.length));

      for (const v of resampler.process(chunk)) {
        ring.push(v);
        produced++;
        sinceHop++;
      }

      if (ring.full && sinceHop >= HOP_SAMPLES) {
        sinceHop = 0;
        onWindow(ring.snapshot(), ((produced - WINDOW_SAMPLES) / TARGET_RATE) * 1000);
      }
    };

    return {
      stop() {
        node.port.onmessage = null;
        release();
      },
    };
  } catch (err) {
    release(); // don't leave the mic indicator on if setup fails midway
    throw err;
  }
}
