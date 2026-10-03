"use strict";
// SalaryPlan Stage 8: dashboard balance carries over from earlier months.
// Closing = opening + income - expenses - savings contributions.

const balNote = document.createElement("span");
balNote.className = "muted";
balNote.id = "openNote";
$("sumBalance").parentElement.appendChild(balNote);

function showBalance() {
  const month = $("month").value;
  if (!month) return;
  let income = 0, expense = 0, saved = 0, pIncome = 0, pExpense = 0, pSaved = 0;

  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (m === month) {
      if (t.type === "income") income += t.amount; else expense += t.amount;
    } else if (m < month) {
      if (t.type === "income") pIncome += t.amount; else pExpense += t.amount;
    }
  });

  const goals = Array.isArray(data.goals) ? data.goals : [];
  goals.forEach(g => g.contribs.forEach(c => {
    const m = c.date.slice(0, 7);
    if (m === month) saved += c.amount;
    else if (m < month) pSaved += c.amount;
  }));

  const opening = pIncome - pExpense - pSaved;
  $("sumBalance").textContent = formatKobo(opening + income - expense - saved);
  $("sumBalance").previousElementSibling.textContent = "Cash balance (after savings)";
  balNote.textContent = "Opening balance: " + formatKobo(opening);
}

const renderBeforeBalance = render;
render = function () { renderBeforeBalance(); showBalance(); };
$("month").addEventListener("change", showBalance);

showBalance();
