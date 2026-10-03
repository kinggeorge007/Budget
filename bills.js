"use strict";
// SalaryPlan Stage 3: recurring bills.
// Bills are monthly templates. A bill only becomes an actual expense when marked paid.

function cleanBills(b) {
  if (!Array.isArray(b)) return [];
  return b.filter(x => x && typeof x.id === "string" && typeof x.name === "string" &&
      Number.isInteger(x.amount) && x.amount > 0 &&
      Number.isInteger(x.dueDay) && x.dueDay >= 1 && x.dueDay <= 31)
    .map(x => ({
      id: x.id, name: x.name.slice(0, 50), amount: x.amount, dueDay: x.dueDay,
      category: typeof x.category === "string" ? x.category.slice(0, 50) : "Other",
      note: typeof x.note === "string" ? x.note.slice(0, 100) : "",
      active: x.active !== false
    }));
}

function cleanPayments(p) {
  const out = {};
  if (!p || typeof p !== "object") return out;
  Object.keys(p).forEach(m => {
    if (!/^\d{4}-\d{2}$/.test(m) || !p[m] || typeof p[m] !== "object") return;
    out[m] = {};
    Object.keys(p[m]).forEach(id => { if (typeof p[m][id] === "string") out[m][id] = p[m][id]; });
  });
  return out;
}

function ensureBills() {
  if (!Array.isArray(data.bills)) data.bills = [];
  if (!data.billPayments) data.billPayments = {};
}

function dueDate(month, day) {
  const p = month.split("-").map(Number);
  const last = new Date(p[0], p[1], 0).getDate();
  return month + "-" + String(Math.min(day, last)).padStart(2, "0");
}

function daysUntil(iso) {
  const a = iso.split("-").map(Number), b = today().split("-").map(Number);
  return Math.round((new Date(a[0], a[1] - 1, a[2]) - new Date(b[0], b[1] - 1, b[2])) / 86400000);
}

// A bill is paid only if its payment record AND the linked expense both still exist.
function paidTxId(month, billId) {
  const id = data.billPayments[month] && data.billPayments[month][billId];
  return id && data.transactions.some(t => t.id === id) ? id : null;
}

// ---- Styles and section ----
const billStyle = document.createElement("style");
billStyle.textContent =
  ".bBtns{display:flex;gap:8px;flex-wrap:wrap}" +
  ".bBtns button{min-height:44px;flex:1;background:var(--card);color:var(--text);border:1px solid var(--line)}" +
  ".bBtns .warn{color:var(--danger)}";
document.head.appendChild(billStyle);

const billSection = document.createElement("section");
billSection.innerHTML =
  '<h2>Recurring bills</h2>' +
  '<p class="muted">Bills repeat every month. A bill only counts as spending after you mark it paid.</p>' +
  '<div id="billTotals" class="bTotals"></div>' +
  '<div id="billList"></div>' +
  '<h2 id="billFormTitle">Add a recurring bill</h2>' +
  '<form id="billForm">' +
  '<label>Bill name<input type="text" id="billName" maxlength="50" required placeholder="e.g. Electricity"></label>' +
  '<label>Amount (₦)<input type="number" id="billAmount" inputmode="decimal" step="0.01" min="0.01" required></label>' +
  '<label>Due day of month (1-31)<input type="number" id="billDay" inputmode="numeric" min="1" max="31" step="1" required></label>' +
  '<label>Category<select id="billCat"></select></label>' +
  '<label>Note (optional)<input type="text" id="billNote" maxlength="100"></label>' +
  '<button type="submit" class="primary" id="billSave">Save bill</button>' +
  '<button type="button" class="secondary" id="billCancel" style="display:none">Cancel edit</button>' +
  '</form>' +
  '<h2>Manage bills</h2><div id="billManage"></div>';
bSection.after(billSection);

CATEGORIES.expense.forEach(c => {
  const o = document.createElement("option");
  o.value = c; o.textContent = c;
  document.getElementById("billCat").appendChild(o);
});

let editingBillId = null;

function resetBillForm() {
  editingBillId = null;
  document.getElementById("billForm").reset();
  document.getElementById("billFormTitle").textContent = "Add a recurring bill";
  document.getElementById("billSave").textContent = "Save bill";
  document.getElementById("billCancel").style.display = "none";
}

function mkBtn(text, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (cls) b.className = cls;
  b.onclick = fn;
  return b;
}

function renderBills() {
  const month = $("month").value;
  const list = document.getElementById("billList");
  const totalsBox = document.getElementById("billTotals");
  const manage = document.getElementById("billManage");
  list.innerHTML = ""; totalsBox.innerHTML = ""; manage.innerHTML = "";
  ensureBills();

  // Manage list: every bill, including paused ones
  if (!data.bills.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No recurring bills yet. Add your first one using the form above.";
    manage.appendChild(p);
  }
  data.bills.forEach(b => {
    const row = document.createElement("div");
    row.className = "bRow";
    const top = document.createElement("div");
    top.className = "bTop";
    const name = document.createElement("strong");
    name.textContent = b.name + (b.active ? "" : " (paused)");
    const amt = document.createElement("span");
    amt.textContent = formatKobo(b.amount);
    top.append(name, amt);
    const info = document.createElement("div");
    info.className = "bInfo";
    info.textContent = b.category + " · due day " + b.dueDay + (b.note ? " · " + b.note : "");
    const btns = document.createElement("div");
    btns.className = "bBtns";
    btns.append(
      mkBtn("Edit", "", () => {
        editingBillId = b.id;
        document.getElementById("billName").value = b.name;
        document.getElementById("billAmount").value = (b.amount / 100).toFixed(2);
        document.getElementById("billDay").value = b.dueDay;
        document.getElementById("billCat").value = b.category;
        document.getElementById("billNote").value = b.note;
        document.getElementById("billFormTitle").textContent = "Edit bill";
        document.getElementById("billSave").textContent = "Update bill";
        document.getElementById("billCancel").style.display = "inline-flex";
        document.getElementById("billName").scrollIntoView();
      }),
      mkBtn(b.active ? "Pause" : "Resume", "", () => {
        b.active = !b.active;
        saveData(); renderBills();
      }),
      mkBtn("Delete", "warn", () => {
        if (confirm("Delete this bill? Payments you already recorded stay in your transactions.")) {
          data.bills = data.bills.filter(x => x.id !== b.id);
          saveData(); renderBills();
        }
      })
    );
    row.append(top, info, btns);
    manage.appendChild(row);
  });

  if (!month) return;

  // This month's bills (active only)
  const active = data.bills.filter(b => b.active)
    .sort((a, b) => dueDate(month, a.dueDay).localeCompare(dueDate(month, b.dueDay)));
  let paidTotal = 0, unpaidTotal = 0;

  if (!active.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No active bills for this month.";
    list.appendChild(p);
  }

  active.forEach(b => {
    const due = dueDate(month, b.dueDay);
    const txId = paidTxId(month, b.id);
    const row = document.createElement("div");
    const top = document.createElement("div");
    top.className = "bTop";
    const name = document.createElement("strong");
    name.textContent = b.name;
    const amt = document.createElement("span");
    const info = document.createElement("div");
    info.className = "bInfo";
    const btns = document.createElement("div");
    btns.className = "bBtns";
    const niceDue = niceDate(due);

    if (txId) {
      const tx = data.transactions.find(t => t.id === txId);
      paidTotal += tx.amount;
      amt.textContent = formatKobo(tx.amount);
      row.className = "bRow ok";
      info.textContent = "Due " + niceDue + " · Paid";
      btns.appendChild(mkBtn("Mark unpaid", "", () => {
        if (!confirm("Mark as unpaid? This also removes the expense recorded for this payment.")) return;
        data.transactions = data.transactions.filter(t => t.id !== txId);
        delete data.billPayments[month][b.id];
        saveData(); render();
      }));
    } else {
      unpaidTotal += b.amount;
      amt.textContent = formatKobo(b.amount);
      const d = daysUntil(due);
      if (d < 0) { row.className = "bRow over"; info.textContent = "Due " + niceDue + " · Overdue by " + (-d) + (d === -1 ? " day" : " days"); }
      else if (d === 0) { row.className = "bRow near"; info.textContent = "Due " + niceDue + " · Due today"; }
      else if (d <= 3) { row.className = "bRow near"; info.textContent = "Due " + niceDue + " · Due in " + d + (d === 1 ? " day" : " days"); }
      else { row.className = "bRow"; info.textContent = "Due " + niceDue; }
      btns.appendChild(mkBtn("Mark paid", "", () => {
        const tx = {
          id: newId(), type: "expense", amount: b.amount,
          date: today().startsWith(month) ? today() : due,
          category: b.category, note: b.name + " (bill)"
        };
        data.transactions.push(tx);
        if (!data.billPayments[month]) data.billPayments[month] = {};
        data.billPayments[month][b.id] = tx.id;
        saveData(); render();
      }));
    }
    top.append(name, amt);
    row.append(top, info, btns);
    list.appendChild(row);
  });

  totalsBox.append(
    bLine("Paid", formatKobo(paidTotal)),
    bLine("Still to pay", formatKobo(unpaidTotal), unpaidTotal > 0 ? "expense" : "income"),
    bLine("Total bills this month", formatKobo(paidTotal + unpaidTotal))
  );
}

// ---- Events ----
document.getElementById("billForm").addEventListener("submit", e => {
  e.preventDefault();
  const amount = toKobo($("billAmount").value);
  const day = parseInt($("billDay").value, 10);
  const name = $("billName").value.trim();
  if (!name) { alert("Please enter a bill name."); return; }
  if (!amount) { alert("Please enter an amount greater than zero."); return; }
  if (!(day >= 1 && day <= 31)) { alert("Due day must be between 1 and 31."); return; }
  ensureBills();
  const fields = { name: name, amount: amount, dueDay: day, category: $("billCat").value, note: $("billNote").value.trim() };
  if (editingBillId) {
    const b = data.bills.find(x => x.id === editingBillId);
    if (b) Object.assign(b, fields);
  } else {
    data.bills.push(Object.assign({ id: newId(), active: true }, fields));
  }
  saveData(); resetBillForm(); renderBills();
});

document.getElementById("billCancel").addEventListener("click", resetBillForm);

// Re-draw bills whenever the app re-draws, and when the month changes.
const baseRender = render;
render = function () { baseRender(); renderBills(); };
$("month").addEventListener("change", renderBills);

renderBills();
