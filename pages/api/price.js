// Free crypto price proxy using CoinGecko (no API key required)
// Maps common tickers to CoinGecko IDs and returns current USD prices.

const TICKER_TO_ID = {
  BTC: "bitcoin", XBT: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche-2", DOT: "polkadot",
  MATIC: "matic-network", POL: "matic-network", LINK: "chainlink", LTC: "litecoin",
  SHIB: "shiba-inu", TRX: "tron", UNI: "uniswap", ATOM: "cosmos", XLM: "stellar",
  NEAR: "near", APT: "aptos", ARB: "arbitrum", OP: "optimism", INJ: "injective-protocol",
  SUI: "sui", SEI: "sei-network", TIA: "celestia", PEPE: "pepe", WIF: "dogwifcoin",
  BONK: "bonk", JUP: "jupiter-exchange-solana", RNDR: "render-token", RENDER: "render-token",
  FET: "fetch-ai", TAO: "bittensor", IMX: "immutable-x", FIL: "filecoin", HBAR: "hedera-hashgraph",
  AAVE: "aave", MKR: "maker", LDO: "lido-dao", CRV: "curve-dao-token", ENA: "ethena",
  ONDO: "ondo-finance", PYTH: "pyth-network", JTO: "jito-governance-token", WLD: "worldcoin-wld"
};

function normalize(ticker) {
  if (!ticker) return null;
  let t = String(ticker).toUpperCase().replace(/[^A-Z0-9]/g, "");
  t = t.replace(/USDT$|USD$|USDC$|PERP$/g, "");
  return TICKER_TO_ID[t] || null;
}

export default async function handler(req, res) {
  const tickersParam = (req.query.tickers || req.query.ticker || "").toString();
  if (!tickersParam) return res.status(400).json({ error: "Provide tickers, comma-separated" });

  const tickers = tickersParam.split(",").map(s => s.trim()).filter(Boolean);
  const idMap = {};
  const ids = [];
  for (const tk of tickers) {
    const id = normalize(tk);
    if (id) { idMap[tk] = id; if (!ids.includes(id)) ids.push(id); }
  }

  if (ids.length === 0) {
    return res.status(200).json({ prices: {}, unsupported: tickers });
  }

  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=" + ids.join(",") + "&vs_currencies=usd";
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error("CoinGecko returned " + r.status);
    const data = await r.json();
    const prices = {};
    const unsupported = [];
    for (const tk of tickers) {
      const id = idMap[tk];
      if (id && data[id] && typeof data[id].usd === "number") {
        prices[tk] = data[id].usd;
      } else {
        unsupported.push(tk);
      }
    }
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(200).json({ prices, unsupported });
  } catch (err) {
    res.status(500).json({ error: err.message || "Price fetch failed" });
  }
}
