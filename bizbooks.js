"use strict";
// SalaryPlan business books: accounts, owner/loan/transfer movements, customer invoices and supplier
// bills, custom categories and an all-in cash balance. Active only inside a business workspace.
// Non-operating money (owner, loans, transfers) is stored apart from transactions
// (data.budgets._moves), so every existing screen and report counts only operating income and expenses.

const BK_ID = /^[a-z0-9]{1,20}$/;
const BK_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MOVE_KINDS = ["ownerIn", "ownerOut", "loanIn", "loanOut", "transfer"];
const MOVE_LABEL = { ownerIn: "Owner contribution", ownerOut: "Owner withdrawal", loanIn: "Loan received", loanOut: "Loan repayment (principal)", transfer: "Transfer" };

// ---- Safe cleaning for imports and restores (installed in every workspace) ----
function cleanBooks(b) {
  const out = {};
  if (!b || typeof b !== "object") return out;
  if (Array.isArray(b._accts)) {
    out._accts = b._accts.filter(a => a && BK_ID.test(a.id || "") && typeof a.name === "string").slice(0, 20)
      .map(a => ({ id: a.id, name: a.name.slice(0, 40) }));
  }
  if (b._meta && typeof b._meta === "object") {
    out._meta = {};
    Object.keys(b._meta).forEach(k => { const v = b._meta[k]; if (k.length < 40 && typeof v === "string" && BK_ID.test(v)) out._meta[k] = v; });
  }
  if (Array.isArray(b._moves)) {
    out._moves = b._moves.filter(m => m && typeof m.id === "string" && MOVE_KINDS.includes(m.kind) &&
      Number.isInteger(m.amount) && m.amount > 0 && BK_DATE.test(m.date || "")).map(m => ({
      id: m.id, kind: m.kind, amount: m.amount, date: m.date, note: typeof m.note === "string" ? m.note.slice(0, 100) : "",
      acct: BK_ID.test(m.acct || "") ? m.acct : "", acct2: BK_ID.test(m.acct2 || "") ? m.acct2 : ""
    }));
  }
  if (Array.isArray(b._docs)) {
    out._docs = b._docs.filter(d => d && typeof d.id === "string" && (d.kind === "inv" || d.kind === "bill") &&
      Number.isInteger(d.amount) && d.amount > 0 && BK_DATE.test(d.date || "") && BK_DATE.test(d.due || "")).map(d => ({
      id: d.id, kind: d.kind, party: String(d.party || "").slice(0, 60), amount: d.amount, date: d.date, due: d.due,
      note: String(d.note || "").slice(0, 100), cat: String(d.cat || "").slice(0, 50), paid: !!d.paid,
      paidDate: BK_DATE.test(d.paidDate || "") ? d.paidDate : "", tx: typeof d.tx === "string" ? d.tx.slice(0, 40) : ""
    }));
  }
  if (b._cats && typeof b._cats === "object") {
    const c = x => (Array.isArray(x) ? x : []).filter(s => typeof s === "string" && s.trim()).map(s => s.trim().slice(0, 50)).slice(0, 40);
    out._cats = { income: c(b._cats.income), expense: c(b._cats.expense) };
  }
  return out;
}
const baseCleanBudgets5 = cleanBudgets;
cleanBudgets = function (b) { return Object.assign(baseCleanBudgets5(b), cleanBooks(b)); };

// ---- Data helpers ----
function bkData() { if (!data.budgets) data.budgets = {}; return data.budgets; }
function bkAccts() {
  const b = bkData();
  if (!Array.isArray(b._accts) || !b._accts.length) b._accts = [{ id: "cash", name: "Cash" }, { id: "bank", name: "Bank" }];
  return b._accts;
}
function bkMoves() { const b = bkData(); if (!Array.isArray(b._moves)) b._moves = []; return b._moves; }
function bkDocs() { const b = bkData(); if (!Array.isArray(b._docs)) b._docs = []; return b._docs; }
function bkMeta() { const b = bkData(); if (!b._meta || typeof b._meta !== "object") b._meta = {}; return b._meta; }
function acctOk(id) { return bkAccts().some(a => a.id === id) ? id : bkAccts()[0].id; }
function acctName(id) { const a = bkAccts().find(x => x.id === id); return a ? a.name : "Account"; }
function txAcct(t) { return acctOk(bkMeta()[t.id]); }
function docPaid(d) { return d.paid && data.transactions.some(t => t.id === d.tx); }

// Balance of each account, counting everything dated up to and including a month (or all time).
function acctBalances(upTo) {
  const bal = {};
  bkAccts().forEach(a => { bal[a.id] = 0; });
  const first = bkAccts()[0].id;
  const ok = d => !upTo || d.slice(0, 7) <= upTo;
  bal[first] += openingCash();
  data.transactions.forEach(t => { if (ok(t.date)) bal[txAcct(t)] += t.type === "income" ? t.amount : -t.amount; });
  bkMoves().forEach(m => {
    if (!ok(m.date)) return;
    const a = acctOk(m.acct);
    if (m.kind === "ownerIn" || m.kind === "loanIn") bal[a] += m.amount;
    else if (m.kind === "ownerOut" || m.kind === "loanOut") bal[a] -= m.amount;
    else { bal[a] -= m.amount; bal[acctOk(m.acct2)] += m.amount; }
  });
  (data.goals || []).forEach(g => g.contribs.forEach(c => { if (ok(c.date)) bal[first] -= c.amount; }));
  return bal;
}
function sumBal(b) { return Object.keys(b).reduce((s, k) => s + b[k], 0); }
function bizTotalAt(month) { return sumBal(acctBalances(month)); }

// Money flows between two months (inclusive), plus opening and closing cash.
function periodFlows(s, e) {
  const f = { income: 0, expense: 0, ownerIn: 0, ownerOut: 0, loanIn: 0, loanOut: 0, saved: 0 };
  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (m < s || m > e) return;
    if (t.type === "income") f.income += t.amount; else f.expense += t.amount;
  });
  bkMoves().forEach(m => {
    const mm = m.date.slice(0, 7);
    if (mm < s || mm > e || m.kind === "transfer") return;
    f[m.kind] += m.amount;
  });
  (data.goals || []).forEach(g => g.contribs.forEach(c => { const m = c.date.slice(0, 7); if (m >= s && m <= e) f.saved += c.amount; }));
  f.opening = bizTotalAt(prevMonth(s));
  f.closing = bizTotalAt(e);
  return f;
}

function fld(label, el) { const l = mkEl("label", "", label); l.appendChild(el); l.style.marginBottom = "10px"; return l; }
function mkIn(type, val, ph) {
  const i = document.createElement("input");
  i.type = type;
  if (val != null && val !== "") i.value = val;
  if (ph) i.placeholder = ph;
  return i;
}
function mkSel(opts, val) {
  const s = document.createElement("select");
  opts.forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
  if (val != null) s.value = val;
  return s;
}
function acctOpts() { return bkAccts().map(a => [a.id, a.name]); }

// ================= Business workspace only =================
if (typeof wsEntry !== "undefined" && wsEntry) {

  // ---- Categories (built-in plus your own) ----
  const BASE_EXP = CATEGORIES.expense.filter(c => c !== "Loan repayment").concat(["Loan interest & bank charges"]);
  function applyCats() {
    const c = bkData()._cats || { income: [], expense: [] };
    CATEGORIES.income = BIZ_CATS.income.concat((c.income || []).filter(x => !BIZ_CATS.income.includes(x)));
    CATEGORIES.expense = BASE_EXP.concat((c.expense || []).filter(x => !BASE_EXP.includes(x)));
    fillCategories();
  }

  // ---- Account choice on the Add form ----
  const acctSel = document.createElement("select");
  const acctLbl = document.createElement("label");
  acctLbl.appendChild(document.createTextNode("Account"));
  acctLbl.appendChild(acctSel);
  $("category").closest("label").after(acctLbl);
  function fillAcctSel() {
    const keep = acctSel.value;
    acctSel.innerHTML = "";
    acctOpts().forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; acctSel.appendChild(op); });
    acctSel.value = acctOk(keep);
  }
  let lenBefore = 0;
  $("txForm").addEventListener("submit", () => { lenBefore = data.transactions.length; }, true);
  $("txForm").addEventListener("submit", () => {
    if (data.transactions.length > lenBefore) {
      const t = data.transactions[data.transactions.length - 1];
      bkMeta()[t.id] = acctSel.value;
      saveData();
    }
  });

  // ---- Dashboard cash balance: all accounts, including owner money, loans and transfers ----
  function showBizBalance() {
    const month = $("month").value;
    if (!month) return;
    const txt = formatKobo(bizTotalAt(month));
    const el = $("sumBalance");
    el.dataset.real = txt;
    el.textContent = hideBal ? MASK : txt;
    $("openNote").textContent = "Opening balance: " + formatKobo(bizTotalAt(prevMonth(month)));
    if (el.previousElementSibling) el.previousElementSibling.textContent = "Cash in all accounts";
  }
  const renderBeforeBooks = render;
  render = function () { renderBeforeBooks(); showBizBalance(); };
  $("month").addEventListener("change", showBizBalance);

  // ---- Reports tab: Cash balance table includes owner money, loans and transfers correctly ----
  function cashRows(s, e) {
    const f = periodFlows(s, e);
    return [["Opening balance", f.opening], ["Add: operating income", f.income], ["Less: operating expenses", f.expense],
      ["Add: owner contributions", f.ownerIn], ["Less: owner withdrawals", f.ownerOut], ["Add: loans received", f.loanIn],
      ["Less: loan repayments", f.loanOut], ["Less: savings set aside", f.saved], ["Closing balance", f.closing]];
  }
  const baseBuildSections2 = buildSections;
  buildSections = function (month) {
    const s = baseBuildSections2(month);
    const cash = s.find(x => x.title === "Cash balance");
    if (cash) cash.rows = cashRows(month, month);
    return s;
  };

  // ---- Pages ----
  function booksPage(body) {
    card(body, "Books · " + wsLabel(), ["Accounts, owner money, loans, transfers, customer invoices and supplier bills for this business."]);
    [
      ["Accounts and balances", "Cash, bank and mobile money", () => openPage("Accounts", accountsPage)],
      ["Owner and loans", "Contributions, withdrawals and loans", () => openPage("Owner and loans", p => movesPage(p, "owner"))],
      ["Transfers", "Between your own accounts", () => openPage("Transfers", p => movesPage(p, "transfer"))],
      ["Customer invoices", "Money customers owe you", () => openPage("Customer invoices", p => docsPage(p, "inv"))],
      ["Supplier bills", "Money you owe suppliers", () => openPage("Supplier bills", p => docsPage(p, "bill"))],
      ["Categories", "Add your own income and expense categories", () => openPage("Categories", catsPage)],
      ["Business reports", "Profit and loss, cash flow and more", () => {
        if (typeof bizReportsPage === "function") openPage("Business reports", bizReportsPage);
        else alert("Business reports are not installed yet.");
      }]
    ].forEach(r => {
      const b = mkEl("button", "wsRow");
      b.type = "button";
      const info = mkEl("div", "wsInfo");
      info.append(mkEl("strong", "", r[0]), mkEl("small", "", r[1]));
      b.appendChild(info);
      b.onclick = r[2];
      body.appendChild(b);
    });
  }

  function accountsPage(body) {
    const bal = acctBalances();
    card(body, "Total cash: " + formatKobo(sumBal(bal)), ["Opening cash and savings set aside count against the first account."]);
    bkAccts().forEach((a, i) => {
      const r = mkEl("div", "calItem");
      const top = mkEl("div", "row");
      top.append(mkEl("strong", "", a.name), mkEl("strong", "", formatKobo(bal[a.id])));
      const bar = mkEl("div", "nBar");
      bar.append(
        cb("Rename", "secondary", () => {
          const n = prompt("Account name", a.name);
          if (n && n.trim()) { a.name = n.trim().slice(0, 40); saveData(); fillAcctSel(); openPage("Accounts", accountsPage); }
        }),
        cb("Delete", "secondary", () => {
          const used = Object.keys(bkMeta()).some(k => bkMeta()[k] === a.id) || bkMoves().some(m => m.acct === a.id || m.acct2 === a.id);
          if (i === 0) { alert("The first account is the default and can't be deleted."); return; }
          if (used || bal[a.id] !== 0) { alert("This account has records or a balance, so it can't be deleted. Rename it instead."); return; }
          if (confirm("Delete " + a.name + "?")) {
            bkData()._accts = bkAccts().filter(x => x.id !== a.id);
            saveData(); fillAcctSel(); openPage("Accounts", accountsPage);
          }
        })
      );
      r.append(top, bar);
      body.appendChild(r);
    });
    const nm = mkIn("text", "", "e.g. Mobile money");
    nm.maxLength = 40;
    body.appendChild(fld("Add an account", nm));
    const add = cb("Add account", "primary", () => {
      const name = nm.value.trim();
      if (!name) { alert("Please enter a name."); return; }
      bkAccts().push({ id: newId().replace(/[^a-z0-9]/g, "").slice(0, 16), name: name.slice(0, 40) });
      saveData(); fillAcctSel(); openPage("Accounts", accountsPage);
    });
    add.style.width = "100%";
    body.appendChild(add);
  }

  function movesPage(body, mode) {
    const transfer = mode === "transfer";
    if (!transfer) {
      const sum = k => bkMoves().filter(m => m.kind === k).reduce((s, m) => s + m.amount, 0);
      card(body, "Summary", [
        "Owner contributions: " + formatKobo(sum("ownerIn")),
        "Owner withdrawals: " + formatKobo(sum("ownerOut")),
        "Loans still owed: " + formatKobo(sum("loanIn") - sum("loanOut"))
      ]);
      body.appendChild(mkEl("p", "muted", "These are not income or expenses, so they never change your profit. They do change your cash."));
    } else {
      body.appendChild(mkEl("p", "muted", "A transfer moves money between your own accounts. It is not income or an expense and does not change your total cash."));
      if (bkAccts().length < 2) { body.appendChild(mkEl("p", "muted", "Add a second account in Accounts and balances first.")); return; }
    }
    const kindSel = transfer ? null : mkSel([["ownerIn", "Owner contribution (money in)"], ["ownerOut", "Owner withdrawal (money out)"],
      ["loanIn", "Loan received (money in)"], ["loanOut", "Loan repayment of principal (money out)"]]);
    const amt = mkIn("number", "", "0.00");
    amt.step = "0.01"; amt.min = "0"; amt.inputMode = "decimal";
    const dt = mkIn("date", today());
    const a1 = mkSel(acctOpts(), bkAccts()[0].id);
    const a2 = transfer ? mkSel(acctOpts(), bkAccts()[1].id) : null;
    const note = mkIn("text", "", "Note (optional)");
    note.maxLength = 100;
    if (kindSel) body.appendChild(fld("Type", kindSel));
    body.append(fld("Amount", amt), fld("Date", dt), fld(transfer ? "From account" : "Account", a1));
    if (a2) body.appendChild(fld("To account", a2));
    body.appendChild(fld("Note", note));
    const save = cb(transfer ? "Record transfer" : "Save", "primary", () => {
      const k = toKobo(amt.value);
      if (!k) { alert("Please enter an amount greater than zero."); return; }
      if (!dt.value) { alert("Please choose a date."); return; }
      if (a2 && a1.value === a2.value) { alert("Choose two different accounts."); return; }
      bkMoves().push({ id: newId(), kind: kindSel ? kindSel.value : "transfer", amount: k, date: dt.value,
        note: note.value.trim().slice(0, 100), acct: a1.value, acct2: a2 ? a2.value : "" });
      saveData(); render();
      openPage(transfer ? "Transfers" : "Owner and loans", p => movesPage(p, mode));
    });
    save.style.width = "100%";
    body.appendChild(save);

    body.appendChild(mkEl("h3", "", "Recorded"));
    const list = bkMoves().filter(m => (m.kind === "transfer") === transfer)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length) body.appendChild(mkEl("p", "muted", "Nothing recorded yet."));
    list.forEach(m => {
      const r = mkEl("div", "calItem");
      const top = mkEl("div", "row");
      const left = mkEl("div");
      left.appendChild(mkEl("strong", "", MOVE_LABEL[m.kind] + " · " + formatKobo(m.amount)));
      left.appendChild(mkEl("div", "", ""));
      left.lastChild.appendChild(mkEl("small", "", niceDate(m.date) + " · " +
        (m.kind === "transfer" ? acctName(m.acct) + " to " + acctName(m.acct2) : acctName(m.acct)) + (m.note ? " · " + m.note : "")));
      top.appendChild(left);
      r.appendChild(top);
      const bar = mkEl("div", "nBar");
      bar.appendChild(cb("Delete", "secondary", () => {
        if (!confirm("Delete this record?")) return;
        data.budgets._moves = bkMoves().filter(x => x.id !== m.id);
        saveData(); render();
        openPage(transfer ? "Transfers" : "Owner and loans", p => movesPage(p, mode));
      }));
      r.appendChild(bar);
      body.appendChild(r);
    });
  }

  function docsPage(body, kind) {
    const inv = kind === "inv";
    const title = inv ? "Customer invoices" : "Supplier bills";
    const again = () => openPage(title, p => docsPage(p, kind));
    const open = bkDocs().filter(d => d.kind === kind && !docPaid(d));
    const owed = open.reduce((s, d) => s + d.amount, 0);
    const over = open.filter(d => daysUntil(d.due) < 0).reduce((s, d) => s + d.amount, 0);
    card(body, (inv ? "Customers owe you: " : "You owe suppliers: ") + formatKobo(owed), [
      "Overdue: " + formatKobo(over),
      "Unpaid invoices and bills are not income or expenses until they are paid. Marking one paid records it in your transactions."
    ]);
    const acct = mkSel(acctOpts(), bkAccts()[0].id);
    body.appendChild(fld(inv ? "Payments are received into" : "Payments are made from", acct));

    body.appendChild(mkEl("h3", "", inv ? "New customer invoice" : "New supplier bill"));
    const party = mkIn("text", "", inv ? "Customer name" : "Supplier name");
    party.maxLength = 60;
    const amt = mkIn("number", "", "0.00");
    amt.step = "0.01"; amt.min = "0"; amt.inputMode = "decimal";
    const d1 = mkIn("date", today());
    const d2 = mkIn("date", today());
    const note = mkIn("text", "", "Note or invoice number (optional)");
    note.maxLength = 100;
    const catSel = inv ? null : mkSel(CATEGORIES.expense.map(c => [c, c]), CATEGORIES.expense[0]);
    body.append(fld(inv ? "Customer" : "Supplier", party), fld("Amount", amt), fld("Issue date", d1), fld("Due date", d2));
    if (catSel) body.appendChild(fld("Expense category", catSel));
    body.appendChild(fld("Note", note));
    const save = cb("Save", "primary", () => {
      const k = toKobo(amt.value);
      if (!party.value.trim()) { alert("Please enter a name."); return; }
      if (!k) { alert("Please enter an amount greater than zero."); return; }
      if (!d1.value || !d2.value) { alert("Please choose both dates."); return; }
      bkDocs().push({ id: newId(), kind: kind, party: party.value.trim().slice(0, 60), amount: k, date: d1.value, due: d2.value,
        note: note.value.trim().slice(0, 100), cat: catSel ? catSel.value : "Customer payments", paid: false, paidDate: "", tx: "" });
      saveData(); again();
    });
    save.style.width = "100%";
    body.appendChild(save);

    body.appendChild(mkEl("h3", "", "All"));
    const list = bkDocs().filter(d => d.kind === kind)
      .sort((a, b) => (docPaid(a) - docPaid(b)) || a.due.localeCompare(b.due));
    if (!list.length) body.appendChild(mkEl("p", "muted", "Nothing recorded yet."));
    list.forEach(d => {
      const paid = docPaid(d);
      const r = mkEl("div", "calItem");
      const top = mkEl("div", "row");
      const left = mkEl("div");
      left.appendChild(mkEl("strong", "", d.party + " · " + formatKobo(d.amount)));
      left.appendChild(mkEl("div", "", ""));
      left.lastChild.appendChild(mkEl("small", "", "Issued " + niceDate(d.date) + " · Due " + niceDate(d.due) + (d.note ? " · " + d.note : "")));
      top.appendChild(left);
      const n = daysUntil(d.due);
      top.appendChild(mkEl("span", "chip " + (paid ? "k-paid" : n < 0 ? "k-overdue" : n <= 7 ? "k-upcoming" : "k-unpaid"),
        paid ? "Paid " + niceDate(d.paidDate) : n < 0 ? "Overdue " + (-n) + "d" : "Due in " + n + "d"));
      r.appendChild(top);
      const bar = mkEl("div", "nBar");
      if (!paid) {
        bar.appendChild(cb("Mark paid today", "secondary", () => {
          if (!confirm("Record this as " + (inv ? "income (Customer payments)" : "an expense (" + (d.cat || "Other") + ")") + " paid today?")) return;
          const tx = { id: newId(), type: inv ? "income" : "expense", amount: d.amount, date: today(), time: nowTime(),
            category: inv ? "Customer payments" : (d.cat || "Other"), note: d.party + (inv ? " (invoice payment)" : " (suppli
