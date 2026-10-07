"use strict";
// SalaryPlan: tap the Income or Expenses card to see only that kind of transaction.

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(m) {
  const p = m.split("-");
  return (FULL_MONTHS[Number(p[1]) - 1] || m) + " " + p[0];
}

const clStyle = document.createElement("style");
clStyle.textContent = `
.card.tap{position:relative;cursor:pointer}
.card.tap::after{content:"›";position:absolute;right:14px;top:10px;font-size:1.4rem;color:var(--muted)}
.card.tap:active{transform:scale(.98)}
`;
document.head.appendChild(clStyle);

let histOn = false, histDraw = null;

function historyPage(body, type) {
  histOn = true;
  const st = { scope: "month", cat: "", limit: 100 };
  const scopeBar = mkEl("div", "pOpts");
  const catSel = document.createElement("select");
  catSel.setAttribute("aria-label", "Category");
  catSel.style.margin = "12px 0";
  const summary = mkEl("p", "muted", "");
  const list = mkEl("div", "list txList");
  const more = mkEl("button", "secondary", "Show more");
  more.type = "button";
  more.style.width = "100%";
  more.onclick = () => { st.limit += 100; draw(); };
  body.append(scopeBar, catSel, summary, list, more);

  catSel.addEventListener("change", () => { st.cat = catSel.value; st.limit = 100; draw(); });

  function draw() {
    const month = $("month").value;

    scopeBar.innerHTML = "";
    [["month", "This month"], ["all", "All time"]].forEach(o => {
      const b = mkEl("button", st.scope === o[0] ? "on" : "", o[1]);
      b.type = "button";
      b.onclick = () => { st.scope = o[0]; st.cat = ""; st.limit = 100; draw(); };
      scopeBar.appendChild(b);
    });

    const inScope = data.transactions
      .filter(t => t.type === type && (st.scope === "all" || t.date.startsWith(month)));

    const cats = Array.from(new Set(inScope.map(t => t.category))).sort();
    if (st.cat && !cats.includes(st.cat)) st.cat = "";
    catSel.innerHTML = "";
    const all = document.createElement("option");
    all.value = ""; all.textContent = "All categories";
    catSel.appendChild(all);
    cats.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      catSel.appendChild(o);
    });
    catSel.value = st.cat;

    const items = inScope
      .filter(t => !st.cat || t.category === st.cat)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));
    const total = items.reduce((s, t) => s + t.amount, 0);
    const label = type === "income" ? "income" : "expenses";
    summary.textContent = items.length + (items.length === 1 ? " transaction" : " transactions") +
      " · Total " + formatKobo(total) + " · " + (st.scope === "all" ? "All months" : monthLabel(month));

    list.innerHTML = "";
    if (!items.length) {
      list.appendChild(mkEl("p", "muted", "No " + label + " found."));
    }
    items.slice(0, st.limit).forEach(t => list.appendChild(txRow(t, "button")));
    more.style.display = items.length > st.limit ? "" : "none";
  }

  histDraw = draw;
  draw();
}

// Refresh the open list after you edit a transaction.
const renderBeforeCardList = render;
render = function () {
  renderBeforeCardList();
  if (histOn && pageDlg.open && histDraw) histDraw();
};
pageDlg.addEventListener("close", () => { histOn = false; });

// ---- Make the two cards tappable ----
[["sumIncome", "income", "Income"], ["sumExpense", "expense", "Expenses"]].forEach(c => {
  const el = $(c[0]).parentElement;
  el.classList.add("tap");
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", "View all " + c[2].toLowerCase());
  const go = () => openPage(c[2], b => historyPage(b, c[1]));
  el.onclick = go;
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
});
