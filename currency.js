"use strict";
// SalaryPlan Stage 18: preferred currency.
// Changes the symbol and number format only. Saved amounts are NOT converted.

let curCode = lsGet("sp_cur") || "NGN";
if (!FX_CODES[curCode]) curCode = "NGN";
let curFmt = null, curSym = "₦";

function buildFormatter(code) {
  try {
    return new Intl.NumberFormat(code === "NGN" ? "en-NG" : "en",
      { style: "currency", currency: code, currencyDisplay: "narrowSymbol" });
  } catch (e) {
    return new Intl.NumberFormat("en", { style: "currency", currency: code });
  }
}

function applyCurrency() {
  curFmt = buildFormatter(curCode);
  const part = curFmt.formatToParts(0).find(x => x.type === "currency");
  curSym = part ? part.value : curCode;
  formatKobo = function (k) { return curFmt.format(k / 100); };
}

// ---- Swap the ₦ sign in form labels and placeholders ----
const symTpl = new WeakMap();

function sweepCurrency() {
  document.querySelectorAll("[placeholder]").forEach(e => {
    let t = e.dataset.curTpl;
    const p = e.getAttribute("placeholder") || "";
    if (!t && p.includes("₦")) { t = p.replace(/₦/g, "{c}"); e.dataset.curTpl = t; }
    if (t) {
      const v = t.replace(/\{c\}/g, curSym);
      if (v !== p) e.setAttribute("placeholder", v);
    }
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(node => {
    const par = node.parentElement;
    if (!par || par.tagName !== "LABEL") return; // only form labels, never amounts
    let t = symTpl.get(node);
    if (!t && node.nodeValue.includes("₦")) { t = node.nodeValue.replace(/₦/g, "{c}"); symTpl.set(node, t); }
    if (t) {
      const v = t.replace(/\{c\}/g, curSym);
      if (v !== node.nodeValue) node.nodeValue = v;
    }
  });
}

let sweepTimer = null;
new MutationObserver(() => {
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(sweepCurrency, 50);
}).observe(document.body, { childList: true, subtree: true });

// ---- Settings page: Currency card ----
const baseSettingsPage2 = settingsPage;
settingsPage = function (body) {
  baseSettingsPage2(body);
  const old = Array.from(body.querySelectorAll(".pCard")).find(c => {
    const h = c.querySelector("h3");
    return h && h.textContent === "Currency";
  });
  const c = old || card(body, "Currency", []);
  c.innerHTML = "";
  c.appendChild(mkEl("h3", "", "Currency"));

  // Custom picker (no native <select>): a field that opens the Budget dropdown.
  const pick = mkEl("button", "selBtn");
  pick.type = "button";
  pick.setAttribute("aria-label", "Preferred currency");
  pick.setAttribute("aria-haspopup", "listbox");
  pick.appendChild(mkEl("span", "", curCode + " - " + FX_CODES[curCode]));
  pick.appendChild(mkEl("span", "selCaret", "\u25BE"));
  pick.onclick = () => showDropdown({
    anchor: pick,
    value: curCode,
    options: Object.keys(FX_CODES).map(code => ({ value: code, label: code + " - " + FX_CODES[code] })),
    onSelect: next => {
      if (next === curCode) return;
      showConfirmDialog({
        title: "Change currency to " + FX_CODES[next] + "?",
        message: "This only changes the symbol and number format. Your saved amounts are NOT converted.",
        confirmLabel: "Change"
      }).then(ok => {
        if (!ok) return;
        curCode = next;
        lsSet("sp_cur", curCode);
        applyCurrency();
        render();
        sweepCurrency();
        openPage("Settings", settingsPage);
        showToast("Currency changed to " + FX_CODES[next]);
      });
    }
  });
  c.appendChild(pick);
  c.appendChild(mkEl("p", "muted", "Example: " + curFmt.format(150000.5)));
  c.appendChild(mkEl("p", "muted", "Changing the currency does not convert your saved amounts. For example, a ₦50,000 budget would show as 50,000 in the new currency."));
};

// ---- About page shows the current currency ----
const baseAboutPage = aboutPage;
aboutPage = function (body) {
  baseAboutPage(body);
  body.querySelectorAll(".pRow").forEach(r => {
    const s = r.querySelector("span"), st = r.querySelector("strong");
    if (s && st && s.textContent === "Currency") st.textContent = FX_CODES[curCode] + " (" + curSym + ")";
  });
};

$("month").addEventListener("change", sweepCurrency);

applyCurrency();
render();
sweepCurrency();
