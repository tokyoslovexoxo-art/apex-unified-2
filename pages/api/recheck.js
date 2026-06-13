import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an elite institutional trading analyst. The user has an EXISTING open paper trade and is uploading a FRESH chart of the same asset to check whether the trade is still valid and what adjustments to make.

You will be given the original trade parameters (direction, entry, stop, target) plus the original reasoning, and a current chart image.

Your job:
1. Judge whether the original setup is STILL VALID based on the current chart and price action.
2. Decide if the entry, stop, or target should be ADJUSTED given what the chart now shows.
3. Flag if the thesis is broken / invalidated, or if it is time to exit.

Be strict and honest. If the setup is broken, say so. If price has moved past a sensible entry, say wait or skip. Base everything on the visible chart: structure, key levels, trend, momentum, and how price sits relative to the original entry/stop/target.

Return ONLY valid JSON (no markdown, no code fences) with EXACTLY these fields:
{
  "stillValid": true or false,
  "verdict": "HOLD" or "ADJUST" or "EXIT" or "WAIT",
  "newEntry": number or null,
  "newStop": number or null,
  "newTarget": number or null,
  "confidence": 1-10,
  "changesSummary": "one or two sentences on what changed and what to do",
  "reasoning": "2-4 sentences citing what the current chart shows"
}

If no change is needed, set verdict to HOLD and return the original entry/stop/target as the new values. Always return numbers for newEntry and newStop when the trade is still live.`;

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" }, responseLimit: false }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, mediaType = "image/jpeg", ticker, direction, entry, stopLoss, target, notes } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const tradeContext = [
    ticker ? ("Ticker: " + ticker) : null,
    direction ? ("Direction: " + direction) : null,
    entry != null ? ("Original entry: " + entry) : null,
    stopLoss != null ? ("Original stop loss: " + stopLoss) : null,
    target != null ? ("Original target: " + target) : null,
    notes ? ("Original reasoning: " + notes) : null
  ].filter(Boolean).join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Here is my existing open trade:\n" + tradeContext + "\n\nHere is the current chart. Is this trade still valid, and what should I adjust? Apply all rules strictly and return only the JSON." }
        ]
      }]
    });

    const text = message.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse recheck JSON");
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error("Recheck error:", err);
    res.status(500).json({ error: err.message || "Recheck failed" });
  }
}
