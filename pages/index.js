import { useState, useCallback, useRef } from "react";
import Head from "next/head";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg:     "#03070a",
  bg1:    "#060d12",
  bg2:    "#0a1520",
  bg3:    "#0d1e2e",
  border: "rgba(0,255,136,0.1)",
  bord2:  "rgba(255,255,255,0.05)",
  green:  "#00ff88",
  green2: "#00cc6a",
  red:    "#ff3355",
  yellow: "#ffd700",
  orange: "#ff9500",
  blue:   "#4da6ff",
  purple: "#b06aff",
  muted:  "#4a6a7a",
  dim:    "#2a4a3a",
  text:   "#c8d8e8",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const mono  = s  => ({ fontFamily: "'DM Mono', monospace", ...s });
const gradeColor = g => ({ "A+": "#00ffaa", A: C.green, "B+": "#7fff7f", B: "#b0ff88", C: C.yellow, D: C.orange, F: C.red, CONFLICT: C.red }[g] || "#888");
const condColor  = c => ({ BULL: C.green, BEAR: C.red, CHOPPY: C.orange, TRENDING: C.blue, RANGING: C.yellow }[c] || "#888");
const sentColor  = s => ({ RISK_ON: C.green, RISK_OFF: C.red, NEUTRAL: C.yellow }[s] || "#888");
const dirColor   = d => d === "LONG" ? C.green : d === "SHORT" ? C.red : C.yellow;
const outcomeColor = o => ({ WIN_T2: C.green, WIN_T1: "#7fff7f", PARTIAL: C.yellow, LOSS: C.red }[o] || "#888");
const outcomeLabel = o => ({ WIN_T2: "✅ Win T2", WIN_T1: "✅ Win T1", PARTIAL: "〰 Partial", LOSS: "❌ Loss" }[o] || o);

async function compressImage(base64, maxW = 1200) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.88).split(",")[1]);
    };
    img.src = "data:image/png;base64," + base64;
  });
}

// ─── SMALL ATOMS ─────────────────────────────────────────────────────────────
function Pill({ children, color = C.green, small }) {
  return (
    <span style={{
      background: color + "18", border: `1px solid ${color}35`,
      color, borderRadius: 5,
      padding: small ? "2px 7px" : "4px 10px",
      fontSize: small ? 10 : 11,
      ...mono(), display: "inline-block", lineHeight: 1.5, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Card({ children, style = {}, glow, accent }) {
  return (
    <div style={{
      background: C.bg1, borderRadius: 12, padding: 18,
      border: `1px solid ${glow ? C.green + "35" : accent ? accent + "25" : C.bord2}`,
      ...(glow ? { boxShadow: `0 0 30px rgba(0,255,136,0.07)` } : {}),
      ...style,
    }}>{children}</div>
  );
}

function Label({ children, style = {} }) {
  return (
    <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, ...mono(), ...style }}>
      {children}
    </div>
  );
}

function Spinner({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: "2px solid rgba(0,255,136,0.12)",
      borderTop: `2px solid ${C.green}`,
      borderRadius: "50%", animation: "spin .7s linear infinite",
    }} />
  );
}

function ConvBar({ value, color }) {
  const c = color || (value >= 8 ? C.green : value >= 6 ? C.yellow : value >= 4 ? C.orange : C.red);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <Label style={{ marginBottom: 0 }}>Conviction</Label>
        <span style={{ color: c, fontSize: 11, ...mono() }}>{value}/10</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, height: 4 }}>
        <div style={{ width: `${value * 10}%`, height: "100%", background: `linear-gradient(90deg,${c}44,${c})`, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ─── COMBINED SCORE DISPLAY ──────────────────────────────────────────────────
function CombinedScorePanel({ score }) {
  const gc = gradeColor(score.finalGrade);
  const barItems = [
    { label: "APEX Conviction",    val: score.breakdown.apexConviction },
    { label: "Chart Conviction",   val: score.breakdown.chartConviction },
    { label: "Grade Alignment",    val: score.breakdown.gradeAlignment },
    { label: "Risk/Reward",        val: score.breakdown.riskRewardScore },
    { label: "Backtest History",   val: score.breakdown.backtestScore },
    { label: "Sentiment",          val: score.breakdown.sentimentScore },
  ];

  return (
    <Card glow={score.takeTradeRecommendation} style={{ marginBottom: 16 }}>
      {/* Score header */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap" }}>
        {/* Big grade circle */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
          background: gc + "15", border: `3px solid ${gc}60`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: score.takeTradeRecommendation ? `0 0 30px ${gc}30` : "none",
        }}>
          <span style={{ color: gc, fontSize: 22, fontWeight: 900, ...mono(), lineHeight: 1 }}>{score.finalGrade}</span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>Combined Score</span>
            <Pill color={gc}>{score.finalLabel}</Pill>
            <Pill color={score.directionMatch ? C.green : C.red} small>
              {score.directionMatch ? "✓ Directions Agree" : "✗ Direction Conflict"}
            </Pill>
          </div>

          {/* Score meter */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 11, ...mono() }}>Overall Score</span>
              <span style={{ color: gc, fontSize: 14, fontWeight: 900, ...mono() }}>{score.combinedScore}/100</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{
                width: `${score.combinedScore}%`, height: "100%",
                background: `linear-gradient(90deg, ${gc}66, ${gc})`,
                borderRadius: 6, transition: "width 1.2s ease",
              }} />
            </div>
          </div>

          {/* Trade levels */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Entry",  val: score.bestEntry,  color: "#fff" },
              { label: "Stop",   val: score.bestStop,   color: C.red },
              { label: "T1",     val: score.bestT1,     color: "#7fff7f" },
              { label: "T2",     val: score.bestT2,     color: C.green },
              { label: "R:R",    val: score.bestRR,     color: C.green },
            ].map(({ label, val, color }) => val && (
              <div key={label}>
                <div style={{ color: C.muted, fontSize: 9, ...mono(), marginBottom: 2 }}>{label}</div>
                <div style={{ color, fontSize: 12, fontWeight: 700, ...mono() }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Take trade banner */}
        <div style={{
          padding: "10px 16px", borderRadius: 10, textAlign: "center", flexShrink: 0,
          background: score.takeTradeRecommendation ? `${C.green}15` : "rgba(255,51,85,0.1)",
          border: `2px solid ${score.takeTradeRecommendation ? C.green : C.red}40`,
        }}>
          <div style={{ fontSize: 24 }}>{score.takeTradeRecommendation ? "✅" : "⛔"}</div>
          <div style={{ color: score.takeTradeRecommendation ? C.green : C.red, fontSize: 11, fontWeight: 800, marginTop: 4 }}>
            {score.takeTradeRecommendation ? "TAKE TRADE" : "SKIP TRADE"}
          </div>
        </div>
      </div>

      {/* Score breakdown bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {barItems.map(({ label, val }) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: C.muted, fontSize: 10, ...mono() }}>{label}</span>
              <span style={{ color: val >= 70 ? C.green : val >= 50 ? C.yellow : C.red, fontSize: 10, ...mono() }}>{val}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, height: 3 }}>
              <div style={{
                width: `${val}%`, height: "100%", borderRadius: 3,
                background: val >= 70 ? C.green : val >= 50 ? C.yellow : C.red,
                opacity: 0.8,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Confluences */}
      {score.confluences?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Label>✅ Confluences</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {score.confluences.map((c, i) => (
              <div key={i} style={{ color: C.green, fontSize: 12 }}>• {c}</div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {score.warnings?.length > 0 && (
        <div style={{ background: "rgba(255,149,0,0.06)", border: `1px solid ${C.orange}25`, borderRadius: 8, padding: 10 }}>
          <Label>⚠ Warnings</Label>
          {score.warnings.map((w, i) => (
            <div key={i} style={{ color: "#cc8800", fontSize: 12, marginBottom: 2 }}>• {w}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── APEX TRADE PANEL ────────────────────────────────────────────────────────
function ApexTradePanel({ trade }) {
  const [expanded, setExpanded] = useState(false);
  const gc = gradeColor(trade.apexGrade);
  const dc = dirColor(trade.direction);

  return (
    <Card accent={C.blue} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: gc + "15", border: `2px solid ${gc}50`, display: "flex", alignItems: "center", justifyContent: "center", color: gc, fontSize: 14, fontWeight: 900, ...mono(), flexShrink: 0 }}>
          {trade.apexGrade}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 700, ...mono() }}>{trade.ticker}</span>
            <Pill color={dc} small>{trade.direction}</Pill>
            <Pill color={C.blue} small>{trade.tradeType}</Pill>
            {trade.earningsWarning && <Pill color={C.orange} small>⚠ EARNINGS</Pill>}
          </div>
          <p style={{ color: C.muted, fontSize: 11 }}>{trade.companyName} · {trade.timeHorizon}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: C.green, fontSize: 12, ...mono() }}>{trade.riskReward}</div>
          <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, borderLeft: `3px solid ${dc}`, paddingLeft: 10 }}>
        <p style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>{trade.apexSummary}</p>
      </div>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginBottom: 12 }}>
            {[
              { l: "ENTRY",    v: trade.entryZone, c: "#fff" },
              { l: "STOP",     v: trade.stopLoss,  c: C.red },
              { l: "TARGET 1", v: trade.target1,   c: "#7fff7f" },
              { l: "TARGET 2", v: trade.target2,   c: C.green },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: c + "08", border: `1px solid ${c}20`, borderRadius: 7, padding: "8px 10px" }}>
                <Label style={{ marginBottom: 3 }}>{l}</Label>
                <div style={{ color: c, fontSize: 13, fontWeight: 700, ...mono() }}>{v}</div>
              </div>
            ))}
          </div>

          <ConvBar value={trade.apexConviction} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <div><Label>⚡ Catalyst</Label><p style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{trade.catalyst}</p></div>
            <div><Label>🌍 Macro</Label><p style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{trade.macroAlignment}</p></div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {trade.analystConsensus && <Pill color={C.blue} small>Analysts: {trade.analystConsensus}</Pill>}
            {trade.shortInterest && trade.shortInterest !== "N/A" && <Pill color={C.purple} small>Short: {trade.shortInterest}</Pill>}
            {trade.optionsActivity && trade.optionsActivity !== "None found" && <Pill color={C.yellow} small>Options: {trade.optionsActivity}</Pill>}
          </div>

          <div style={{ marginTop: 10, background: "rgba(255,51,85,0.05)", border: `1px solid ${C.red}20`, borderRadius: 7, padding: 10 }}>
            <Label>🚫 Invalidation</Label>
            <p style={{ color: "#cc4455", fontSize: 11 }}>{trade.invalidation}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── CHART ANALYSIS PANEL ────────────────────────────────────────────────────
function ChartPanel({ chart, preview }) {
  const [expanded, setExpanded] = useState(false);

  if (!chart) return null;
  const gc = gradeColor(chart.chartGrade);
  const dc = dirColor(chart.bias);

  return (
    <Card accent={C.green} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        {preview && <img src={preview} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, ...mono() }}>{chart.asset}</span>
            <Pill color="#666" small>{chart.timeframe}</Pill>
            <Pill color={dc} small>{chart.bias}</Pill>
            <div style={{ background: gc + "18", border: `1px solid ${gc}40`, color: gc, borderRadius: 5, padding: "2px 7px", fontSize: 10, ...mono() }}>
              Grade {chart.chartGrade}
            </div>
          </div>
          <p style={{ color: C.muted, fontSize: 11 }}>{chart.patternType} · {chart.trend}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: C.green, fontSize: 12, ...mono() }}>{chart.riskReward}</div>
          <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>BT: {chart.backtestWinRate}%</div>
          <div style={{ color: C.muted, fontSize: 10 }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <p style={{ color: C.text, fontSize: 12, lineHeight: 1.6, borderLeft: `3px solid ${dc}`, paddingLeft: 10 }}>{chart.chartSummary}</p>
      </div>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginBottom: 12 }}>
            {[
              { l: "ENTRY",  v: chart.entry,    c: "#fff" },
              { l: "STOP",   v: chart.stopLoss, c: C.red },
              { l: "T1",     v: chart.target1,  c: "#7fff7f" },
              { l: "T2",     v: chart.target2,  c: C.green },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: c + "08", border: `1px solid ${c}20`, borderRadius: 7, padding: "8px 10px" }}>
                <Label style={{ marginBottom: 3 }}>{l}</Label>
                <div style={{ color: c, fontSize: 13, fontWeight: 700, ...mono() }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div><Label>📊 Technical Setup</Label><p style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{chart.chartSummary}</p></div>
            <Card style={{ padding: 10 }}><ConvBar value={chart.chartConviction} /></Card>
          </div>

          {/* SMC Features */}
          {chart.smcFeatures?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>🎯 SMC Features</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {chart.smcFeatures.map((f, i) => <Pill key={i} color={C.purple} small>{f}</Pill>)}
              </div>
            </div>
          )}

          {/* Confluences */}
          {chart.confluences?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>✅ Confluences</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {chart.confluences.map((c, i) => <Pill key={i} color={C.green} small>{c}</Pill>)}
              </div>
            </div>
          )}

          {/* Backtest results */}
          {chart.backtestSampleSize > 0 && (
            <div style={{ background: "rgba(77,166,255,0.05)", border: `1px solid ${C.blue}25`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Label style={{ marginBottom: 0 }}>🔬 Visual Backtest</Label>
                <Pill color={C.blue} small>{chart.backtestWinRate}% WR · {chart.backtestSampleSize} samples</Pill>
              </div>
              <p style={{ color: "#667788", fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>{chart.backtestSummary}</p>
              {chart.backtestInstances?.map((inst, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, background: outcomeColor(inst.outcome) + "08", borderRadius: 5, padding: "5px 8px" }}>
                  <Pill color={outcomeColor(inst.outcome)} small>{outcomeLabel(inst.outcome)}</Pill>
                  <div>
                    <div style={{ color: "#888", fontSize: 10 }}>{inst.location}</div>
                    {inst.note && <div style={{ color: "#555", fontSize: 10 }}>{inst.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scenarios */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <Card style={{ padding: 10 }}>
              <Label>🟢 Bull</Label>
              <p style={{ color: "#999", fontSize: 11, lineHeight: 1.5 }}>{chart.scenario_bull}</p>
            </Card>
            <Card style={{ padding: 10 }}>
              <Label>🔴 Bear</Label>
              <p style={{ color: "#999", fontSize: 11, lineHeight: 1.5 }}>{chart.scenario_bear}</p>
            </Card>
          </div>

          {/* Red flags */}
          {chart.redFlags?.length > 0 && (
            <div style={{ background: "rgba(255,149,0,0.05)", border: `1px solid ${C.orange}20`, borderRadius: 7, padding: 10 }}>
              <Label>⚠ Red Flags</Label>
              {chart.redFlags.map((f, i) => <div key={i} style={{ color: "#cc8800", fontSize: 11 }}>• {f}</div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── IMAGE UPLOADER ───────────────────────────────────────────────────────────
function ImageUploader({ ticker, onImage, currentPreview }) {
  const fileRef   = useRef();
  const camRef    = useRef();

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    const reader  = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target.result.split(",")[1];
      const b64 = await compressImage(raw);
      onImage({ preview, base64: b64 });
    };
    reader.readAsDataURL(file);
  }, [onImage]);

  if (currentPreview) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <img src={currentPreview} alt="" style={{ width: 80, height: 56, objectFit: "cover", borderRadius: 7, border: `1px solid ${C.border}` }} />
        <div>
          <div style={{ color: C.green, fontSize: 11, marginBottom: 4 }}>✓ Chart uploaded</div>
          <button onClick={() => { fileRef.current?.click(); }} style={{ background: C.bg2, color: C.muted, border: `1px solid ${C.bord2}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
            Change
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
      <input ref={camRef}  type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
      <button onClick={() => fileRef.current?.click()} style={{ background: C.bg2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
        📁 Upload Chart
      </button>
      <button onClick={() => camRef.current?.click()} style={{ background: "rgba(0,255,136,0.08)", color: C.green, border: `1px solid ${C.green}30`, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
        📸 Take Photo
      </button>
      <span style={{ color: C.muted, fontSize: 11 }}>for {ticker}</span>
    </div>
  );
}

// ─── LOADING STEPS ────────────────────────────────────────────────────────────
const APEX_STEPS = [
  "Scanning economic calendar...",
  "Checking Fed & bond yields...",
  "Reading VIX & Fear/Greed...",
  "Analyzing pre-market futures...",
  "Scanning sector rotation...",
  "Hunting unusual options flow...",
  "Checking analyst upgrades...",
  "Scanning institutional filings...",
  "Reading social sentiment...",
  "Finding high-conviction setups...",
  "Calculating risk/reward ratios...",
  "Building recommendations...",
];

function ApexLoadingScreen() {
  const [step, setStep] = useState(0);
  useState(() => {
    const iv = setInterval(() => setStep(s => Math.min(s + 1, APEX_STEPS.length - 1)), 3500);
    return () => clearInterval(iv);
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 20px", gap: 20 }}>
      <div style={{ position: "relative", width: 70, height: 70 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${C.green}15`, animation: "spin 3s linear infinite" }} />
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `2px solid ${C.green}30`, animation: "spin 2s linear infinite reverse" }} />
        <div style={{ position: "absolute", inset: 14, borderRadius: "50%", background: C.green + "10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📡</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: C.green, fontSize: 12, fontWeight: 700, ...mono(), marginBottom: 6 }}>APEX RESEARCH IN PROGRESS</div>
        <div style={{ color: C.muted, fontSize: 11 }}>Running {APEX_STEPS.length} research searches...</div>
      </div>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {APEX_STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", opacity: i <= step ? 1 : 0.18, transition: "opacity .5s" }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: i < step ? C.green : "transparent", border: `1px solid ${i <= step ? C.green : C.muted}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000" }}>
              {i < step ? "✓" : ""}
            </div>
            <span style={{ color: i === step ? C.green : i < step ? C.dim : C.muted, fontSize: 11, ...mono() }}>{s}</span>
            {i === step && <Spinner size={16} />}
          </div>
        ))}
      </div>
      <div style={{ color: C.muted, fontSize: 10 }}>Takes 30-60 seconds — real research happening</div>
    </div>
  );
}

// ─── MARKET SUMMARY BAR ───────────────────────────────────────────────────────
function MarketBar({ apex }) {
  const chips = [
    { l: "CONDITION",  v: apex.marketCondition, c: condColor(apex.marketCondition) },
    { l: "SENTIMENT",  v: apex.marketSentiment, c: sentColor(apex.marketSentiment) },
    { l: "VIX",        v: apex.vix,             c: parseFloat(apex.vix) > 25 ? C.red : parseFloat(apex.vix) > 18 ? C.orange : C.green },
    { l: "FEAR/GREED", v: apex.fearGreed,       c: C.text },
    { l: "S&P 500",    v: apex.sp500,           c: C.text },
    { l: "NASDAQ",     v: apex.nasdaq,          c: C.text },
    { l: "10Y YIELD",  v: apex.tenYearYield,    c: C.text },
  ].filter(x => x.v);

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 0 14px", borderBottom: `1px solid ${C.bord2}`, marginBottom: 18 }}>
      {chips.map(({ l, v, c }) => (
        <div key={l}>
          <div style={{ color: C.muted, fontSize: 9, ...mono(), marginBottom: 3, letterSpacing: 1 }}>{l}</div>
          <div style={{ color: c, fontSize: 13, fontWeight: 700, ...mono() }}>{v}</div>
        </div>
      ))}
      {apex.cashAdvised && <Pill color={C.yellow}>⚠ CASH ADVISED</Pill>}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  // Phase: idle | apex-loading | apex-done | chart-pending | chart-loading | combined | journal
  const [phase,       setPhase]       = useState("idle");
  const [apexData,    setApexData]    = useState(null);
  const [apexError,   setApexError]   = useState(null);
  const [userContext, setUserContext] = useState("");
  const [showCtx,     setShowCtx]     = useState(false);

  // Per-trade chart uploads and analysis
  const [chartImages,  setChartImages]  = useState({});  // ticker → {preview, base64}
  const [chartResults, setChartResults] = useState({});  // ticker → chart analysis
  const [combScores,   setCombScores]   = useState({});  // ticker → combined score
  const [chartLoading, setChartLoading] = useState({});  // ticker → bool
  const [chartErrors,  setChartErrors]  = useState({});  // ticker → string

  // Journal
  const [journal,     setJournal]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("analysis"); // analysis | journal

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // ── Run APEX research ──────────────────────────────────────────────────────
  const runApex = useCallback(async () => {
    setPhase("apex-loading");
    setApexError(null);
    setApexData(null);
    setChartImages({});
    setChartResults({});
    setCombScores({});
    try {
      const res  = await fetch("/api/apex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContext }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setApexData(json);
      setPhase("apex-done");
    } catch (e) {
      setApexError(e.message || "APEX research failed");
      setPhase("idle");
    }
  }, [userContext]);

  // ── Run chart analysis for one ticker ─────────────────────────────────────
  const runChart = useCallback(async (ticker) => {
    const img = chartImages[ticker];
    if (!img) return;
    setChartLoading(p => ({ ...p, [ticker]: true }));
    setChartErrors(p => ({ ...p, [ticker]: null }));
    try {
      // Chart analysis
      const res  = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: img.base64, mediaType: "image/jpeg", ticker }),
      });
      const chart = await res.json();
      if (chart.error) throw new Error(chart.error);
      setChartResults(p => ({ ...p, [ticker]: chart }));

      // Get combined score
      const apexTrade = apexData.trades.find(t => t.ticker === ticker);
      if (apexTrade) {
        const cres   = await fetch("/api/combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apexTrade, chartAnalysis: chart }),
        });
        const score = await cres.json();
        setCombScores(p => ({ ...p, [ticker]: score }));
      }
    } catch (e) {
      setChartErrors(p => ({ ...p, [ticker]: e.message || "Chart analysis failed" }));
    }
    setChartLoading(p => ({ ...p, [ticker]: false }));
  }, [chartImages, apexData]);

  // ── Log trade outcome ──────────────────────────────────────────────────────
  const logOutcome = (id, outcome) => {
    setJournal(j => j.map((e, i) => i === id ? { ...e, outcome } : e));
  };

  const addToJournal = (ticker, score) => {
    const apexTrade = apexData?.trades?.find(t => t.ticker === ticker);
    const chart     = chartResults[ticker];
    setJournal(j => [{
      ticker, time: new Date().toLocaleString(),
      apexTrade, chart, score,
      outcome: null,
    }, ...j]);
    setActiveTab("journal");
  };

  const tabs = [
    { id: "analysis", label: "📊 Analysis" },
    { id: "journal",  label: `📓 Journal (${journal.length})` },
  ];

  return (
    <>
      <Head>
        <title>APEX Unified — AI Trading Intelligence</title>
        <meta name="description" content="APEX + TradeAI combined: macro research meets chart analysis for the highest-conviction trades" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: "100vh", background: C.bg }}>

        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(3,7,10,0.96)", backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${C.border}`,
          padding: "0 22px", height: 54,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 24, letterSpacing: 4, color: C.green, textShadow: `0 0 20px ${C.green}50`, animation: "flicker 9s infinite" }}>
              APEX
            </span>
            <span style={{ color: C.muted, fontSize: 12 }}>UNIFIED</span>
            <div style={{ background: C.green + "12", border: `1px solid ${C.green}25`, color: C.green, fontSize: 9, padding: "2px 8px", borderRadius: 4, ...mono(), letterSpacing: 2 }}>
              MACRO + CHART + BACKTEST
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: C.muted, fontSize: 11, ...mono(), display: "none" }}>{today}</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite" }} />
              <span style={{ color: C.green, fontSize: 10, ...mono() }}>LIVE</span>
            </div>
          </div>
        </nav>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 2, padding: "0 22px", borderBottom: `1px solid ${C.bord2}`, background: "rgba(3,7,10,0.7)" }}>
          {tabs.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              background: "none", border: "none",
              padding: "11px 14px",
              fontSize: 12, fontWeight: activeTab === id ? 700 : 400,
              color: activeTab === id ? C.green : C.muted,
              borderBottom: activeTab === id ? `2px solid ${C.green}` : "2px solid transparent",
              cursor: "pointer", transition: "all .2s",
            }}>{label}</button>
          ))}
        </div>

        <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 80px" }}>

          {/* ══════════ ANALYSIS TAB ══════════ */}
          {activeTab === "analysis" && (
            <>
              {/* ── IDLE / HERO ── */}
              {phase === "idle" && (
                <>
                  <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "clamp(44px,8vw,72px)", lineHeight: .9, marginBottom: 12, letterSpacing: 4 }}>
                      ONE SYSTEM.<br /><span style={{ color: C.green, textShadow: `0 0 40px ${C.green}40` }}>COMPLETE EDGE.</span>
                    </div>
                    <p style={{ color: C.muted, fontSize: 13, maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.8 }}>
                      APEX researches the entire market in real time. Then you confirm each trade with a chart photo.
                      Only trades where <strong style={{ color: C.text }}>macro research AND chart analysis agree</strong> get a green light.
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28, textAlign: "left", maxWidth: 600, margin: "0 auto 28px" }}>
                      {[
                        ["🌍", "Step 1", "APEX scans 12+ data layers — macro, sectors, options, sentiment"],
                        ["📊", "Step 2", "You photograph the chart for each trade candidate"],
                        ["✅", "Step 3", "Combined score decides: Take Trade or Skip"],
                      ].map(([icon, step, desc]) => (
                        <div key={step} style={{ background: C.bg1, border: `1px solid ${C.bord2}`, borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                          <div style={{ color: C.green, fontSize: 10, ...mono(), marginBottom: 4 }}>{step}</div>
                          <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <button onClick={() => setShowCtx(s => !s)} style={{ background: "none", color: C.muted, fontSize: 11, textDecoration: "underline", border: "none", cursor: "pointer" }}>
                        {showCtx ? "▲ Hide" : "▼ Add"} preferences (optional)
                      </button>
                      {showCtx && (
                        <div style={{ marginTop: 10 }}>
                          <textarea
                            value={userContext}
                            onChange={e => setUserContext(e.target.value)}
                            placeholder="e.g. 'Swing trades only, $10k account, focus on tech, avoid biotech'"
                            rows={3}
                            style={{ width: "100%", maxWidth: 460, background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: C.text, fontSize: 12, resize: "vertical" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button onClick={runApex} style={{
                      background: `linear-gradient(135deg, ${C.green}, ${C.green2})`,
                      color: "#000", border: "none", borderRadius: 10,
                      padding: "15px 40px", fontWeight: 800, cursor: "pointer",
                      fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 3,
                      boxShadow: `0 0 30px ${C.green}25`,
                    }}>
                      ⚡ LAUNCH APEX ANALYSIS
                    </button>
                  </div>
                </>
              )}

              {/* ── APEX LOADING ── */}
              {phase === "apex-loading" && <ApexLoadingScreen />}

              {/* ── APEX ERROR ── */}
              {apexError && (
                <Card style={{ background: "rgba(255,51,85,0.07)", border: `1px solid ${C.red}30`, marginBottom: 20 }}>
                  <div style={{ color: C.red, fontWeight: 700, marginBottom: 6 }}>⚠ APEX Research Failed</div>
                  <p style={{ color: "#cc4455", fontSize: 13 }}>{apexError}</p>
                </Card>
              )}

              {/* ── APEX DONE — show results + chart upload ── */}
              {(phase === "apex-done") && apexData && (
                <div className="fade-up">

                  {/* Daily bias */}
                  <div style={{ background: `linear-gradient(135deg,${C.bg1},${C.bg2})`, border: `1px solid ${C.green}25`, borderLeft: `4px solid ${C.green}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                    <Label>Today's Bias</Label>
                    <p style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{apexData.dailyBias}</p>
                  </div>

                  {/* Cash warning */}
                  {apexData.cashAdvised && (
                    <Card style={{ background: "rgba(255,212,0,0.07)", border: `1px solid ${C.yellow}35`, marginBottom: 14 }}>
                      <div style={{ color: C.yellow, fontWeight: 800, marginBottom: 6 }}>⚠ CASH IS KING TODAY</div>
                      <p style={{ color: "#cc9900", fontSize: 13 }}>{apexData.cashReason}</p>
                    </Card>
                  )}

                  {/* Market bar */}
                  <MarketBar apex={apexData} />

                  {/* Market summary */}
                  <Card style={{ marginBottom: 16 }}>
                    <Label>📰 Market Summary</Label>
                    <p style={{ color: C.text, fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>{apexData.marketSummary}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <Label>Leading</Label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {apexData.sectorLeaders?.map((s, i) => <Pill key={i} color={C.green} small>{s}</Pill>)}
                        </div>
                      </div>
                      <div>
                        <Label>Lagging</Label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {apexData.sectorLaggards?.map((s, i) => <Pill key={i} color={C.red} small>{s}</Pill>)}
                        </div>
                      </div>
                      <div>
                        <Label>Events</Label>
                        {apexData.economicEvents?.map((e, i) => (
                          <div key={i} style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>
                            {typeof e === "object" ? `${e.time} ${e.event}` : e}
                          </div>
                        ))}
                      </div>
                    </div>
                    {apexData.keyRisks?.length > 0 && (
                      <div style={{ marginTop: 12, background: "rgba(255,149,0,0.05)", border: `1px solid ${C.orange}20`, borderRadius: 7, padding: 10 }}>
                        <Label>Key Risks</Label>
                        {apexData.keyRisks.map((r, i) => <div key={i} style={{ color: "#996600", fontSize: 11 }}>⚠ {r}</div>)}
                      </div>
                    )}
                  </Card>

                  {/* ── PER-TRADE SECTIONS ── */}
                  {apexData.trades?.map((trade, ti) => (
                    <div key={trade.ticker} style={{ marginBottom: 28 }}>
                      {/* Trade header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2, color: "#fff" }}>
                          Trade #{trade.rank} —
                        </div>
                        <span style={{ color: C.green, fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2 }}>{trade.ticker}</span>
                        <Pill color={dirColor(trade.direction)}>{trade.direction}</Pill>
                        <Pill color={gradeColor(trade.apexGrade)} small>APEX {trade.apexGrade}</Pill>
                      </div>

                      {/* APEX analysis panel */}
                      <div style={{ marginBottom: 10 }}>
                        <Label>STEP 1 — APEX RESEARCH</Label>
                        <ApexTradePanel trade={trade} />
                      </div>

                      {/* Chart upload section */}
                      <div style={{ marginBottom: 10 }}>
                        <Label>STEP 2 — CHART CONFIRMATION</Label>
                        <Card style={{ padding: 14 }}>
                          <ImageUploader
                            ticker={trade.ticker}
                            currentPreview={chartImages[trade.ticker]?.preview}
                            onImage={(imgData) => setChartImages(p => ({ ...p, [trade.ticker]: imgData }))}
                          />
                          {chartImages[trade.ticker] && !chartResults[trade.ticker] && (
                            <button
                              onClick={() => runChart(trade.ticker)}
                              disabled={chartLoading[trade.ticker]}
                              style={{
                                marginTop: 12,
                                background: chartLoading[trade.ticker] ? "rgba(0,255,136,0.08)" : `linear-gradient(135deg,${C.green},${C.green2})`,
                                color: chartLoading[trade.ticker] ? C.green : "#000",
                                border: chartLoading[trade.ticker] ? `1px solid ${C.green}30` : "none",
                                borderRadius: 8, padding: "10px 20px", fontWeight: 800, fontSize: 13,
                                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                              }}>
                              {chartLoading[trade.ticker] ? <><Spinner size={18} /> Analyzing chart + backtesting...</> : `⚡ Analyze ${trade.ticker} Chart`}
                            </button>
                          )}
                          {chartErrors[trade.ticker] && (
                            <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>⚠ {chartErrors[trade.ticker]}</div>
                          )}
                        </Card>
                      </div>

                      {/* Chart result */}
                      {chartResults[trade.ticker] && (
                        <div style={{ marginBottom: 10 }}>
                          <Label>CHART ANALYSIS — {trade.ticker}</Label>
                          <ChartPanel chart={chartResults[trade.ticker]} preview={chartImages[trade.ticker]?.preview} />
                        </div>
                      )}

                      {/* Combined score */}
                      {combScores[trade.ticker] && (
                        <div>
                          <Label>STEP 3 — COMBINED VERDICT</Label>
                          <CombinedScorePanel score={combScores[trade.ticker]} />
                          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => addToJournal(trade.ticker, combScores[trade.ticker])}
                              style={{ background: C.bg2, color: C.muted, border: `1px solid ${C.bord2}`, borderRadius: 7, padding: "7px 14px", fontSize: 11, cursor: "pointer" }}>
                              + Add to Journal
                            </button>
                            <button
                              onClick={() => runChart(trade.ticker)}
                              style={{ background: "none", color: C.muted, border: `1px solid ${C.bord2}`, borderRadius: 7, padding: "7px 14px", fontSize: 11, cursor: "pointer" }}>
                              ↺ Re-analyze Chart
                            </button>
                          </div>
                        </div>
                      )}

                      {ti < apexData.trades.length - 1 && (
                        <div style={{ height: 1, background: C.bord2, margin: "24px 0" }} />
                      )}
                    </div>
                  ))}

                  {/* Watchlist */}
                  {apexData.watchlist?.length > 0 && (
                    <Card style={{ marginBottom: 14 }}>
                      <Label>👁 Watchlist — Not Trading Yet</Label>
                      {apexData.watchlist.map((w, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, background: C.bg2, borderRadius: 7, padding: "8px 10px", marginTop: 7 }}>
                          <span style={{ color: C.yellow, fontWeight: 700, ...mono(), fontSize: 13, flexShrink: 0 }}>{w.ticker}</span>
                          <div>
                            <p style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{w.reason}</p>
                            {w.triggerLevel && <div style={{ color: C.green, fontSize: 10, marginTop: 2, ...mono() }}>Trigger: {w.triggerLevel}</div>}
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Avoid */}
                  {apexData.avoidToday?.length > 0 && (
                    <Card style={{ marginBottom: 14 }}>
                      <Label>🚫 Avoid Today</Label>
                      {apexData.avoidToday.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, background: C.bg2, borderRadius: 7, padding: "8px 10px", marginTop: 7 }}>
                          <span style={{ color: C.red, fontWeight: 700, ...mono(), fontSize: 13, flexShrink: 0 }}>{a.ticker}</span>
                          <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{a.reason}</p>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Research sources */}
                  {apexData.researchSources?.length > 0 && (
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ color: C.muted, fontSize: 11, cursor: "pointer", padding: "8px 0" }}>
                        🔬 Research sources ({apexData.researchSources.length})
                      </summary>
                      <Card style={{ marginTop: 8 }}>
                        {apexData.researchSources.map((s, i) => (
                          <div key={i} style={{ color: C.muted, fontSize: 10, ...mono(), borderLeft: `2px solid ${C.border}`, paddingLeft: 8, marginBottom: 4 }}>
                            {i + 1}. {s}
                          </div>
                        ))}
                      </Card>
                    </details>
                  )}

                  {/* Run again */}
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                    <button onClick={runApex} style={{ background: "none", color: C.muted, border: `1px solid ${C.bord2}`, borderRadius: 8, padding: "8px 20px", fontSize: 11, cursor: "pointer" }}>
                      ⟳ Run Fresh Analysis
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════ JOURNAL TAB ══════════ */}
          {activeTab === "journal" && (
            <div className="fade-up">
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Trade Journal</div>
              {journal.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📓</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>No trades logged yet.</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Run an analysis and tap "Add to Journal" on completed verdicts.</div>
                </div>
              ) : (
                journal.map((entry, i) => {
                  const sc = entry.score;
                  const gc = sc ? gradeColor(sc.finalGrade) : "#888";
                  return (
                    <Card key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 9, background: gc + "18", border: `2px solid ${gc}40`, display: "flex", alignItems: "center", justifyContent: "center", color: gc, fontSize: 16, fontWeight: 900, ...mono(), flexShrink: 0 }}>
                          {sc?.finalGrade || "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, ...mono() }}>{entry.ticker}</span>
                            {sc && <Pill color={sc.takeTradeRecommendation ? C.green : C.red} small>{sc.takeTradeRecommendation ? "TAKE" : "SKIP"}</Pill>}
                            {sc && <Pill color={gc} small>{sc.combinedScore}/100</Pill>}
                          </div>
                          <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>{entry.time}</div>
                          {sc && (
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
                              {[
                                { l: "Entry",  v: sc.bestEntry,  c: "#fff" },
                                { l: "Stop",   v: sc.bestStop,   c: C.red },
                                { l: "T1",     v: sc.bestT1,     c: "#7fff7f" },
                                { l: "T2",     v: sc.bestT2,     c: C.green },
                                { l: "R:R",    v: sc.bestRR,     c: C.green },
                              ].filter(x => x.v).map(({ l, v, c }) => (
                                <div key={l}>
                                  <div style={{ color: C.muted, fontSize: 9, ...mono() }}>{l}</div>
                                  <div style={{ color: c, fontSize: 12, fontWeight: 700, ...mono() }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Outcome logger */}
                          {entry.outcome ? (
                            <Pill color={outcomeColor(entry.outcome)}>{outcomeLabel(entry.outcome)}</Pill>
                          ) : (
                            <div>
                              <div style={{ color: C.muted, fontSize: 10, marginBottom: 6 }}>Log outcome:</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {["WIN_T2", "WIN_T1", "PARTIAL", "LOSS"].map(o => (
                                  <button key={o} onClick={() => logOutcome(i, o)} style={{
                                    background: outcomeColor(o) + "15",
                                    border: `1px solid ${outcomeColor(o)}35`,
                                    color: outcomeColor(o), borderRadius: 6,
                                    padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                                  }}>
                                    {outcomeLabel(o)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </main>

        <div style={{ borderTop: `1px solid ${C.bord2}`, padding: "12px 22px", color: "#1a2a2a", fontSize: 9, textAlign: "center", lineHeight: 1.8, ...mono() }}>
          ⚠ EDUCATIONAL PURPOSES ONLY — NOT FINANCIAL ADVICE — TRADING INVOLVES SIGNIFICANT RISK OF LOSS — ALWAYS DO YOUR OWN RESEARCH
        </div>
      </div>
    </>
  );
}
