"use strict";
// SalaryPlan: monthly budgets (planned amounts) with optional itemised lines per category.
// Planned amounts live in data.budgets and are kept separate from transactions.
// Items live in data.budgets._items[month][category] = [{ id, name, amount }].

const openCats = new Set();

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
  if (b._items && typeof b._items === "object") {
    out._items = {};
    Object.keys(b._items).forEach(m => {
      const mi = b._items[m];
      if (!/^\d{4}-\d{2}$/.test(m) || !mi || typeof mi !== "object") return;
      out._items[m] = {};
      Object.keys(mi).forEach(c => {
        if (!Array.isArray(mi[c])) return;
        const clean = mi[c]
          .filter(x => x && typeof x.id === "string" && typeof x.name === "string" &&
            Number.isInteger(x.amount) && x.amount > 0)
          .map(x => ({ id: x.id, name: x.name.slice(0, 50), amount: x.amount }));
        if (clean.length) out._items[m][c.slice(0, 50)] = clean;
      });
    });
  }
  return out;
}

function prevMonth(m) {
  const p = m.split("-").map(Number);
  const d = new Date(p[0], p[1] - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function itemsFor(month, cat) {
  const it = data.budgets && data.budgets._items;
  return (it && it[month] && it[month][cat]) || [];
}

// Save a category's items. The category's planned amount becomes the total of its items.
function setItems(month, cat, arr) {
  if (!data.budgets) data.budgets = {};
  if (!data.budgets._items) data.budgets._items = {};
  if (!data.budgets._items[month]) data.budgets._items[month] = {};
  if (!data.budgets[month]) data.budgets[month] = {};
  if (arr.length) {
    data.budgets._items[month][cat] = arr;
    data.budgets[month][cat] = arr.reduce((s, x) => s + x.amount, 0);
  } else {
    delete data.budgets._items[month][cat];
    delete data.budgets[month][cat];
  }
  saveData();
  renderBudget();
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
.iLine{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}
.iBtns{display:flex;gap:2px}
.iBtns button{min-height:40px;padding:0 10px;background:transparent;border:0;font-weight:600}
.iEdit{color:var(--accent)}
.iDel{color:var(--danger)}
.iAdd{display:grid;grid-template-columns:1fr 120px;gap:8px;margin-top:10px}
.iAdd button{grid-column:1/-1;min-height:44px}
`;
document.head.appendChild(bStyle);

const bSection = document.createElement("section");
bSection.innerHTML =
  '<h2>Monthly budget</h2>' +
  '<p class="muted">Planned amounts for the selected month. Plans never change your cash balance. Tap Items under a category to list prices, such as rice or beans under Food.</p>' +
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
    const its = itemsFor(month, cat);
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
    if (its.length) {
      input.readOnly = true;
      input.title = "Total of the items below";
    }
    top.append(name, input);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    bar.appendChild(fill);
    const info = document.createElement("div");
    info.className = "bInfo";

    // ---- Items list ----
    const det = document.createElement("details");
    const sum = document.createElement("summary");
    sum.textContent = "Items (" + its.length + ")";
    det.appendChild(sum);
    its.forEach(it => {
      const line = document.createElement("div");
      line.className = "iLine";
      const lbl = document.createElement("span");
      lbl.textContent = it.name + " · " + formatKobo(it.amount);
      const btns = document.createElement("div");
      btns.className = "iBtns";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "iEdit";
      edit.textContent = "Edit";
      edit.onclick = () => {
        const n = prompt("Item name", it.name);
        if (n === null) return;
        const a = prompt("Amount (₦)", (it.amount / 100).toFixed(2));
        if (a === null) return;
        const nm = n.trim().slice(0, 50);
        const k = toKobo(a);
        if (!nm || !k) { alert("Both a name and an amount greater than zero are needed."); return; }
        setItems(month, cat, itemsFor(month, cat).map(x => x.id === it.id ? { id: x.id, name: nm, amount: k } : x));
      };

      const del = document.createElement("button");
      del.type = "button";
      del.className = "iDel";
      del.textContent = "Delete";
      del.onclick = () => {
        if (confirm("Delete " + it.name + "?")) {
          setItems(month, cat, itemsFor(month, cat).filter(x => x.id !== it.id));
        }
      };
      btns.append(edit, del);
      line.append(lbl, btns);
      det.appendChild(line);
    });

    const addRow = document.createElement("div");
    addRow.className = "iAdd";
    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.maxLength = 50;
    nameIn.placeholder = "Item, e.g. Rice";
    nameIn.setAttribute("aria-label", "New item name for " + cat);
    const amtIn = document.createElement("input");
    amtIn.type = "number";
    amtIn.inputMode = "decimal";
    amtIn.step = "0.01";
    amtIn.min = "0";
    amtIn.placeholder = "Price ₦";
    amtIn.setAttribute("aria-label", "New item price for " + cat);
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary";
    addBtn.textContent = "Add item";
    addBtn.onclick = () => {
      const nm = nameIn.value.trim().slice(0, 50);
      const k = toKobo(amtIn.value);
      if (!nm) { alert("Please enter an item name, for example Rice."); return; }
      if (!k) { alert("Please enter a price greater than zero."); return; }
      setItems(month, cat, itemsFor(month, cat).concat([{ id: newId(), name: nm, amount: k }]));
    };
    addRow.append(nameIn, amtIn, addBtn);
    det.appendChild(addRow);

    det.open = openCats.has(cat);
    det.addEventListener("toggle", () => {
      if (det.open) openCats.add(cat); else openCats.delete(cat);
    });

    row.append(top, bar, info, det);
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
  if (!data.budgets._items) data.budgets._items = {};
  const prevItems = data.budgets._items[prevMonth(month)];
  data.budgets._items[month] = prevItems ? JSON.parse(JSON.stringify(prevItems)) : {};
  saveData();
  renderBudget();
});

renderBudget();
