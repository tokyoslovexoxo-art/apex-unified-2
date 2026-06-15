import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TABLE = "journal_trades";

function sbHeaders() {
  return { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json" };
}

function num(v) { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; }

function fmtDate(s) {
  if (!s) return "-";
  try { return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

export default function Journal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ ticker: "", direction: "LONG", entry: "", stopLoss: "", target1: "", target2: "", conviction: "", notes: "" });
    const [recheckId, setRecheckId] = useState(null);
  const [recheckResult, setRecheckResult] = useState({});
  const [recheckLoading, setRecheckLoading] = useState(null);
  const configured = Boolean(SB_URL && SB_KEY);

  const loadTrades = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      const r = await fetch(SB_URL + "/rest/v1/" + TABLE + "?select=*&order=logged_at.desc", { headers: sbHeaders() });
      const data = await r.json();
      setTrades(Array.isArray(data) ? data : []);
    } catch (e) { setMsg("Could not load trades: " + e.message); }
    setLoading(false);
  }, [configured]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const refreshPrices = useCallback(async () => {
    const open = trades.filter(t => t.status === "OPEN");
    if (open.length === 0) { setMsg("No open trades to check."); return; }
    setMsg("Checking live prices...");
    const tickers = [...new Set(open.map(t => t.ticker))].join(",");
    try {
      const r = await fetch("/api/price?tickers=" + encodeURIComponent(tickers));
      const { prices } = await r.json();
      let updated = 0;
      for (const t of open) {
        const price = prices[t.ticker];
        if (typeof price !== "number") continue;
        const entry = num(t.entry); const stop = num(t.stop_loss); const tgt = num(t.target1);
        if (entry == null) continue;
        let status = "OPEN"; let resultPct = null;
        const isLong = (t.direction || "LONG").toUpperCase() === "LONG";
        if (isLong) {
          if (tgt != null && price >= tgt) { status = "WIN"; resultPct = ((tgt - entry) / entry) * 100; }
          else if (stop != null && price <= stop) { status = "LOSS"; resultPct = ((stop - entry) / entry) * 100; }
        } else {
          if (tgt != null && price <= tgt) { status = "WIN"; resultPct = ((entry - tgt) / entry) * 100; }
          else if (stop != null && price >= stop) { status = "LOSS"; resultPct = ((entry - stop) / entry) * 100; }
        }
        if (status !== "OPEN") {
          await fetch(SB_URL + "/rest/v1/" + TABLE + "?id=eq." + t.id, { method: "PATCH", headers: sbHeaders(), body: JSON.stringify({ status, result_pct: resultPct, closed_at: new Date().toISOString() }) });
          updated++;
        }
      }
      setMsg(updated > 0 ? ("Updated " + updated + " trade(s).") : "All open trades still running.");
      loadTrades();
    } catch (e) { setMsg("Price check failed: " + e.message); }
  }, [trades, loadTrades]);

  const addTrade = async () => {
    if (!form.ticker || !form.entry) { setMsg("Need at least a ticker and entry price."); return; }
    const row = {
      id: "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      ticker: form.ticker.toUpperCase().trim(),
      asset_class: "CRYPTO",
      direction: form.direction,
      entry: num(form.entry),
      stop_loss: num(form.stopLoss),
      target1: num(form.target1),
      target2: num(form.target2),
      conviction: form.conviction ? parseInt(form.conviction) : null,
      notes: form.notes || null,
      status: "OPEN"
    };
    try {
      const r = await fetch(SB_URL + "/rest/v1/" + TABLE, { method: "POST", headers: { ...sbHeaders(), "Prefer": "return=representation" }, body: JSON.stringify(row) });
      if (!r.ok) throw new Error("status " + r.status);
      setForm({ ticker: "", direction: "LONG", entry: "", stopLoss: "", target1: "", target2: "", conviction: "", notes: "" });
      setMsg("Trade logged.");
      loadTrades();
    } catch (e) { setMsg("Could not save: " + e.message); }
  };

  const deleteTrade = async (id) => {
    try {
      await fetch(SB_URL + "/rest/v1/" + TABLE + "?id=eq." + id, { method: "DELETE", headers: sbHeaders() });
      loadTrades();
    } catch (e) { setMsg("Delete failed: " + e.message); }
  };

    const markTrade = async (id, status) => {
      try {
        const body = status === "OPEN" ? { status: "OPEN", result_pct: null, closed_at: null } : { status, closed_at: new Date().toISOString() };
        await fetch(SB_URL + "/rest/v1/" + TABLE + "?id=eq." + id, { method: "PATCH", headers: sbHeaders(), body: JSON.stringify(body) });
        loadTrades();
      } catch (e) { setMsg("Could not update: " + e.message); }
    };

    const recheckTrade = async (t, imageBase64, mediaType) => {
      setRecheckLoading(t.id); setRecheckResult(p => ({ ...p, [t.id]: null }));
      try {
        const res = await fetch("/api/recheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64, mediaType, ticker: t.ticker, direction: t.direction, entry: t.entry, stopLoss: t.stop_loss, target: t.target1, notes: t.notes }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setRecheckResult(p => ({ ...p, [t.id]: data }));
        const patch = {};
        if (data.newEntry != null) patch.entry = data.newEntry;
        if (data.newStop != null) patch.stop_loss = data.newStop;
        if (Object.keys(patch).length) { await fetch(SB_URL + "/rest/v1/" + TABLE + "?id=eq." + t.id, { method: "PATCH", headers: sbHeaders(), body: JSON.stringify(patch) }); loadTrades(); }
      } catch (e) { setRecheckResult(p => ({ ...p, [t.id]: { error: e.message } })); }
      setRecheckLoading(null);
    };

  const closed = trades.filter(t => t.status === "WIN" || t.status === "LOSS");
  const wins = closed.filter(t => t.status === "WIN").length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  const totalPnl = closed.reduce((s, t) => s + (num(t.result_pct) || 0), 0);

  const C = { bg: "#03070a", card: "#0a1520", border: "rgba(0,255,136,0.15)", green: "#00ff88", red: "#ff3355", text: "#c8d8e8", dim: "#4a6a7a" };
  const box = { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: 16 };
  const inp = { background: "#060d12", border: "1px solid " + C.border, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: C.dim, marginBottom: 4 };
  const detailRow = (k, v) => v ? (<div style={{ display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: C.dim, minWidth: 110, fontSize: 12 }}>{k}</span><span style={{ fontSize: 12 }}>{v}</span></div>) : null;

  return (
    <>
      <Head><title>APEX Journal</title></Head>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "DM Sans, sans-serif", padding: "24px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.green, letterSpacing: 3 }}>APEX JOURNAL</div>
            <a href="/" style={{ color: C.dim, fontSize: 13, textDecoration: "none" }}>&larr; Back to APEX</a>
          </div>
          <div style={{ color: C.dim, fontSize: 13, marginBottom: 20 }}>Paper-trading tracker. Log a crypto trade with APEX notes, then hit Check Prices to mark wins and losses. Click any trade to see full details. Synced across devices.</div>
          {!configured && <div style={{ ...box, borderColor: C.red, color: C.red, marginBottom: 20 }}>Supabase keys not detected. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel and redeploy.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            <div style={box}><div style={{ color: C.dim, fontSize: 11 }}>WIN RATE</div><div style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{winRate}%</div><div style={{ color: C.dim, fontSize: 11 }}>{wins}/{closed.length} closed</div></div>
            <div style={box}><div style={{ color: C.dim, fontSize: 11 }}>TOTAL P&L</div><div style={{ fontSize: 26, fontWeight: 800, color: totalPnl >= 0 ? C.green : C.red }}>{totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(1)}%</div><div style={{ color: C.dim, fontSize: 11 }}>sum of closed</div></div>
            <div style={box}><div style={{ color: C.dim, fontSize: 11 }}>OPEN</div><div style={{ fontSize: 26, fontWeight: 800 }}>{trades.filter(t => t.status === "OPEN").length}</div><div style={{ color: C.dim, fontSize: 11 }}>{trades.length} total</div></div>
          </div>
          <div style={{ ...box, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: C.green }}>LOG A TRADE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 }}>
              <div><div style={lbl}>Ticker (e.g. BTC)</div><input style={inp} value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })} /></div>
              <div><div style={lbl}>Direction</div><select style={inp} value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}><option>LONG</option><option>SHORT</option></select></div>
              <div><div style={lbl}>Conviction (1-10)</div><input style={inp} value={form.conviction} onChange={e => setForm({ ...form, conviction: e.target.value })} /></div>
              <div><div style={lbl}>Entry price</div><input style={inp} value={form.entry} onChange={e => setForm({ ...form, entry: e.target.value })} /></div>
              <div><div style={lbl}>Stop loss</div><input style={inp} value={form.stopLoss} onChange={e => setForm({ ...form, stopLoss: e.target.value })} /></div>
              <div><div style={lbl}>Target 1</div><input style={inp} value={form.target1} onChange={e => setForm({ ...form, target1: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 10 }}><div style={lbl}>APEX notes (paste the catalyst, technical setup, and reasoning)</div><textarea style={{ ...inp, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <button onClick={addTrade} style={{ background: C.green, color: "#000", border: "none", borderRadius: 6, padding: "10px 18px", fontWeight: 800, cursor: "pointer", letterSpacing: 1 }}>+ LOG TRADE</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={refreshPrices} style={{ background: "transparent", color: C.green, border: "1px solid " + C.green, borderRadius: 6, padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}>CHECK PRICES</button>
            {msg && <span style={{ color: C.dim, fontSize: 13 }}>{msg}</span>}
          </div>
          <div style={box}>
            {loading ? <div style={{ color: C.dim }}>Loading...</div> : trades.length === 0 ? <div style={{ color: C.dim }}>No trades logged yet. Add one above.</div> :
              trades.map(t => {
                const sc = t.status === "WIN" ? C.green : t.status === "LOSS" ? C.red : C.dim;
                const isOpen = expanded === t.id;
                return (
                  <div key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div onClick={() => setExpanded(isOpen ? null : t.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: "pointer" }}>
                      <div>
                        <span style={{ color: C.dim, fontSize: 11, marginRight: 6 }}>{isOpen ? "\u25bc" : "\u25b6"}</span>
                        <span style={{ fontWeight: 800 }}>{t.ticker}</span>
                        <span style={{ color: C.dim, fontSize: 12, marginLeft: 8 }}>{t.direction} @ {t.entry}</span>
                        <span style={{ color: C.dim, fontSize: 12, marginLeft: 8 }}>SL {t.stop_loss} / TP {t.target1}</span>
                        {t.conviction ? <span style={{ color: C.dim, fontSize: 12, marginLeft: 8 }}>conv {t.conviction}</span> : null}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {t.result_pct != null && <span style={{ color: sc, fontSize: 13 }}>{num(t.result_pct) >= 0 ? "+" : ""}{num(t.result_pct).toFixed(1)}%</span>}
                        <span style={{ color: sc, fontWeight: 800, fontSize: 13 }}>{t.status}</span>
                        <span onClick={(e) => { e.stopPropagation(); deleteTrade(t.id); }} style={{ color: C.dim, cursor: "pointer", fontSize: 16 }}>&times;</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "4px 0 14px 18px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        {detailRow("Entered", fmtDate(t.logged_at))}
                        {t.closed_at && detailRow("Closed", fmtDate(t.closed_at))}
                        {detailRow("Direction", t.direction)}
                        {detailRow("Entry", t.entry)}
                        {detailRow("Stop loss", t.stop_loss)}
                        {detailRow("Target 1", t.target1)}
                        {detailRow("Target 2", t.target2)}
                        {detailRow("Conviction", t.conviction)}
{isOpen && (<div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
<label style={{ display: "inline-block", background: "transparent", color: C.green, border: "1px solid " + C.green, borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
{recheckLoading === t.id ? "Analyzing chart..." : "Re-check chart with APEX"}
<input type="file" accept="image/*" style={{ display: "none" }} disabled={recheckLoading === t.id} onChange={(e) => { const f = e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { recheckTrade(t, reader.result.split(",")[1], f.type || "image/jpeg"); }; reader.readAsDataURL(f); }} />
  </label>
{recheckResult[t.id] && !recheckResult[t.id].error && (<div style={{ marginTop: 10, fontSize: 12, color: C.text, background: C.bg, border: "1px solid " + C.border, borderRadius: 8, padding: 10 }}>
<div style={{ fontWeight: 800, color: recheckResult[t.id].verdict === "EXIT" ? C.red : recheckResult[t.id].verdict === "HOLD" ? C.green : C.yellow, marginBottom: 4 }}>{recheckResult[t.id].verdict} {recheckResult[t.id].confidence ? ("(" + recheckResult[t.id].confidence + "/10)") : ""}</div>
<div style={{ marginBottom: 4 }}>{recheckResult[t.id].changesSummary}</div>
<div style={{ color: C.dim, fontSize: 11 }}>{recheckResult[t.id].reasoning}</div>
<div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Trade updated: entry {recheckResult[t.id].newEntry}, stop {recheckResult[t.id].newStop}</div>
  </div>)}
{recheckResult[t.id] && recheckResult[t.id].error && (<div style={{ marginTop: 10, fontSize: 12, color: C.red }}>Re-check failed: {recheckResult[t.id].error}</div>)}
  </div>)}
                        {detailRow("Result", t.result_pct != null ? (num(t.result_pct).toFixed(1) + "%") : null)}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => markTrade(t.id, "WIN")} style={{ background: "transparent", color: C.green, border: "1px solid " + C.green, borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Mark Win</button><button onClick={() => markTrade(t.id, "LOSS")} style={{ background: "transparent", color: C.red, border: "1px solid " + C.red, borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✗ Mark Loss</button>{(t.status === "WIN" || t.status === "LOSS") && <button onClick={() => markTrade(t.id, "OPEN")} style={{ background: "transparent", color: C.dim, border: "1px solid " + C.dim, borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Reset to Open</button>}</div>
                        {t.notes && (<div style={{ marginTop: 8 }}><div style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>APEX notes</div><div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", background: "#060d12", border: "1px solid " + C.border, borderRadius: 6, padding: 10 }}>{t.notes}</div></div>)}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <div style={{ color: C.dim, fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>Paper trading only. Win/loss is based on whether live price crossed your target or stop since logging. Needs dozens of trades over weeks to mean anything. Not financial advice.</div>
        </div>
      </div>
    </>
  );
}
