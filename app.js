"use strict";

const KEY = "salaryplan_data_v1";
const CATEGORIES = {
  expense: ["Rent", "Food", "Transport", "Electricity", "Internet", "School fees", "Family support", "Subscriptions", "Other"],
  income: ["Salary", "Bonus", "Business income", "Other"]
};

// ---- Storage (kept in one place so we can upgrade it later) ----
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
// Money is stored as whole kobo (integers) to avoid rounding errors.
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
function formatKobo(k) { return naira.format(k / 100); }
function today() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function niceDate(iso) { const p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

const $ = id => document.getElementById(id);
$("month").value = today().slice(0, 7);
$("date").value = today();

function fillCategories() {
  const sel = $("category");
  sel.innerHTML = "";
  CATEGORIES[$("type").value].forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

// ---- Render ----
function render() {
  const month = $("month").value;
  const items = data.transactions
    .filter(t => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  let income = 0, expense = 0;
  items.forEach(t => { if (t.type === "income") income += t.amount; else expense += t.amount; });
  $("sumIncome").textContent = formatKobo(income);
  $("sumExpense").textContent = formatKobo(expense);
  $("sumBalance").textContent = formatKobo(income - expense);

  const list = $("list");
  list.innerHTML = "";
  items.forEach(t => {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = t.category;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = niceDate(t.date) + (t.note ? " · " + t.note : "");
    info.append(title, meta);

    const amt = document.createElement("span");
    amt.className = "amt " + t.type;
    amt.textContent = (t.type === "income" ? "+" : "-") + formatKobo(t.amount);

    const del = document.createElement("button");
    del.className = "del"; del.type = "button";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + t.category + " transaction");
    del.onclick = () => {
      if (confirm("Delete this transaction?")) {
        data.transactions = data.transactions.filter(x => x.id !== t.id);
        saveData(); render();
      }
    };
    li.append(info, amt, del);
    list.appendChild(li);
  });
  $("empty").style.display = items.length ? "none" : "block";
  if (typeof renderBudget === "function") renderBudget(); // CHANGED (new line)
}

// ---- Events ----
$("type").addEventListener("change", fillCategories);
$("month").addEventListener("change", render);

$("txForm").addEventListener("submit", e => {
  e.preventDefault();
  const kobo = Math.round(Number($("amount").value) * 100);
  if (!Number.isFinite(kobo) || kobo <= 0) { alert("Please enter an amount greater than zero."); return; }
  data.transactions.push({
    id: newId(),
    type: $("type").value,
    amount: kobo,
    date: $("date").value,
    category: $("category").value,
    note: $("note").value.trim()
  });
  saveData();
  $("amount").value = ""; $("note").value = "";
  $("month").value = $("date").value.slice(0, 7);
  render();
});

// ---- Backup ----
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "salaryplan-backup-" + today() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
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
        id: t.id, type: t.type, amount: t.amount, date: t.date,
        category: t.category.slice(0, 50), note: typeof t.note === "string" ? t.note.slice(0, 100) : ""
      }));
      if (!confirm("This will REPLACE your current data with " + good.length + " transactions from the backup. Continue?")) return;
      datadata = { version: 1, transactions: good, budgets: cleanBudgets(d.budgets), bills: cleanBills(d.bills), billPayments: cleanPayments(d.billPayments) };
      saveData(); render();
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
