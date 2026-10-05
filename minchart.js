"use strict";
// Budget: thin smooth line chart (income, expenses, savings) and spending by category on Home.

const MC_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MC_PAL = ["--accent-orange", "--accent-red", "--accent-green", "--accent-teal", "--accent-indigo"];

const mcSection = document.createElement("section");
mcSection.innerHTML = '<div id="mcBody"></div>';
document.querySelector(".cards").after(mcSection);
mcSection.style.display = tabButtons.home.className === "on" ? "" : "none";
TABS[0].parts.push(mcSection);

// Smooth curve through the points, kept inside the chart area.
function mcSmooth(pts, lo, hi) {
  const c = v => Math.min(hi, Math.max(lo, v));
  const f = v => Math.round(v * 10) / 10;
  let d = "M" + f(pts[0][0]) + "," + f(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = c(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = c(p2[1] - (p3[1] - p1[1]) / 6);
    d += " C" + f(c1x) + "," + f(c1y) + " " + f(c2x) + "," + f(c2y) + " " + f(p2[0]) + "," + f(p2[1]);
  }
  return d;
}

function mcRows(month) {
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i));
  const rows = months.map(m => ({ m: m, income: 0, expense: 0, saved: 0 }));
  const idx = {};
  rows.forEach((r, i) => { idx[r.m] = i; });
  data.transactions.forEach(t => {
    const i = idx[t.date.slice(0, 7)];
    if (i === undefined) return;
    if (t.type === "income") rows[i].income += t.amount; else rows[i].expense += t.amount;
  });
  (data.goals || []).forEach(g => g.contribs.forEach(c => {
    const i = idx[c.date.slice(0, 7)];
    if (i !== undefined) rows[i].saved += c.amount;
  }));
  return rows;
}

function renderMinChart() {
  const month = $("month").value;
  const body = document.getElementById("mcBody");
  body.innerHTML = "";
  if (!month) return;

  const rows = mcRows(month);
  const X0 = 26, X1 = 314, Y0 = 12, Y1 = 112;
  const top = Math.max(1, Math.max.apply(null, rows.map(r => Math.max(r.income, r.expense, r.saved))));
  const has = rows.some(r => r.income || r.expense || r.saved);
  const xs = rows.map((r, i) => X0 + i * (X1 - X0) / 5);
  const y = v => Y1 - (v / top) * (Y1 - Y0);
  const series = [["income", "--accent-green"], ["expense", "--accent-red"], ["saved", "--accent-teal"]];

  let svg = '<svg class="mcSvg" viewBox="0 0 340 150" role="img" aria-label="Income, expenses and savings over the last six months">';
  [Y0, (Y0 + Y1) / 2, Y1].forEach(g => {
    svg += '<line x1="0" x2="340" y1="' + g + '" y2="' + g + '" style="stroke:var(--border)" stroke-width="1"/>';
  });
  if (has) {
    series.forEach(s => {
      const pts = rows.map((r, i) => [xs[i], y(r[s[0]])]);
      svg += '<path d="' + mcSmooth(pts, Y0, Y1) + '" fill="none" style="stroke:var(' + s[1] + ')" stroke-width="1.5" stroke-linecap="round"/>';
      svg += '<circle cx="' + pts[5][0] + '" cy="' + pts[5][1] + '" r="3.5" fill="#fff" style="stroke:var(' + s[1] + ')" stroke-width="1.5"/>';
    });
  }
  rows.forEach((r, i) => {
    const sel = i === 5;
    svg += '<rect x="' + (xs[i] - 24) + '" y="0" width="48" height="150" fill="transparent" data-m="' + r.m + '"/>';
    svg += '<text x="' + xs[i] + '" y="136" text-anchor="middle" font-size="10" data-m="' + r.m + '" style="fill:' +
      (sel ? "var(--text)" : "var(--text-secondary)") + '"' + (sel ? ' font-weight="500"' : "") + '>' +
      MC_NAMES[Number(r.m.slice(5, 7)) - 1] + '</text>';
  });
  svg += '</svg>';

  const holder = document.createElement("div");
  holder.innerHTML = svg;
  holder.addEventListener("click", e => {
    const m = e.target.getAttribute && e.target.getAttribute("data-m");
    if (m) { $("month").value = m; $("month").dispatchEvent(new Event("change")); }
  });
  body.appendChild(mkEl("h2", "", "Last 6 months"));
  body.appendChild(holder);

  const legend = mkEl("div", "mcLegend");
  [["income", "--accent-green"], ["expenses", "--accent-red"], ["savings", "--accent-teal"]].forEach(l => {
    const s = mkEl("span");
    const dot = document.createElement("i");
    dot.style.background = "var(" + l[1] + ")";
    s.append(dot, document.createTextNode(l[0]));
    legend.appendChild(s);
  });
  body.appendChild(legend);
  if (!has) body.appendChild(mkEl("p", "muted", "Nothing to chart yet. Tap + to add a transaction."));

  // Spending by category for the selected month
  const cat = {};
  data.transactions.forEach(t => {
    if (t.type === "expense" && t.date.startsWith(month)) cat[t.category] = (cat[t.category] || 0) + t.amount;
  });
  const names = Object.keys(cat).sort((a, b) => cat[b] - cat[a]);
  if (!names.length) return;
  const list = names.slice(0, 5).map(n => [n, cat[n]]);
  if (names.length > 5) list.push(["Others", names.slice(5).reduce((s, n) => s + cat[n], 0)]);
  const total = list.reduce((s, r) => s + r[1], 0);
  body.appendChild(mkEl("h2", "", "Spending by category"));
  list.forEach((r, i) => {
    const row = mkEl("div", "mcRow");
    row.append(mkEl("span", "", r[0]), mkEl("span", "", formatKobo(r[1])));
    const bar = mkEl("div", "mcBar");
    const fill = document.createElement("i");
    fill.style.width = (r[1] / total * 100) + "%";
    fill.style.background = r[0] === "Others" ? "#B8B8B8" : "var(" + MC_PAL[i % 5] + ")";
    bar.appendChild(fill);
    body.append(row, bar);
  });
}

const renderBeforeMinChart = render;
render = function () { renderBeforeMinChart(); renderMinChart(); };
$("month").addEventListener("change", renderMinChart);
renderMinChart();
