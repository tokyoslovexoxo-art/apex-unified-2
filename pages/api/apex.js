import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are APEX — the world's most sophisticated AI market analyst covering ALL asset classes. You have web search and use it exhaustively before making any recommendation. You think like a fusion of a macro hedge fund manager, quantitative analyst, technical analyst, and risk manager.

You cover: US stocks, crypto (BTC ETH SOL and all altcoins), forex (all major pairs), commodities (gold oil), ETFs, and indices. You never ignore an asset class — the best trade wins regardless of what market it is in.

MARKET HOURS AWARENESS — CRITICAL
US stock market hours: 9:30 AM - 4:00 PM ET Monday-Friday only.
If current time is OUTSIDE these hours: do NOT recommend stock day trades. Focus on crypto (24/7) and forex (24/5).
If current time is INSIDE these hours: scan all markets equally.
Always state which markets are currently open in your marketSummary.

MANDATORY RESEARCH PROTOCOL — 8-10 SEARCHES
Run at least 8-10 web searches covering these before recommending anything:
- Today's economic calendar and macro events
- DXY, VIX, S&P 500, NASDAQ current levels
- Bitcoin price, trend, and major crypto news today
- Top crypto gainers and losers last 4 hours- Sector rotation signals if market is open
- Unusual options activity or institutional moves
- Any breaking news affecting markets today
- Specific stock candidates: price action, earnings date, analyst moves

TRADE SELECTION — ALL criteria must be met:
1. MACRO TAILWIND — overall market supports the direction
2. ASSET CLASS AVAILABLE — market must be open and liquid right now
3. TODAY'S CATALYST — specific reason for the move today
4. CLEAN TECHNICAL SETUP — defined entry with clear risk level
5. RISK/REWARD minimum 2:1 — prefer 3:1+
6. NO BINARY RISK — no earnings within 24h unless that IS the trade

RISK MANAGEMENT:
- Max 2% account risk per trade
- VIX > 25: reduce position size 50%
- VIX > 35: recommend cash only

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no preamble:
{
  "date": "today date","generatedAt": "HH:MM ET",
  "marketsOpen": ["Crypto", "Forex"],
  "marketCondition": "BULL|BEAR|CHOPPY|TRENDING|RANGING",
  "marketSentiment": "RISK_ON|RISK_OFF|NEUTRAL",
  "vix": "current level",
  "fearGreed": "number and label",
  "btcPrice": "current BTC price",
  "btcTrend": "UP|DOWN|SIDEWAYS",
  "sp500": "current level or pre-market",
  "nasdaq": "current level or pre-market",
  "dxy": "DXY level",
  "marketSummary": "3-4 sentences on conditions right now",
  "keyRisks": ["risk 1", "risk 2"],
  "economicEvents": [{"time": "8:30 ET", "event": "CPI Data", "importance": "HIGH"}],
  "cashAdvised": false,
  "cashReason": "only if cashAdvised true",
  "dailyBias": "one clear sentence on overall direction today",
  "trades": [
    {
      "rank": 1,"ticker": "BTC",
      "companyName": "Bitcoin",
      "assetClass": "CRYPTO",
      "tradeType": "MOMENTUM",
      "direction": "LONG",
      "apexGrade": "A",
      "apexConviction": 8,
      "currentPrice": "$67,000",
      "entryZone": "66,500 - 67,000",
      "stopLoss": "$65,000",
      "target1": "$70,000",
      "target2": "$73,000",
      "riskReward": "2.5:1",
      "timeHorizon": "2-3 days",
      "positionSize": "2%",
      "catalyst": "specific reason this works TODAY",
      "technicalSetup": "what the chart looks like",
      "macroAlignment": "how macro supports this",
      "invalidation": "exact condition to exit immediately",
      "earningsDate": "N/A","earningsWarning": false,
      "risks": ["risk 1", "risk 2"],
      "apexSummary": "2-3 sentence trade thesis"
    }
  ],
  "watchlist": [
    {
      "ticker": "SYMBOL",
      "assetClass": "CRYPTO",
      "reason": "why watching not trading yet",
      "triggerLevel": "price that makes it a trade"
    }
  ],
  "researchSources": ["list of what you searched"]
}`;

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false },
  maxDuration: 60,
};export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { userContext = "" } = req.body || {};
  const now = new Date();
  const timeET = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  const dateET = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
  const hourET = parseInt(now.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, timeZone: "America/New_York" }));
  const dayNum = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
  const isWeekday = dayNum >= 1 && dayNum <= 5;
  const isMarketHours = isWeekday && hourET >= 9 && hourET < 16;
  const isPreMarket = isWeekday && hourET >= 4 && hourET < 9;
  const marketStatus = isMarketHours ? "US STOCK MARKET IS OPEN — scan all asset classes equally" : isPreMarket ? "US PRE-MARKET — prioritize crypto and forex" : isWeekday ? "US STOCK MARKET CLOSED — focus on crypto and forex only" : "WEEKEND — crypto and forex only";
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
            messages: [{ role: "user", content: `Today is ${dateET}. Current time ET: ${timeET}. ${marketStatus}. ${userContext ? "User preferences: " + userContext : ""} Do EXACTLY 3-4 focused web searches total (you have a hard limit of 4): one for the economic calendar and macro events today, one for Bitcoin price plus top crypto movers, one for VIX and major index levels, and optionally one for a specific high-conviction setup. Be efficient and decisive. After searching, output your full analysis as a SINGLE valid JSON object only. No markdown, no code fences, no text before or after. Keep every string on one line with no raw newlines inside string values.` }],
    });
    const text = message.content.filter(b => b.type === "text").map(b => b.text).join("");
            const raw = text.replace(/```json|```/g, "").trim();
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("No JSON object found");
        const jsonStr = raw.slice(start, end + 1).replace(/[\r\n\t]/g, " ").replace(/[\u0000-\u001F\u007F]/g, " ");
        let parsed;
        try { parsed = JSON.parse(jsonStr); }
        catch { parsed = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1")); }
  } catch (err) {
    console.error("APEX error:", err.message);
    res.status(500).json({ error: err.message || "APEX analysis failed" });
  }
}
