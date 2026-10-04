"use strict";
// SalaryPlan Stage 17: More tools (Calculator and Currency converter).

ICONS.calc = '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="16" y2="18"/>';
ICONS.grid = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>';
ICONS.swap = '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>';

const tStyle = document.createElement("style");
tStyle.textContent = `
.toolRow{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:var(--card);color:var(--text);border:0;border-radius:16px;box-shadow:var(--shadow);padding:14px;margin-bottom:10px;min-height:0}
.toolRow .ic{width:44px;height:44px;border-radius:14px;background:var(--mint);color:var(--accent);display:flex;align-items:center;justify-content:center;flex:none}
.toolRow svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.toolRow strong{display:block}
.toolRow small{color:var(--muted)}
.calcDisp{background:var(--card);border-radius:16px;padding:16px;text-align:right;min-height:100px;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;margin-bottom:12px;box-shadow:var(--shadow)}
.calcExpr{color:var(--muted);font-size:1.1rem;word-break:break-all;min-height:1.4em}
.calcRes{font-size:2rem;font-weight:700;word-break:break-all}
.calcGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.calcGrid button{min-height:64px;border-radius:18px;border:0;background:var(--card);color:var(--text);font-size:1.4rem;font-weight:600;box-shadow:var(--shadow);padding:0}
.calcGrid .op{background:var(--mint);color:var(--accent)}
.calcGrid .eq{background:var(--accent2);color:#fff}
.calcGrid .fn{color:var(--danger)}
.fxRow{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end;margin:10px 0}
.fxRow button{width:48px;padding:0;border-radius:50%;background:var(--mint);color:var(--accent);border:0;display:flex;align-items:center;justify-content:center}
.fxRow svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;
document.head.appendChild(tStyle);

// ================= Calculator =================
function calcEval(s) {
  const t = s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  let i = 0;
  const peek = () => t[i];
  function num() {
    const j = i;
    while (i < t.length && /[0-9.]/.test(t[i])) i++;
    if (j === i) throw new Error("num");
    const v = parseFloat(t.slice(j, i));
    if (isNaN(v)) throw new Error("num");
    return v;
  }
  function factor() {
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("paren");
      i++;
      return v;
    }
    let v = num();
    while (peek() === "%") { i++; v /= 100; }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = t[i++];
      const r = factor();
      if (op === "/") { if (r === 0) throw new Error("div0"); v /= r; } else v *= r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = t[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  if (i < t.length) throw new Error("syntax");
  return v;
}

function fmtNum(v) {
  return Number(v.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 8 });
}
function toPlain(v) {
  if (!isFinite(v)) throw new Error("range");
  let s = Number(v.toPrecision(12)).toFixed(8).replace(/\.?0+$/, "");
  if (s === "" || s === "-0") s = "0";
  return s.replace("-", "−");
}

function calculatorPage(body) {
  let expr = "", justEq = false;
  const disp = mkEl("div", "calcDisp");
  const exprEl = mkEl("div", "calcExpr");
  const res = mkEl("div", "calcRes", "0");
  disp.append(exprEl, res);
  const grid = mkEl("div", "calcGrid");
  const OPS = "+−×÷";

  function show() {
    exprEl.textContent = expr;
    let out = expr ? "" : "0";
    if (expr) {
      try { out = fmtNum(calcEval(expr)); } catch (e) { out = justEq ? "Error" : res.textContent; }
    }
    res.textContent = out;
  }

  function press(k) {
    if (k === "C") { expr = ""; justEq = false; }
    else if (k === "⌫") { expr = expr.slice(0, -1); justEq = false; }
    else if (k === "=") {
      try { expr = toPlain(calcEval(expr)); justEq = true; }
      catch (e) { res.textContent = "Error"; return; }
    }
    else if (OPS.includes(k)) {
      if (!expr) { if (k === "−") expr = "−"; }
      else if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1) + k;
      else expr += k;
      justEq = false;
    }
    else if (k === "%") { if (/[0-9)]$/.test(expr)) expr += "%"; }
    else if (k === ".") {
      const seg = expr.split(/[+−×÷]/).pop();
      if (seg.includes(".")) return;
      if (justEq) { expr = ""; justEq = false; }
      expr += seg === "" || justEq ? "0." : ".";
    }
    else {
      if (justEq) { expr = ""; justEq = false; }
      expr += k;
    }
    show();
  }

  ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", "00", ".", "="]
    .forEach(k => {
      const cls = k === "=" ? "eq" : (OPS.includes(k) || k === "%") ? "op" : (k === "C" || k === "⌫") ? "fn" : "";
      const b = mkEl("button", cls, k);
      b.type = "button";
      b.onclick = () => press(k);
      grid.appendChild(b);
    });

  const bar = mkEl("div", "nBar");
  const copy = mkEl("button", "secondary", "Copy");
  copy.type = "button";
  copy.onclick = () => {
    try {
      const v = calcEval(expr || "0");
      const txt = String(Number(v.toPrecision(12)));
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => alert("Copied " + txt), () => alert("Could not copy."));
    } catch (e) { alert("Nothing to copy yet."); }
  };
  const use = mkEl("button", "primary", "Add as expense");
  use.type = "button";
  use.onclick = () => {
    try {
      const v = calcEval(expr || "0");
      if (!(v > 0)) { alert("Enter a calculation that gives an amount above zero."); return; }
      $("amount").value = Number(v.toFixed(2));
      $("type").value = "expense";
      $("type").dispatchEvent(new Event("change"));
      pageDlg.close();
      fab.onclick();
    } catch (e) { alert("Please finish the calculation first."); }
  };
  bar.append(copy, use);
  body.append(disp, grid, bar);
  show();
}

// ================= Currency converter =================
const FX_CODES = {
  NGN: "Nigerian naira", USD: "US dollar", EUR: "Euro", GBP: "British pound", GHS: "Ghanaian cedi",
  KES: "Kenyan shilling", ZAR: "South African rand", XOF: "West African CFA franc", XAF: "Central African CFA franc",
  EGP: "Egyptian pound", MAD: "Moroccan dirham", TZS: "Tanzanian shilling", UGX: "Ugandan shilling",
  CAD: "Canadian dollar", AUD: "Australian dollar", CNY: "Chinese yuan", INR: "Indian rupee",
  AED: "UAE dirham", SAR: "Saudi riyal", JPY: "Japanese yen", CHF: "Swiss franc", TRY: "Turkish lira", BRL: "Brazilian real"
};

function fxPick(map) {
  const out = { USD: 1 };
  Object.keys(map || {}).forEach(k => {
    const c = k.toUpperCase();
    if (FX_CODES[c] && Number(map[k]) > 0) out[c] = Number(map[k]);
  });
  return out;
}

async function fetchJson(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("http " + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function loadRates(force) {
  let cache = null;
  try { cache = JSON.parse(lsGet("sp_fx")); } catch (e) {}
  if (!force && cache && cache.rates && Date.now() - cache.ts < 6 * 3600 * 1000) {
    return Object.assign({ stale: false }, cache);
  }
  const sources = [
    ["fawazahmed0 currency-api", "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      j => ({ date: j.date, rates: fxPick(j.usd) })],
    ["fawazahmed0 currency-api", "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
      j => ({ date: j.date, rates: fxPick(j.usd) })],
    ["ExchangeRate-API (exchangerate-api.com)", "https://open.er-api.com/v6/latest/USD",
      j => ({ date: String(j.time_last_update_utc || "").slice(0, 16), rates: fxPick(j.rates) })]
  ];
  for (const s of sources) {
    try {
      const p = s[2](await fetchJson(s[1], 8000));
      if (p.rates.NGN > 0) {
        const rec = { ts: Date.now(), date: p.date || "", rates: p.rates, src: s[0] };
        lsSet("sp_fx", JSON.stringify(rec));
        return Object.assign({ stale: false }, rec);
      }
    } catch (e) {}
  }
  if (cache && cache.rates) return Object.assign({ stale: true }, cache);
  return null;
}

function fmtMoney(v, code) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency: code, maximumFractionDigits: v < 1 ? 6 : 2 }).format(v); }
  catch (e) { return code + " " + v.toFixed(2); }
}

function converterPage(body) {
  let fx = null;
  const mkSel = (id, val) => {
    const s = document.createElement("select");
    s.setAttribute("aria-label", id);
    Object.keys(FX_CODES).forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c + " - " + FX_CODES[c];
      s.appendChild(o);
    });
    s.value = val;
    return s;
  };
  const amt = document.createElement("input");
  amt.type = "number"; amt.inputMode = "decimal"; amt.step = "any"; amt.min = "0"; amt.value = "1";
  amt.setAttribute("aria-label", "Amount to convert");
  const from = mkSel("From currency", lsGet("sp_fx_from") || "USD");
  const to = mkSel("To currency", lsGet("sp_fx_to") || "NGN");
  const swap = document.createElement("button");
  swap.type = "button"; swap.setAttribute("aria-label", "Swap currencies");
  swap.innerHTML = svgIcon("swap");

  const out = mkEl("div", "calcRes", "...");
  const rateLine = mkEl("p", "muted", "");
  const status = mkEl("p", "muted", "Loading rates...");
  const fromLbl = mkEl("label", "", "From"); fromLbl.appendChild(from);
  const toLbl = mkEl("label", "", "To"); toLbl.appendChild(to);
  const row = mkEl("div", "fxRow");
  row.append(fromLbl, swap, toLbl);

  function update() {
    lsSet("sp_fx_from", from.value);
    lsSet("sp_fx_to", to.value);
    if (!fx) { out.textContent = "..."; return; }
    const a = Number(amt.value);
    const rf = fx.rates[from.value], rt = fx.rates[to.value];
    if (!(rf > 0 && rt > 0) || !(a >= 0)) { out.textContent = "-"; rateLine.textContent = ""; return; }
    out.textContent = fmtMoney(a * rt / rf, to.value);
    rateLine.textContent = "1 " + from.value + " = " + Number((rt / rf).toPrecision(6)) + " " + to.value;
    useBtn.style.display = to.value === "NGN" ? "" : "none";
  }

  async function refresh(force) {
    status.textContent = "Loading rates...";
    fx = await loadRates(force);
    if (!fx) {
      status.textContent = "Could not load rates. Check your internet connection and tap Refresh.";
      out.textContent = "-";
      return;
    }
    status.textContent = (fx.stale ? "Offline: showing saved rates. " : "") +
      "Rates updated " + (fx.date || "recently") + ". Source: " + fx.src + ".";
    update();
  }

  amt.addEventListener("input", update);
  from.addEventListener("change", update);
  to.addEventListener("change", update);
  swap.onclick = () => { const t = from.value; from.value = to.value; to.value = t; update(); };

  const ref = mkEl("button", "secondary", "Refresh rates");
  ref.type = "button";
  ref.onclick = () => refresh(true);
  const useBtn = mkEl("button", "primary", "Use in new transaction");
  useBtn.type = "button";
  useBtn.style.display = "none";
  useBtn.onclick = () => {
    if (!fx) return;
    const v = Number(amt.value) * fx.rates.NGN / fx.rates[from.value];
    if (!(v > 0)) return;
    $("amount").value = Number(v.toFixed(2));
    pageDlg.close();
    fab.onclick();
  };
  const bar = mkEl("div", "nBar");
  bar.append(ref, useBtn);

  const c = card(body, "Convert", []);
  const aLbl = mkEl("label", "", "Amount");
  aLbl.appendChild(amt);
  c.append(aLbl, row, out, rateLine);
  body.append(c, status, bar);
  card(body, "About these rates", [
    "Rates come from free public services and update about once a day. They are mid-market rates, so your bank, a bureau de change or the street rate will differ.",
    "Only the currency request is sent to those services. None of your SalaryPlan data leaves your phone."
  ]);
  refresh(false);
}

// ================= Tools hub =================
function toolsPage(body) {
  [
    ["Calculator", "Quick sums, and send the result to a new expense.", "calc", () => openPage("Calculator", calculatorPage)],
    ["Currency converter", "Convert between naira, dollars, pounds and more.", "swap", () => openPage("Currency converter", converterPage)]
  ].forEach(t => {
    const b = mkEl("button", "toolRow");
    b.type = "button";
    const ic = mkEl("span", "ic");
    ic.innerHTML = svgIcon(t[2]);
    const txt = mkEl("span");
    txt.append(mkEl("strong", "", t[0]), mkEl("small", "", t[1]));
    b.append(ic, txt);
    b.onclick = t[3];
    body.appendChild(b);
  });
}

// ---- Menu item and Home tile ----
const toolsItem = mkEl("button", "dItem");
toolsItem.type = "button";
const toolsIc = mkEl("span", "ic");
toolsIc.innerHTML = svgIcon("grid");
toolsItem.append(toolsIc, mkEl("span", "", "More tools"));
toolsItem.onclick = () => openPage("More tools", toolsPage);
drawer.insertBefore(toolsItem, drawer.querySelectorAll(".dItem")[1] || drawer.querySelector(".dFoot"));

document.querySelectorAll(".qa button").forEach(b => {
  const label = b.querySelector("span:not(.ic)");
  if (label && label.textContent === "History") {
    b.querySelector(".ic").innerHTML = svgIcon("grid");
    label.textContent = "Tools";
    b.onclick = () => openPage("More tools", toolsPage);
  }
});
