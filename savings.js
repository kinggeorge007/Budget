"use strict";
// SalaryPlan Stage 4: savings goals.
// Contributions are NOT expenses. They move money from spendable cash into savings.

function cleanGoals(g) {
  if (!Array.isArray(g)) return [];
  return g.filter(x => x && typeof x.id === "string" && typeof x.name === "string" &&
      Number.isInteger(x.target) && x.target > 0 &&
      typeof x.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.deadline))
    .map(x => ({
      id: x.id, name: x.name.slice(0, 50), target: x.target, deadline: x.deadline,
      contribs: (Array.isArray(x.contribs) ? x.contribs : [])
        .filter(c => c && typeof c.id === "string" && Number.isInteger(c.amount) && c.amount > 0 &&
          typeof c.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
        .map(c => ({
          id: c.id, amount: c.amount, date: c.date,
          time: typeof c.time === "string" && /^\d{2}:\d{2}$/.test(c.time) ? c.time : "",
          note: typeof c.note === "string" ? c.note.slice(0, 100) : ""
        }))
    }));
}

function ensureGoals() { if (!Array.isArray(data.goals)) data.goals = []; }
function goalSaved(g) { return g.contribs.reduce((s, c) => s + c.amount, 0); }
function savedInMonth(month) {
  ensureGoals();
  let s = 0;
  data.goals.forEach(g => g.contribs.forEach(c => { if (c.date.startsWith(month)) s += c.amount; }));
  return s;
}
function goalDays(iso) {
  const a = iso.split("-").map(Number), b = today().split("-").map(Number);
  return Math.round((new Date(a[0], a[1] - 1, a[2]) - new Date(b[0], b[1] - 1, b[2])) / 86400000);
}

// ---- Section ----
const goalSection = document.createElement("section");
goalSection.innerHTML =
  '<h2>Savings goals</h2>' +
  '<p class="muted">Money you save is set aside from your spendable cash. It is not counted as spending.</p>' +
  '<div id="goalTotals" class="bTotals"></div>' +
  '<div id="goalList"></div>' +
  '<h2>New savings goal</h2>' +
  '<form id="goalForm">' +
  '<label>Goal name<input type="text" id="goalName" maxlength="50" required placeholder="e.g. Emergency fund"></label>' +
  '<label>Target amount (₦)<input type="number" id="goalTarget" inputmode="decimal" step="0.01" min="0.01" required></label>' +
  '<label>Deadline<input type="date" id="goalDeadline" required></label>' +
  '<button type="submit" class="primary">Create goal</button>' +
  '</form>' +
  '<h2>Add a contribution</h2>' +
  '<form id="contribForm">' +
  '<label>Goal<select id="contribGoal"></select></label>' +
  '<label>Amount (₦)<input type="number" id="contribAmount" inputmode="decimal" step="0.01" min="0.01" required></label>' +
  '<label>Date<input type="date" id="contribDate" required></label>' +
  '<label>Time<input type="time" id="contribTime"></label>' +
  '<label>Note (optional)<input type="text" id="contribNote" maxlength="100"></label>' +
  '<button type="submit" class="primary">Save contribution</button>' +
  '</form>';
billSection.after(goalSection);

$("contribDate").value = today();
$("contribTime").value = nowTime();

// ---- Dashboard balance: income - expenses - savings contributions ----
function adjustBalance() {
  const month = $("month").value;
  if (!month) return;
  let income = 0, expense = 0;
  data.transactions.forEach(t => {
    if (!t.date.startsWith(month)) return;
    if (t.type === "income") income += t.amount; else expense += t.amount;
  });
  $("sumBalance").textContent = formatKobo(income - expense - savedInMonth(month));
  $("sumBalance").previousElementSibling.textContent = "Cash balance this month (after savings)";
}

function gBtn(text, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (cls) b.className = cls;
  b.onclick = fn;
  return b;
}

// ---- Render ----
function renderSavings() {
  ensureGoals();
  const month = $("month").value;
  const list = document.getElementById("goalList");
  const totals = document.getElementById("goalTotals");
  const sel = $("contribGoal");
  const keep = sel.value;
  list.innerHTML = ""; totals.innerHTML = ""; sel.innerHTML = "";

  let allSaved = 0;
  data.goals.forEach(g => { allSaved += goalSaved(g); });
  totals.append(
    bLine("Saved this month", month ? formatKobo(savedInMonth(month)) : formatKobo(0)),
    bLine("Total saved (all goals)", formatKobo(allSaved))
  );

  if (!data.goals.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No savings goals yet. Create your first one below.";
    list.appendChild(p);
  }

  data.goals.forEach(g => {
    const o = document.createElement("option");
    o.value = g.id; o.textContent = g.name;
    sel.appendChild(o);

    const saved = goalSaved(g);
    const remaining = Math.max(0, g.target - saved);
    const days = goalDays(g.deadline);
    const row = document.createElement("div");
    const top = document.createElement("div");
    top.className = "bTop";
    const name = document.createElement("strong");
    name.textContent = g.name;
    const tgt = document.createElement("span");
    tgt.textContent = "Target " + formatKobo(g.target);
    top.append(name, tgt);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.style.width = Math.min(100, saved / g.target * 100) + "%";
    bar.appendChild(fill);

    const info = document.createElement("div");
    info.className = "bInfo";
    let cls = "";
    let text = "Saved " + formatKobo(saved) + " · Remaining " + formatKobo(remaining) +
      " · Deadline " + niceDate(g.deadline);
    if (remaining === 0) {
      cls = "ok"; text += " · Goal reached";
    } else if (days < 0) {
      cls = "over"; text += " · Deadline passed";
    } else {
      const months = Math.max(1, Math.ceil(days / 30));
      text += " · " + days + (days === 1 ? " day" : " days") + " left · Save about " +
        formatKobo(Math.ceil(remaining / months)) + " per month";
    }
    info.textContent = text;
    row.className = "bRow " + cls;

    const hist = document.createElement("details");
    const sum = document.createElement("summary");
    sum.textContent = "Contributions (" + g.contribs.length + ")";
    hist.appendChild(sum);
    g.contribs.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""))
      .forEach(c => {
        const line = document.createElement("div");
        line.className = "bTop";
        const lbl = document.createElement("span");
        lbl.className = "bInfo";
        lbl.textContent = niceDate(c.date) + (c.time ? " " + niceTime(c.time) : "") +
          (c.note ? " · " + c.note : "") + " · " + formatKobo(c.amount);
        line.append(lbl, gBtn("Delete", "del", () => {
          if (confirm("Delete this contribution?")) {
            g.contribs = g.contribs.filter(x => x.id !== c.id);
            saveData(); render();
          }
        }));
        hist.appendChild(line);
      });

    const btns = document.createElement("div");
    btns.className = "bBtns";
    btns.appendChild(gBtn("Delete goal", "warn", () => {
      if (confirm("Delete this goal and all its contributions? The money will return to your spendable cash balance.")) {
        data.goals = data.goals.filter(x => x.id !== g.id);
        saveData(); render();
      }
    }));
    row.append(top, bar, info, hist, btns);
    list.appendChild(row);
  });

  if (keep && data.goals.some(g => g.id === keep)) sel.value = keep;
  adjustBalance();
}

// ---- Events ----
document.getElementById("goalForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("goalName").value.trim();
  const target = toKobo($("goalTarget").value);
  if (!name) { alert("Please enter a goal name."); return; }
  if (!target) { alert("Please enter a target amount greater than zero."); return; }
  ensureGoals();
  data.goals.push({ id: newId(), name: name, target: target, deadline: $("goalDeadline").value, contribs: [] });
  saveData();
  $("goalName").value = ""; $("goalTarget").value = ""; $("goalDeadline").value = "";
  renderSavings();
});

document.getElementById("contribForm").addEventListener("submit", e => {
  e.preventDefault();
  ensureGoals();
  const goal = data.goals.find(g => g.id === $("contribGoal").value);
  if (!goal) { alert("Please create a savings goal first."); return; }
  const amount = toKobo($("contribAmount").value);
  if (!amount) { alert("Please enter an amount greater than zero."); return; }
  goal.contribs.push({
    id: newId(), amount: amount, date: $("contribDate").value,
    time: $("contribTime").value, note: $("contribNote").value.trim()
  });
  saveData();
  $("contribAmount").value = ""; $("contribNote").value = "";
  $("contribTime").value = nowTime();
  renderSavings();
});

// Re-draw savings whenever the app re-draws, and when the month changes.
const renderBeforeSavings = render;
render = function () { renderBeforeSavings(); renderSavings(); };
$("month").addEventListener("change", renderSavings);

renderSavings();
