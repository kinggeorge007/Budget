"use strict";
// SalaryPlan Stage 2: monthly budgets.
// Planned amounts live in data.budgets and are kept separate from transactions.

function toKobo(v) {
  const k = Math.round(Number(v) * 100);
  return Number.isFinite(k) && k > 0 ? k : 0;
}

function cleanBudgets(b) {
  const out = {};
  if (!b || typeof b !== "object") return out;
  Object.keys(b).forEach(m => {
    if (!/^\d{4}-\d{2}$/.test(m) || !b[m] || typeof b[m] !== "object") return;
    out[m] = {};
    Object.keys(b[m]).forEach(c => {
      const v = b[m][c];
      if (Number.isInteger(v) && v > 0) out[m][c.slice(0, 50)] = v;
    });
  });
  return out;
}

function prevMonth(m) {
  const p = m.split("-").map(Number);
  const d = new Date(p[0], p[1] - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// ---- Styles and section (added by this file) ----
const bStyle = document.createElement("style");
bStyle.textContent = `
.bTotals{display:grid;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px}
.bLine{display:flex;justify-content:space-between;gap:8px}
.bRow{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px;display:grid;gap:8px}
.bTop{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bTop input{width:45%;text-align:right}
.bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden}
.bar div{height:100%;width:0;background:var(--accent)}
.bInfo{font-size:.85rem;color:var(--muted)}
.bRow.near .bar div{background:#d98e00}
.bRow.near .bInfo{color:#d98e00;font-weight:600}
.bRow.over .bar div{background:var(--danger)}
.bRow.over .bInfo{color:var(--danger);font-weight:600}
`;
document.head.appendChild(bStyle);

const bSection = document.createElement("section");
bSection.innerHTML =
  '<h2>Monthly budget</h2>' +
  '<p class="muted">Planned amounts for the selected month. Plans never change your cash balance.</p>' +
  '<div id="bTotals" class="bTotals"></div>' +
  '<div id="bRows"></div>' +
  '<button type="button" id="bCopy" class="secondary">Copy budget from previous month</button>';
document.querySelector(".cards").after(bSection);

function bLine(label, value, cls) {
  const d = document.createElement("div");
  d.className = "bLine";
  const a = document.createElement("span");
  a.textContent = label;
  const b = document.createElement("strong");
  b.textContent = value;
  if (cls) b.className = cls;
  d.append(a, b);
  return d;
}

// ---- Render ----
function renderBudget() {
  const month = $("month").value;
  const box = document.getElementById("bRows");
  const totalsBox = document.getElementById("bTotals");
  box.innerHTML = "";
  totalsBox.innerHTML = "";
  if (!month) return;
  if (!data.budgets) data.budgets = {};
  const plan = data.budgets[month] || {};

  const spent = {};
  let income = 0;
  data.transactions.forEach(t => {
    if (!t.date.startsWith(month)) return;
    if (t.type === "income") income += t.amount;
    else spent[t.category] = (spent[t.category] || 0) + t.amount;
  });

  const cats = CATEGORIES.expense.slice();
  Object.keys(spent).concat(Object.keys(plan)).forEach(c => {
    if (!cats.includes(c)) cats.push(c);
  });

  const rows = [];

  function updateTotals() {
    let planned = 0, actual = 0;
    rows.forEach(r => { planned += toKobo(r.input.value); actual += r.actual; });
    const unalloc = income - planned;
    totalsBox.innerHTML = "";
    totalsBox.append(
      bLine("Income this month", formatKobo(income)),
      bLine("Total planned", formatKobo(planned)),
      bLine("Total actual spent", formatKobo(actual)),
      bLine("Unallocated (income - planned)", formatKobo(unalloc), unalloc < 0 ? "expense" : "income")
    );
  }

  cats.forEach(cat => {
    const row = document.createElement("div");
    const top = document.createElement("div");
    top.className = "bTop";
    const name = document.createElement("strong");
    name.textContent = cat;
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = "0.01";
    input.min = "0";
    input.placeholder = "Planned ₦";
    input.setAttribute("aria-label", "Planned amount for " + cat);
    if (plan[cat]) input.value = (plan[cat] / 100).toFixed(2);
    top.append(name, input);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    bar.appendChild(fill);
    const info = document.createElement("div");
    info.className = "bInfo";
    row.append(top, bar, info);
    box.appendChild(row);

    const actual = spent[cat] || 0;

    function refresh() {
      const planned = toKobo(input.value);
      let msg, cls = "";
      if (planned === 0) {
        msg = actual > 0 ? "no budget set" : "No budget set";
        if (actual > 0) cls = "over";
        fill.style.width = actual > 0 ? "100%" : "0%";
      } else {
        const pct = actual / planned * 100;
        fill.style.width = Math.min(pct, 100) + "%";
        if (actual > planned) { cls = "over"; msg = "Over budget by " + formatKobo(actual - planned); }
        else if (pct >= 80) { cls = "near"; msg = "Near limit: " + formatKobo(planned - actual) + " left"; }
        else { cls = "ok"; msg = formatKobo(planned - actual) + " left"; }
      }
      info.textContent = "Spent " + formatKobo(actual) + " · " + msg;
      row.className = "bRow " + cls;
    }

    input.addEventListener("change", () => {
      const k = toKobo(input.value);
      if (!data.budgets[month]) data.budgets[month] = {};
      if (k > 0) data.budgets[month][cat] = k;
      else delete data.budgets[month][cat];
      input.value = k > 0 ? (k / 100).toFixed(2) : "";
      saveData();
      refresh();
      updateTotals();
    });

    rows.push({ input: input, actual: actual });
    refresh();
  });
  updateTotals();
}

document.getElementById("bCopy").addEventListener("click", () => {
  const month = $("month").value;
  if (!month) return;
  if (!data.budgets) data.budgets = {};
  const prev = data.budgets[prevMonth(month)];
  if (!prev || !Object.keys(prev).length) {
    alert("There is no budget for the previous month to copy.");
    return;
  }
  const cur = data.budgets[month];
  if (cur && Object.keys(cur).length && !confirm("This will replace the budget already set for this month. Continue?")) return;
  data.budgets[month] = Object.assign({}, prev);
  saveData();
  renderBudget();
});

renderBudget();
