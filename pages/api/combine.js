// Calculates the unified APEX + Chart combined score and final recommendation
export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { apexTrade, chartAnalysis } = req.body;
  if (!apexTrade || !chartAnalysis) return res.status(400).json({ error: "Missing data" });

  // ── Direction alignment check ──────────────────────────
  const apexDir  = apexTrade.direction;  // LONG | SHORT
  const chartDir = chartAnalysis.bias;   // LONG | SHORT | NO TRADE

  const directionMatch = chartDir !== "NO TRADE" && apexDir === chartDir;

  // ── Score components ───────────────────────────────────
  // APEX conviction (0-10) weighted 35%
  const apexConvScore = (apexTrade.apexConviction || 0) / 10;

  // Chart conviction (0-10) weighted 30%
  const chartConvScore = (chartAnalysis.chartConviction || 0) / 10;

  // Grade scores: A=1.0, B=0.8, C=0.6, D=0.4, F=0.2
  const gradeMap = { A: 1.0, B: 0.8, C: 0.6, D: 0.4, F: 0.2 };
  const apexGradeScore  = gradeMap[apexTrade.apexGrade]   || 0.5;
  const chartGradeScore = gradeMap[chartAnalysis.chartGrade] || 0.5;

  // R:R score — parse "3.1:1" → 3.1, cap at 4 for scoring
  const parseRR = (str) => {
    if (!str) return 1;
    const n = parseFloat(str);
    return isNaN(n) ? 1 : Math.min(n, 4);
  };
  const apexRR  = parseRR(apexTrade.riskReward);
  const chartRR = parseRR(chartAnalysis.riskReward);
  const rrScore = Math.min((apexRR + chartRR) / 2 / 3, 1); // normalise, 3:1 avg = perfect

  // Backtest win rate (0-100) → 0-1
  const btScore = directionMatch ? (chartAnalysis.backtestWinRate || 50) / 100 : 0;

  // Sentiment alignment
  const sentScore = (apexTrade.apexSentimentScore || 5) / 10;

  // ── Weighted combined score (0-100) ───────────────────
  let combined = 0;
  if (directionMatch) {
    combined = (
      apexConvScore  * 0.25 +
      chartConvScore * 0.25 +
      ((apexGradeScore + chartGradeScore) / 2) * 0.20 +
      rrScore        * 0.15 +
      btScore        * 0.10 +
      sentScore      * 0.05
    ) * 100;
  } else {
    // Partial score even if no match — to show breakdown
    combined = (apexConvScore * 0.4 + sentScore * 0.1) * 40; // capped low
  }

  combined = Math.round(combined);

  // ── Final grade ───────────────────────────────────────
  let finalGrade, finalLabel, takeTradeRecommendation;

  if (!directionMatch) {
    finalGrade = "F";
    finalLabel = "CONFLICT";
    takeTradeRecommendation = false;
  } else if (combined >= 82) {
    finalGrade = "A+";
    finalLabel = "ELITE SETUP";
    takeTradeRecommendation = true;
  } else if (combined >= 74) {
    finalGrade = "A";
    finalLabel = "HIGH CONVICTION";
    takeTradeRecommendation = true;
  } else if (combined >= 65) {
    finalGrade = "B+";
    finalLabel = "STRONG SETUP";
    takeTradeRecommendation = true;
  } else if (combined >= 56) {
    finalGrade = "B";
    finalLabel = "GOOD SETUP";
    takeTradeRecommendation = true;
  } else if (combined >= 45) {
    finalGrade = "C";
    finalLabel = "MARGINAL";
    takeTradeRecommendation = false;
  } else {
    finalGrade = "D";
    finalLabel = "SKIP";
    takeTradeRecommendation = false;
  }

  // ── Best entry & stop from chart (more precise) ───────
  const bestEntry  = chartAnalysis.entry    || apexTrade.entryZone;
  const bestStop   = chartAnalysis.stopLoss || apexTrade.stopLoss;
  const bestT1     = chartAnalysis.target1  || apexTrade.target1;
  const bestT2     = chartAnalysis.target2  || apexTrade.target2;
  const bestRR     = chartAnalysis.riskReward || apexTrade.riskReward;

  // ── Reasons ───────────────────────────────────────────
  const confluences = [
    directionMatch && `Both APEX and chart agree: ${apexDir}`,
    apexTrade.catalyst && `Catalyst: ${apexTrade.catalyst}`,
    apexTrade.macroAlignment && `Macro: ${apexTrade.macroAlignment}`,
    chartAnalysis.patternType && `Chart pattern: ${chartAnalysis.patternType}`,
    ...(chartAnalysis.confluences || []).slice(0, 3),
  ].filter(Boolean);

  const warnings = [
    !directionMatch && `⚠ DIRECTION CONFLICT: APEX says ${apexDir}, chart says ${chartDir}`,
    apexTrade.earningsWarning && `⚠ Earnings within 14 days — binary risk`,
    chartAnalysis.redFlags?.length > 0 && `Chart red flags: ${chartAnalysis.redFlags.join(", ")}`,
    apexTrade.risks?.length > 0 && `APEX risks: ${apexTrade.risks[0]}`,
    chartAnalysis.imageQuality === "POOR" && "⚠ Chart image quality poor — lower confidence",
  ].filter(Boolean);

  res.status(200).json({
    combinedScore: combined,
    finalGrade,
    finalLabel,
    takeTradeRecommendation,
    directionMatch,
    apexDir,
    chartDir,
    bestEntry,
    bestStop,
    bestT1,
    bestT2,
    bestRR,
    breakdown: {
      apexConviction:      Math.round(apexConvScore  * 100),
      chartConviction:     Math.round(chartConvScore * 100),
      gradeAlignment:      Math.round(((apexGradeScore + chartGradeScore) / 2) * 100),
      riskRewardScore:     Math.round(rrScore * 100),
      backtestScore:       Math.round(btScore * 100),
      sentimentScore:      Math.round(sentScore * 100),
    },
    confluences,
    warnings,
  });
}
