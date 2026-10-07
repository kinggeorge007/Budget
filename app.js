"use strict";

const KEY = (window.SP_PATCHED = true, localStorage.getItem("sp_data_key") || "salaryplan_data_v1");
const CATEGORIES = {
  expense: ["Rent", "Food", "Transport", "Electricity", "Internet", "School fees", "Family support", "Subscriptions", "Other"],
  income: ["Salary", "Bonus", "Business income", "Other"]
};

// ---- Storage ----
function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.transactions)) return d;
    }
  } catch (e) {}
  return { version: 1, transactions: [] };
}
function saveData() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    alert("Could not save your data. Your phone storage may be full.");
  }
}
let data = loadData();

// ---- Helpers ----
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
function formatKobo(k) {
  return naira.format(k / 100);
}
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}
function today() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function nowTime() {
  const d = new Date();
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}
function niceDate(iso) {
  const p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function niceTime(t) {
  const p = t.split(":");
  let h = Number(p[0]);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return pad2(h) + ":" + p[1] + " " + suffix;
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const $ = id => document.getElementById(id);
$("month").value = today().slice(0, 7);
$("date").value = today();
$("time").value = nowTime();

function fillCategories() {
  const sel = $("category");
  sel.innerHTML = "";
  CATEGORIES[$("type").value].forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  });
}

// ---- Transaction row: used by the Home list and the Income / Expenses history pages ----
// [icon]  Name                    +/-Amount
//         Category • date • time
const TX_ICON = {
  income: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="7 8 7 17 16 17"/></svg>',
  expense: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/></svg>'
};
function txRow(t, tag) {
  const row = document.createElement(tag || "li");
  row.className = "txRow " + (t.type === "income" ? "in" : "out");
  row.setAttribute("role", "button");
  row.tabIndex = 0;

  const ic = document.createElement("span");
  ic.className = "txIc";
  ic.innerHTML = TX_ICON[t.type === "income" ? "income" : "expense"];

  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("strong");
  name.className = "txName";
  name.textContent = t.note || t.category;
  const meta = document.createElement("span");
  meta.className = "meta";
  const bits = [];
  if (t.note) bits.push(t.category);
  bits.push(niceDate(t.date));
  if (t.time) bits.push(niceTime(t.time));
  meta.textContent = bits.join(" \u2022 ");
  info.append(name, meta);

  const amt = document.createElement("span");
  amt.className = "amt " + t.type;
  amt.textContent = (t.type === "income" ? "+" : "-") + formatKobo(t.amount);

  row.append(ic, info, amt);
  row.setAttribute("aria-label", (t.note || t.category) + ", " + amt.textContent);
  const open = () => { if (typeof openTxMenu === "function") openTxMenu(t); };
  row.addEventListener("click", open);
  row.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  return row;
}

async function deleteTx(t) {
  const ok = await showConfirmDialog({
    title: "Delete this transaction?",
    message: (t.note || t.category) + " \u2022 " + formatKobo(t.amount),
    confirmLabel: "Delete",
    danger: true
  });
  if (!ok) return;
  data.transactions = data.transactions.filter(x => x.id !== t.id);
  saveData();
  render();
  showToast("Transaction deleted");
}

// ---- Render ----
function render() {
  const month = $("month").value;
  const items = data.transactions
    .filter(t => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));

  let income = 0, expense = 0;
  items.forEach(t => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });
  $("sumIncome").textContent = formatKobo(income);
  $("sumExpense").textContent = formatKobo(expense);
  $("sumBalance").textContent = formatKobo(income - expense);

  const list = $("list");
  list.innerHTML = "";
  items.forEach(t => list.appendChild(txRow(t, "li")));
  $("empty").style.display = items.length ? "none" : "block";
  if (typeof renderBudget === "function") renderBudget();
}

// ---- Events ----
$("type").addEventListener("change", fillCategories);
$("month").addEventListener("change", render);

$("txForm").addEventListener("submit", e => {
  e.preventDefault();
  const kobo = Math.round(Number($("amount").value) * 100);
  if (!Number.isFinite(kobo) || kobo <= 0) {
    alert("Please enter an amount greater than zero.");
    return;
  }
  data.transactions.push({
    id: newId(),
    type: $("type").value,
    amount: kobo,
    date: $("date").value,
    time: $("time").value,
    category: $("category").value,
    note: $("note").value.trim()
  });
  saveData();
  $("amount").value = "";
  $("note").value = "";
  $("time").value = nowTime();
  $("month").value = $("date").value.slice(0, 7);
  render();
});

// ---- Backup ----
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "salaryplan-backup-" + today() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

function validTx(t) {
  return t && (t.type === "income" || t.type === "expense") &&
    Number.isInteger(t.amount) && t.amount > 0 &&
    typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    typeof t.category === "string" && typeof t.id === "string";
}

$("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || !Array.isArray(d.transactions)) throw new Error("bad file");
      const good = d.transactions.filter(validTx).map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        time: typeof t.time === "string" && /^\d{2}:\d{2}$/.test(t.time) ? t.time : "",
        category: t.category.slice(0, 50),
        note: typeof t.note === "string" ? t.note.slice(0, 100) : ""
      }));
      if (!confirm("This will REPLACE your current data with " + good.length + " transactions from the backup. Continue?")) return;
      const extras = {};
      if (typeof cleanBudgets === "function") extras.budgets = cleanBudgets(d.budgets);
      if (typeof cleanBills === "function") {
        extras.bills = cleanBills(d.bills);
        extras.billPayments = cleanPayments(d.billPayments);
      }
      if (typeof cleanGoals === "function") extras.goals = cleanGoals(d.goals);
      data = Object.assign({ version: 1, transactions: good }, extras);
      saveData();
      render();
      alert("Backup imported.");
    } catch (err) {
      alert("That file is not a valid SalaryPlan backup.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

fillCategories();
render();
