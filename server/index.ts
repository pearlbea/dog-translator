import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { fallbackLine, translate, type EventMeta } from "./translate";

const COOLDOWN_MS = 3000;
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const app = express();
app.use(express.json({ limit: "10kb" }));

// Cooldown is per client so one browser tab can't starve another.
const lastCallByClient = new Map<string, number>();

function inRange(x: unknown, min: number, max: number): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
}

function isEventMeta(x: any): x is EventMeta {
  return (
    x &&
    inRange(x.peakScore, 0, 1) &&
    typeof x.dominantClass === "string" &&
    x.dominantClass.length <= 40 &&
    inRange(x.durationMs, 0, 60_000) &&
    inRange(x.rms, 0, 1)
  );
}

function parseVoice(x: unknown): string | undefined {
  return typeof x === "string" ? x.trim().slice(0, 80) || undefined : undefined;
}

/** Recent lines go into the prompt, so flatten whitespace to stop them adding fake prompt lines. */
function parseRecent(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((r): r is string => typeof r === "string")
    .slice(-8)
    .map((r) => r.replace(/\s+/g, " ").trim().slice(0, 200))
    .filter(Boolean);
}

app.post("/api/translate", async (req, res) => {
  const { event, recent, voice } = req.body ?? {};
  if (!isEventMeta(event)) return res.status(400).json({ error: "bad event" });

  const who = req.ip ?? "unknown";
  const now = Date.now();
  if (now - (lastCallByClient.get(who) ?? 0) < COOLDOWN_MS) return res.status(429).json({ error: "cooldown" });
  lastCallByClient.set(who, now);
  if (lastCallByClient.size > 1000) {
    for (const [k, t] of lastCallByClient) if (now - t > COOLDOWN_MS) lastCallByClient.delete(k);
  }

  try {
    res.json({ text: await translate(client, event, parseRecent(recent), parseVoice(voice)), fallback: false });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`Claude API ${err.status}:`, err.message);
    else console.error(err);
    res.json({ text: fallbackLine(), fallback: true });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
