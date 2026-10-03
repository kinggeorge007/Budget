"use strict";
// SalaryPlan Stage 10: simple charts on the Home tab.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cStyle = document.createElement("style");
cStyle.textContent =
  ".chartBox{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:14px;margin-bottom:12px}" +
  ".chartBox h3{margin:0 0 10px;font-size:.95rem}" +
  ".hRow{display:grid;grid-template-columns:90px 1fr auto;align-items:center;gap:8px;margin:8px 0;font-size:.85rem}" +
  ".hName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".hTrack{height:10px;background:var(--line);border-radius:5px;overflow:hidden}" +
  ".hFill{height:100%;background:var(--accent2);border-radius:5px}" +
  ".vChart{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:140px}" +
  ".vGroup{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}" +
  ".vBars{display:flex;align-items:flex-end;gap:3px;height:calc(100% - 20px)}" +
  ".vBar{width:12px;border-radius:4px 4px 0 0;min-height:2px}" +
  ".vLbl{font-size:.7rem;color:var(--muted);margin-top:6px;height:14px}" +
  ".legend{display:flex;gap:14px;font-size:.75rem;color:var(--muted);margin-top:10px}" +
  ".dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px}";
document.head.appendChild(cStyle);

const chartSection = document.createElement("section");
chartSection.innerHTML = '<div id="chartBody"></div>';
document.querySelector(".cards").after(chartSection);

// Register with the tab bar so it only shows on the Home tab.
chartSection.style.display = tabButtons.home.className === "on" ? "" : "none";
TABS[0].parts.push(chartSection);

function monthsBack(month, n) {
  const out = [];
  let m = month;
  for (let i = 0; i < n; i++) { out.unshift(m); m = prevMonth(m); }
  return out;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderCharts() {
  const month = $("month").value;
  const body = document.getElementById("chartBody");
  body.innerHTML = "";
  if (!month) return;

  // ---- Chart 1: spending by category this month ----
  const cat = {};
  const perMonth = {};
  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!perMonth[m]) perMonth[m] = { income: 0, expense: 0 };
    perMonth[m][t.type] += t.amount;
    if (m === month && t.type === "expense") cat[t.category] = (cat[t.category] || 0) + t.amount;
  });

  const box1 = el("div", "chartBox");
  box1.appendChild(el("h3", "", "Where your money went"));
  let names = Object.keys(cat).sort((a, b) => cat[b] - cat[a]);
  if (!names.length) {
    box1.appendChild(el("p", "muted", "No spending recorded this month."));
  } else {
    let rows = names.slice(0, 5).map(n => [n, cat[n]]);
    if (names.length > 5) {
      rows.push(["Others", names.slice(5).reduce((s, n) => s + cat[n], 0)]);
    }
    const max = Math.max.apply(null, rows.map(r => r[1]));
    rows.forEach(r => {
      const row = el("div", "hRow");
      row.appendChild(el("span", "hName", r[0]));
      const track = el("div", "hTrack");
      const fill = el("div", "hFill");
      fill.style.width = (r[1] / max * 100) + "%";
      track.appendChild(fill);
      row.append(track, el("span", "", formatKobo(r[1])));
      box1.appendChild(row);
    });
  }
  body.appendChild(box1);

  // ---- Chart 2: income vs expenses, last 6 months ----
  const months = monthsBack(month, 6);
  const box2 = el("div", "chartBox");
  box2.appendChild(el("h3", "", "Last 6 months"));
  let top = 0;
  months.forEach(m => {
    const v = perMonth[m] || { income: 0, expense: 0 };
    top = Math.max(top, v.income, v.expense);
  });
  if (top === 0) {
    box2.appendChild(el("p", "muted", "No data for these months yet."));
  } else {
    const chart = el("div", "vChart");
    months.forEach(m => {
      const v = perMonth[m] || { income: 0, expense: 0 };
      const group = el("div", "vGroup");
      const bars = el("div", "vBars");
      const inc = el("div", "vBar");
      inc.style.height = (v.income / top * 100) + "%";
      inc.style.background = "var(--accent2)";
      inc.title = "Income " + formatKobo(v.income);
      const exp = el("div", "vBar");
      exp.style.height = (v.expense / top * 100) + "%";
      exp.style.background = "var(--danger)";
      exp.title = "Expenses " + formatKobo(v.expense);
      bars.append(inc, exp);
      group.append(bars, el("div", "vLbl", MONTH_NAMES[Number(m.slice(5, 7)) - 1]));
      chart.appendChild(group);
    });
    box2.appendChild(chart);
    const legend = el("div", "legend");
    const l1 = el("span", "");
    const d1 = el("span", "dot"); d1.style.background = "var(--accent2)";
    l1.append(d1, document.createTextNode("Income"));
    const l2 = el("span", "");
    const d2 = el("span", "dot"); d2.style.background = "var(--danger)";
    l2.append(d2, document.createTextNode("Expenses"));
    legend.append(l1, l2);
    box2.appendChild(legend);
  }
  body.appendChild(box2);
}

const renderBeforeCharts = render;
render = function () { renderBeforeCharts(); renderCharts(); };
$("month").addEventListener("change", renderCharts);

renderCharts();
