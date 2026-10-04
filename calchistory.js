"use strict";
// SalaryPlan: calculator history (saved on this phone, latest 100).

const CH_KEY = "sp_calc_hist";
function chLoad() {
  try {
    const a = JSON.parse(lsGet(CH_KEY));
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function chSave(a) { lsSet(CH_KEY, JSON.stringify(a.slice(0, 100))); }

const chStyle = document.createElement("style");
chStyle.textContent = `
.pBody.calcFull{position:relative}
.chPanel{position:absolute;top:0;right:0;bottom:0;left:0;background:var(--bg);z-index:3;padding:8px 14px 16px;overflow:auto;display:none}
.chPanel.open{display:block}
.chHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
.chHead h3{margin:0}
.chHead button{min-height:44px}
.chItem{background:var(--card);border-radius:14px;box-shadow:var(--shadow);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.chItem .chMain{flex:1;min-width:0;text-align:left;background:transparent;border:0;color:var(--text);padding:0;min-height:0;border-radius:0}
.chMain .chE{color:var(--muted);font-size:.9rem;word-break:break-all}
.chMain .chR{font-size:1.4rem;font-weight:700;word-break:break-all}
.chMain .chT{color:var(--muted);font-size:.7rem}
.chItem .chRe{min-height:40px;padding:0 12px;background:var(--mint);color:var(--accent);border:0;border-radius:10px;font-weight:600;flex:none}
`;
document.head.appendChild(chStyle);

const baseCalcPage2 = calculatorPage;
calculatorPage = function (body) {
  baseCalcPage2(body);
  const grid = body.querySelector(".calcGrid");
  const exprEl = body.querySelector(".calcExpr");
  const res = body.querySelector(".calcRes");
  const bar = body.querySelector(".nBar");
  if (!grid || !exprEl || !res || !bar) return;

  // Type something into the calculator by tapping its own keys.
  const keys = {};
  grid.querySelectorAll("button").forEach(b => { keys[b.textContent] = b; });
  function typeKeys(s) {
    keys["C"].click();
    Array.from(s).forEach(ch => { if (keys[ch]) keys[ch].click(); });
  }

  // Remember each finished calculation.
  let pre = "";
  grid.addEventListener("click", e => {
    if (e.target.textContent === "=") pre = exprEl.textContent;
  }, true);
  grid.addEventListener("click", e => {
    if (e.target.textContent !== "=") return;
    if (!/[+−×÷%]/.test(pre) || res.textContent === "Error") return;
    const list = chLoad();
    list.unshift({ e: pre, r: res.textContent, p: exprEl.textContent, t: new Date().toISOString() });
    chSave(list);
  });

  // History panel
  const panel = mkEl("div", "chPanel");
  const head = mkEl("div", "chHead");
  const clear = mkEl("button", "secondary", "Clear all");
  clear.type = "button";
  clear.style.color = "var(--danger)";
  const close = mkEl("button", "primary", "Close");
  close.type = "button";
  const btns = mkEl("div");
  btns.append(clear, close);
  btns.style.display = "flex";
  btns.style.gap = "8px";
  head.append(mkEl("h3", "", "History"), btns);
  const listBox = mkEl("div");
  panel.append(head, listBox);
  body.appendChild(panel);

  function drawHist() {
    listBox.innerHTML = "";
    const list = chLoad();
    if (!list.length) {
      listBox.appendChild(mkEl("p", "muted", "No calculations yet. Finished sums appear here."));
      return;
    }
    list.forEach(h => {
      const row = mkEl("div", "chItem");
      const main = mkEl("button", "chMain");
      main.type = "button";
      main.append(mkEl("div", "chE", h.e + " ="), mkEl("div", "chR", h.r), mkEl("div", "chT", fmtStamp(h.t)));
      main.onclick = () => { panel.classList.remove("open"); typeKeys(h.p); };
      const re = mkEl("button", "chRe", "Reuse sum");
      re.type = "button";
      re.onclick = () => { panel.classList.remove("open"); typeKeys(h.e); };
      row.append(main, re);
      listBox.appendChild(row);
    });
  }

  close.onclick = () => panel.classList.remove("open");
  clear.onclick = () => {
    if (confirm("Clear all calculator history?")) { chSave([]); drawHist(); }
  };

  const hb = mkEl("button", "secondary", "History");
  hb.type = "button";
  hb.onclick = () => { drawHist(); panel.classList.add("open"); };
  bar.insertBefore(hb, bar.lastChild);
};
