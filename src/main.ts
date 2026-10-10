import { startMic, type MicHandle } from "./audio/mic";
import { DogDetector } from "./audio/detector";
import { EventMerger, type VocalizationEvent } from "./audio/events";
import { VOICES } from "./voices";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const startBtn = $<HTMLButtonElement>("start");
const statusEl = $("status");
const levelEl = $("level");
const indicator = $("indicator");
const sens = $<HTMLInputElement>("sens");
const sensVal = $("sensVal");
const bubble = $("bubble");
const historyEl = $("history");
const COOLDOWN_MS = 3000;
const RECENT_N = 8;

const merger = new EventMerger({ threshold: 0.4, gapWindows: 2, hopMs: 500, windowMs: 975 });
// Shared across voices so short lines don't repeat the same joke in different voices.
const recent: string[] = [];
// Start somewhere random so each session opens with a different voice.
let nextVoice = Math.floor(Math.random() * VOICES.length);
let lastTranslate = 0;
let inFlight = false;
let mic: MicHandle | null = null;
let busy = false; // YAMNet inference in flight; drop windows rather than queue them

sens.addEventListener("input", () => {
  // Slider is sensitivity: higher = more sensitive = lower threshold.
  const threshold = 1 - Number(sens.value);
  merger.opts.threshold = threshold;
  sensVal.textContent = `${Number(sens.value).toFixed(2)} (threshold ${threshold.toFixed(2)})`;
});
sens.dispatchEvent(new Event("input"));

/** Round-robin through the voices, so back-to-back barks sound like different dogs. */
const currentVoice = (): string => VOICES[nextVoice % VOICES.length]!;

function addHistory(text: string) {
  const li = document.createElement("li");
  li.textContent = text;
  historyEl.prepend(li);
}

async function onEvent(e: VocalizationEvent) {
  if (inFlight || Date.now() - lastTranslate < COOLDOWN_MS) return;
  inFlight = true;
  const voice = currentVoice();

  try {
    const r = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: e, recent: recent.slice(-RECENT_N), voice }),
    });
    if (!r.ok) return; // cooldown/validation failure: keep the same voice for the next event
    const { text, fallback } = (await r.json()) as { text: string; fallback: boolean };
    bubble.hidden = false;
    bubble.classList.toggle("fallback", fallback);
    bubble.textContent = text;
    recent.push(text);
    addHistory(text);
    // Only a delivered translation uses up the cooldown and advances the voice.
    nextVoice++;
    lastTranslate = Date.now();
  } catch {
    // Network failure: stay quiet, the next event will retry.
  } finally {
    inFlight = false;
  }
}

startBtn.addEventListener("click", async () => {
  if (mic) {
    mic.stop();
    mic = null;
    merger.reset(); // don't carry a half-open event into the next session
    startBtn.textContent = "Start listening";
    statusEl.textContent = "Idle";
    levelEl.style.width = "0";
    return;
  }
  startBtn.disabled = true;
  try {
    statusEl.textContent = "Loading dog-ear model…";
    const detector = await DogDetector.load();
    mic = await startMic(
      async (samples, t) => {
        if (busy) return;
        busy = true;
        try {
          const w = await detector.score(samples, t);
          const hit = w.score >= merger.opts.threshold;
          indicator.classList.toggle("hit", hit);
          if (hit) {
            indicator.textContent = `Dog detected: ${w.topClass} (${w.score.toFixed(2)})`;
          } else {
            indicator.textContent = `Waiting for a dog… (best dog score ${w.score.toFixed(2)}, loudness ${w.rms.toFixed(3)})`;
          }
          const ev = merger.push(w);
          if (ev) void onEvent(ev);
        } catch (err) {
          console.error("Detection failed", err);
          statusEl.textContent = `Detection error: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
          busy = false;
        }
      },
      (rms) => (levelEl.style.width = `${Math.min(100, rms * 400)}%`),
    );
    statusEl.textContent = "Listening";
    startBtn.textContent = "Stop";
  } catch (err) {
    statusEl.textContent = `Couldn't start: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    startBtn.disabled = false;
  }
});
