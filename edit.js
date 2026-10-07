"use strict";
// SalaryPlan Stage 7: edit transactions.

const eStyle = document.createElement("style");
eStyle.textContent =
  "#editDlg{width:calc(100% - 32px);max-width:560px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);padding:16px}" +
  "#editDlg::backdrop{background:rgba(0,0,0,.6)}" +
  ".eForm{display:grid;gap:12px}" +
  ".eForm h2{margin:0}";
document.head.appendChild(eStyle);

const eDlg = document.createElement("dialog");
eDlg.id = "editDlg";
eDlg.innerHTML =
  '<form id="editForm" class="eForm">' +
  '<h2>Edit transaction</h2>' +
  '<label>Type<select id="eType"><option value="expense">Expense</option><option value="income">Income</option></select></label>' +
  '<label>Amount (₦)<input type="number" id="eAmount" inputmode="decimal" step="0.01" min="0.01" required></label>' +
  '<label>Date<input type="date" id="eDate" required></label>' +
  '<label>Time<input type="time" id="eTime"></label>' +
  '<label>Category<select id="eCat"></select></label>' +
  '<label>Note (optional)<input type="text" id="eNote" maxlength="100"></label>' +
  '<button type="submit" class="primary">Save changes</button>' +
  '<button type="button" id="eCancel" class="secondary">Cancel</button>' +
  '</form>';
document.body.appendChild(eDlg);

let editingTxId = null;

function isBillPayment(id) {
  const p = data.billPayments || {};
  return Object.keys(p).some(m => Object.keys(p[m]).some(b => p[m][b] === id));
}

function fillECat(selected) {
  const sel = $("eCat");
  sel.innerHTML = "";
  const list = CATEGORIES[$("eType").value].slice();
  if (selected && !list.includes(selected)) list.push(selected);
  list.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  if (selected) sel.value = selected;
}

function openEdit(t) {
  editingTxId = t.id;
  $("eType").value = t.type;
  fillECat(t.category);
  $("eAmount").value = (t.amount / 100).toFixed(2);
  $("eDate").value = t.date;
  $("eTime").value = t.time || "";
  $("eNote").value = t.note || "";
  eDlg.showModal();
}

$("eType").addEventListener("change", () => fillECat());
$("eCancel").addEventListener("click", () => eDlg.close());

$("editForm").addEventListener("submit", e => {
  e.preventDefault();
  const t = data.transactions.find(x => x.id === editingTxId);
  if (!t) { eDlg.close(); return; }
  const amount = toKobo($("eAmount").value);
  const date = $("eDate").value;
  const type = $("eType").value;
  if (!amount) { alert("Please enter an amount greater than zero."); return; }
  if (!date) { alert("Please choose a date."); return; }
  if (isBillPayment(t.id) && (type !== "expense" || date.slice(0, 7) !== t.date.slice(0, 7))) {
    alert("This expense is a bill payment. It must stay an expense in the same month. To move it, use Mark unpaid on the bill instead.");
    return;
  }
  t.type = type;
  t.amount = amount;
  t.date = date;
  t.time = $("eTime").value;
  t.category = $("eCat").value;
  t.note = $("eNote").value.trim();
  saveData();
  eDlg.close();
  $("month").value = date.slice(0, 7);
  render();
});

// Tapping a transaction row offers Edit or Delete (custom menu, no native pop-up).
function openTxMenu(t) {
  showActionMenu({
    title: t.note || t.category,
    items: [
      { label: "Edit", hint: "Change amount, date or category", onSelect: () => openEdit(t) },
      { label: "Delete", danger: true, onSelect: () => deleteTx(t) }
    ]
  });
}
