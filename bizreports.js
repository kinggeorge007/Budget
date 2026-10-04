"use strict";
// SalaryPlan business reports: profit and loss, cash flow, budget vs actual, receivables and payables,
// for a month, a financial quarter or a financial year. CSV, and Print / Save as PDF.
// Cash basis: income counts when received and expenses when paid.

let brMode = "month";

function fyStartMonth() { return (typeof wsEntry !== "undefined" && wsEntry && wsEntry.fyStart) || 1; }

function periodRange(month, mode) {
  if (mode === "month") return [month, month, monthLabel(month)];
  const f = fyStartMonth(), m = Number(month.slice(5, 7)), k = (m - f + 12) % 12;
  if (mode === "quarter") {
    const s = shiftMonth(month, -(k % 3)), e = shiftMonth(s, 2);
    return [s, e, "Financial quarter " + (Math.floor(k / 3) + 1) + ": " + monthLabel(s) + " to " + monthLabel(e)];
  }
  const s = shiftMonth(month, -k), e = shiftMonth(s, 11);
  return [s, e, "Financial year: " + monthLabel(s) + " to " + monthLabel(e)];
}
function monthsBetween(s, e) {
  const out = [];
  let m = s;
  while (m <= e && out.length < 24) { out.push(m); m = shiftMonth(m, 1); }
  return out;
}

function bizSections(s, e) {
  const inc = {}, exp = {};
  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (m < s || m > e) return;
    const o = t.type === "income" ? inc : exp;
    o[t.category] = (o[t.category] || 0) + t.amount;
  });
  const f = periodFlows(s, e);
  const by = o => Object.keys(o).sort((a, b) => o[b] - o[a]);
  const profit = f.income - f.expense;

  const pl = [["REVENUE", ""]];
  by(inc).forEach(c => pl.push([c, inc[c]]));
  pl.push(["Total revenue", f.income], ["EXPENSES", ""]);
  by(exp).forEach(c => pl.push([c, exp[c]]));
  pl.push(["Total expenses", f.expense], ["Net profit / (loss)", profit],
    ["Profit margin", f.income > 0 ? (profit / f.income * 100).toFixed(1) + "%" : "n/a"]);

  const net = profit + f.ownerIn - f.ownerOut + f.loanIn - f.loanOut - f.saved;
  const cf = [["Opening cash", f.opening], ["OPERATING", ""], ["Cash received from income", f.income], ["Less: cash paid for expenses", f.expense],
    ["Net operating cash flow", profit], ["FINANCING", ""], ["Owner contributions", f.ownerIn], ["Less: owner withdrawals", f.ownerOut],
    ["Loans received", f.loanIn], ["Less: loan repayments (principal)", f.loanOut], ["Savings set aside", f.saved],
    ["Net change in cash", net], ["Closing cash", f.closing]];
  const bal = acctBalances(e);
  const accts = bkAccts().map(a => [a.name, bal[a.id]]);

  const planned = {};
  monthsBetween(s, e).forEach(m => {
    const p = (data.budgets && data.budgets[m]) || {};
    Object.keys(p).forEach(c => { planned[c] = (planned[c] || 0) + p[c]; });
  });
  const cats = Array.from(new Set(Object.keys(planned).concat(Object.keys(exp))));
  let tp = 0;
  const bva = cats.map(c => { tp += planned[c] || 0; return [c, planned[c] || 0, exp[c] || 0, (planned[c] || 0) - (exp[c] || 0)]; });
  if (bva.length) bva.push(["Total", tp, f.expense, tp - f.expense]);

  const unpaid = k => bkDocs().filter(d => d.kind === k && !docPaid(d));
  const aged = list => {
    const b = { "Not yet due": 0, "1-30 days overdue": 0, "31-60 days overdue": 0, "Over 60 days overdue": 0 };
    list.forEach(d => {
      const od = -daysUntil(d.due);
      const k = od <= 0 ? "Not yet due" : od <= 30 ? "1-30 days overdue" : od <= 60 ? "31-60 days overdue" : "Over 60 days overdue";
      b[k] += d.amount;
    });
    const rows = Object.keys(b).map(k => [k, b[k]]);
    rows.push(["Total outstanding", list.reduce((x, d) => x + d.amount, 0)]);
    list.sort((a, b2) => a.due.localeCompare(b2.due)).forEach(d => rows.push([d.party + " (due " + niceDate(d.due) + ")", d.amount]));
    return rows;
  };

  return [
    { title: "Profit and loss", head: ["Item", "Amount"], rows: pl },
    { title: "Cash flow summary", head: ["Item", "Amount"], rows: cf },
    { title: "Cash by account at period end", head: ["Account", "Balance"], rows: accts },
    { title: "Budget vs actual expenses", head: ["Category", "Planned", "Actual", "Remaining"], rows: bva },
    { title: "Money customers owe you (as at today)", head: ["Item", "Amount"], rows: aged(unpaid("inv")) },
    { title: "Money you owe suppliers (as at today)", head: ["Item", "Amount"], rows: aged(unpaid("bill")) }
  ];
}

const brStyle = document.createElement("style");
brStyle.textContent = `
#printArea{display:none}
@media print{
  body > *:not(#printArea){display:none !important}
  #printArea{display:block !important;color:#000;background:#fff;padding:12px}
  #printArea h1,#printArea h2,#printArea h3,#printArea p{color:#000}
  #printArea h2::before{display:none}
  #printArea table{width:100%;border:1px solid #888;background:#fff !important}
  #printArea th,#printArea td{color:#000 !important;background:#fff !important;border-bottom:1px solid #ccc}
  #printArea .rScroll{border:0;box-shadow:none}
}
`;
document.head.appendChild(brStyle);

function bizReportsPage(body) {
  const month = $("month").value || today().slice(0, 7);
  const r = periodRange(month, brMode);
  const secs = bizSections(r[0], r[1]);

  const modes = mkEl("div", "pOpts");
  [["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]].forEach(o => {
    const b = mkEl("button", brMode === o[0] ? "on" : "", o[1]);
    b.type = "button";
    b.onclick = () => { brMode = o[0]; openPage("Business reports", bizReportsPage); };
    modes.appendChild(b);
  });
  const shift = n => () => {
    const step = brMode === "month" ? 1 : brMode === "quarter" ? 3 : 12;
    $("month").value = shiftMonth(month, n * step);
    $("month").dispatchEvent(new Event("change"));
    openPage("Business reports", bizReportsPage);
  };
  const nav = mkEl("div", "calNav");
  nav.append(cb("‹", "secondary", shift(-1)), mkEl("strong", "", monthLabel(month)), cb("›", "secondary", shift(1)));
  body.append(mkEl("h3", "", wsLabel()), modes, nav, mkEl("p", "muted", r[2]));
  secs.forEach(sec => body.appendChild(rBlock(sec)));

  const bar = mkEl("div", "nBar");
  bar.append(
    cb("Download CSV", "secondary", () => {
      const rows = [["Business report", wsLabel()], ["Period", r[2]], ["Basis", "Cash basis"], []];
      secs.forEach(sec => { rows.push([sec.title], sec.head); sec.rows.forEach(x => rows.push(x)); rows.push([]); });
      downloadCsv("salaryplan-" + wsLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) + "-" + brMode + "-" + r[0] + ".csv", rows);
    }),
    cb("Print / Save as PDF", "primary", () => {
      let pa = document.getElementById("printArea");
      if (!pa) { pa = document.createElement("div"); pa.id = "printArea"; document.body.appendChild(pa); }
      pa.innerHTML = "";
      pa.append(mkEl("h1", "", wsLabel()), mkEl("h2", "", "Business report"),
        mkEl("p", "", r[2] + " · Prepared " + niceDate(today()) + " · Cash basis"));
      secs.forEach(sec => pa.appendChild(rBlock(sec)));
      window.print();
    })
  );
  body.appendChild(bar);
  card(body, "How to read these reports", [
    "Cash basis: income counts when it is received and expenses when they are paid.",
    "Owner contributions and withdrawals, loans and transfers between accounts never count as income or expenses. They only appear in the cash flow.",
    "Customer invoices and supplier bills not yet paid are not in profit. They are listed under money owed to and by you.",
    "To save a PDF, tap Print / Save as PDF, then choose Save as PDF as the printer."
  ]);
}

// ---- Home tile and menu item (business only) ----
if (typeof wsEntry !== "undefined" && wsEntry) {
  const b = document.createElement("button");
  b.type = "button";
  const ic = mkEl("span", "ic");
  ic.innerHTML = svgIcon("reports");
  b.append(ic, mkEl("span", "", "P&L"));
  b.onclick = () => openPage("Business reports", bizReportsPage);
  qa.appendChild(b);
  const item = mkEl("button", "dItem");
  item.type = "button";
  const mi = mkEl("span", "ic");
  mi.innerHTML = svgIcon("reports");
  item.append(mi, mkEl("span", "", "Business reports"));
  item.onclick = () => openPage("Business reports", bizReportsPage);
  drawer.insertBefore(item, drawer.querySelectorAll(".dItem")[2] || drawer.querySelector(".dFoot"));
                                }
