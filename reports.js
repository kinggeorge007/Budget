"use strict";
// SalaryPlan Stage 6: monthly reports and CSV export.

const rStyle = document.createElement("style");
rStyle.textContent =
  ".rBlock{margin-bottom:16px}" +
  ".rBlock h3{font-size:1rem;margin:12px 0 6px}" +
  ".rScroll{overflow-x:auto}" +
  ".rBlock table{width:100%;border-collapse:collapse;font-size:.9rem;background:var(--card);border:1px solid var(--line)}" +
  ".rBlock th,.rBlock td{padding:8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}" +
  ".rBlock th.num,.rBlock td.num{text-align:right}";
document.head.appendChild(rStyle);

const rSection = document.createElement("section");
rSection.innerHTML =
  '<h2>Monthly report</h2>' +
  '<p class="muted">Report for the month selected at the top of the page.</p>' +
  '<div id="rBody"></div>' +
  '<button type="button" id="rCsvTx" class="secondary">Download transactions (CSV)</button>' +
  '<button type="button" id="rCsvRep" class="secondary">Download report (CSV)</button>';
goalSection.after(rSection);

// ---- Calculations (money is whole kobo) ----
function buildSections(month) {
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const bills = Array.isArray(data.bills) ? data.bills : [];
  const plan = (data.budgets && data.budgets[month]) || {};
  const prev = prevMonth(month);
  const incCat = {}, expCat = {};
  let income = 0, expense = 0, pIncome = 0, pExpense = 0, lastIncome = 0, lastExpense = 0;

  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    const isIncome = t.type === "income";
    if (m === month) {
      if (isIncome) { income += t.amount; incCat[t.category] = (incCat[t.category] || 0) + t.amount; }
      else { expense += t.amount; expCat[t.category] = (expCat[t.category] || 0) + t.amount; }
    } else if (m < month) {
      if (isIncome) pIncome += t.amount; else pExpense += t.amount;
    }
    if (m === prev) { if (isIncome) lastIncome += t.amount; else lastExpense += t.amount; }
  });

  let saved = 0, pSaved = 0, lastSaved = 0;
  goals.forEach(g => g.contribs.forEach(c => {
    const m = c.date.slice(0, 7);
    if (m === month) saved += c.amount;
    else if (m < month) pSaved += c.amount;
    if (m === prev) lastSaved += c.amount;
  }));

  const opening = pIncome - pExpense - pSaved;
  const closing = opening + income - expense - saved;
  const byAmount = obj => Object.keys(obj).sort((a, b) => obj[b] - obj[a]);

  // 1. Statement
  const st = [["INCOME", ""]];
  byAmount(incCat).forEach(c => st.push([c, incCat[c]]));
  st.push(["Total income", income], ["EXPENSES", ""]);
  byAmount(expCat).forEach(c => st.push([c, expCat[c]]));
  st.push(
    ["Total expenses", expense],
    ["Net (income - expenses)", income - expense],
    ["Savings contributions", saved],
    ["Net after savings", income - expense - saved]
  );

  // 2. Cash balance
  const cash = [
    ["Opening balance", opening], ["Add: income", income], ["Less: expenses", expense],
    ["Less: savings contributions", saved], ["Closing balance", closing]
  ];

  // 3. Budget vs actual
  const cats = Object.keys(plan);
  Object.keys(expCat).forEach(c => { if (!cats.includes(c)) cats.push(c); });
  let totalPlan = 0;
  const bva = cats.map(c => {
    const p = plan[c] || 0;
    totalPlan += p;
    return [c, p, expCat[c] || 0, p - (expCat[c] || 0)];
  });
  if (bva.length) bva.push(["Total", totalPlan, expense, totalPlan - expense]);

  // 4. Category breakdown
  const brk = byAmount(expCat).map(c => [c, expCat[c], (expCat[c] / expense * 100).toFixed(1) + "%"]);

  // 5. Savings
  const sav = goals.map(g => {
    const total = g.contribs.reduce((s, c) => s + c.amount, 0);
    const inMonth = g.contribs.filter(c => c.date.startsWith(month)).reduce((s, c) => s + c.amount, 0);
    return [g.name, inMonth, total, g.target, Math.max(0, g.target - total)];
  });

  // 6. Unpaid bills
  const unpaid = bills.filter(b => b.active).filter(b => {
    const id = data.billPayments && data.billPayments[month] && data.billPayments[month][b.id];
    return !(id && data.transactions.some(t => t.id === id));
  }).map(b => [b.name, niceDate(dueDate(month, b.dueDay)), b.amount]);

  // 7. Month comparison
  const cmp = [
    ["Income", income, lastIncome, income - lastIncome],
    ["Expenses", expense, lastExpense, expense - lastExpense],
    ["Net (income - expenses)", income - expense, lastIncome - lastExpense, (income - expense) - (lastIncome - lastExpense)],
    ["Savings contributions", saved, lastSaved, saved - lastSaved]
  ];

  return [
    { title: "Income and expenditure statement", head: ["Item", "Amount"], rows: st },
    { title: "Cash balance", head: ["Item", "Amount"], rows: cash },
    { title: "Budget vs actual spending", head: ["Category", "Planned", "Actual", "Remaining"], rows: bva },
    { title: "Spending by category", head: ["Category", "Amount", "Share"], rows: brk },
    { title: "Savings", head: ["Goal", "Saved this month", "Total saved", "Target", "Remaining"], rows: sav },
    { title: "Unpaid bills", head: ["Bill", "Due", "Amount"], rows: unpaid },
    { title: "Compared with " + niceDate(prev + "-01").slice(3), head: ["Item", "This month", "Last month", "Change"], rows: cmp }
  ];
}

// ---- Render ----
function rBlock(sec) {
  const wrap = document.createElement("div");
  wrap.className = "rBlock";
  const h = document.createElement("h3");
  h.textContent = sec.title;
  wrap.appendChild(h);
  if (!sec.rows.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Nothing to show.";
    wrap.appendChild(p);
    return wrap;
  }
  const sc = document.createElement("div");
  sc.className = "rScroll";
  const t = document.createElement("table");
  const hr = document.createElement("tr");
  sec.head.forEach((x, i) => {
    const th = document.createElement("th");
    th.textContent = x;
    if (i > 0) th.className = "num";
    hr.appendChild(th);
  });
  t.appendChild(hr);
  sec.rows.forEach(r => {
    const tr = document.createElement("tr");
    r.forEach((c, i) => {
      const td = document.createElement("td");
      td.textContent = typeof c === "number" ? formatKobo(c) : c;
      if (i > 0) td.className = "num";
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  sc.appendChild(t);
  wrap.appendChild(sc);
  return wrap;
}

function renderReports() {
  const body = document.getElementById("rBody");
  body.innerHTML = "";
  const month = $("month").value;
  if (!month) return;
  buildSections(month).forEach(sec => body.appendChild(rBlock(sec)));
}

// ---- CSV ----
function csvCell(v) {
  if (typeof v === "number") return (v / 100).toFixed(2); // kobo to naira
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheet formula tricks
  return '"' + s.replace(/"/g, '""') + '"';
}

function downloadCsv(name, rows) {
  const text = "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.getElementById("rCsvTx").addEventListener("click", () => {
  const month = $("month").value;
  if (!month) return;
  const items = data.transactions.filter(t => t.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  const rows = [["Date", "Time", "Type", "Category", "Amount (NGN)", "Note"]];
  items.forEach(t => rows.push([t.date, t.time || "", t.type, t.category, t.amount, t.note || ""]));
  downloadCsv("salaryplan-transactions-" + month + ".csv", rows);
});

document.getElementById("rCsvRep").addEventListener("click", () => {
  const month = $("month").value;
  if (!month) return;
  const rows = [["SalaryPlan report", month], []];
  buildSections(month).forEach(sec => {
    rows.push([sec.title], sec.head);
    sec.rows.forEach(r => rows.push(r));
    rows.push([]);
  });
  downloadCsv("salaryplan-report-" + month + ".csv", rows);
});

// Re-draw reports whenever the app re-draws, and when the month changes.
const renderBeforeReports = render;
render = function () { renderBeforeReports(); renderReports(); };
$("month").addEventListener("change", renderReports);

renderReports();
