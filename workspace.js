"use strict";
// SalaryPlan: workspaces. Personal plus any number of businesses, each with its own data.
// Personal data keeps its original key. Each business uses its own key (sp_biz_<id>).
// The active workspace is set by one key, sp_data_key, which app.js reads at start-up.

const WS_LIST_KEY = "sp_ws_list";
const BIZ_CATS = {
  income: ["Sales", "Services", "Customer payments", "Other income"],
  expense: ["Inventory & supplies", "Salaries & wages", "Rent", "Utilities", "Transport", "Marketing", "Equipment", "Taxes & fees", "Loan repayment", "Other"]
};
const BIZ_TYPES = ["Retail / shop", "Services", "Food & drinks", "Manufacturing", "Agriculture", "Transport", "Education", "Health", "Other"];

function wsList() {
  try { const a = JSON.parse(lsGet(WS_LIST_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function wsSaveList(a) { lsSet(WS_LIST_KEY, JSON.stringify(a)); }
function wsKeyFor(id) { return id === "personal" ? "salaryplan_data_v1" : "sp_biz_" + id; }

const wsActiveId = (function () {
  const k = lsGet("sp_data_key");
  return k && k.indexOf("sp_biz_") === 0 ? k.slice(7) : "personal";
})();

// Safety guard: never show personal records under a business name.
if (KEY !== wsKeyFor(wsActiveId)) {
  lsDel("sp_data_key");
  alert("SalaryPlan went back to your Personal workspace because the app.js update is missing. Nothing was lost. Please apply the one-line app.js change, then try again.");
  location.reload();
}

const wsEntry = wsActiveId === "personal" ? null :
  (wsList().find(w => w.id === wsActiveId) || { id: wsActiveId, name: "Business (profile missing)", type: "Other", currency: lsGet("sp_cur") || "NGN" });
function wsLabel() { return wsEntry ? wsEntry.name : "Personal"; }

// ---- Business categories, opening cash, backup of the extras ----
const baseCleanBudgets4 = cleanBudgets;
cleanBudgets = function (b) {
  const out = baseCleanBudgets4(b);
  if (b && Number.isInteger(b._opening)) out._opening = b._opening;
  return out;
};
function openingCash() { return data.budgets && Number.isInteger(data.budgets._opening) ? data.budgets._opening : 0; }

if (wsEntry) {
  CATEGORIES.income = BIZ_CATS.income.slice();
  CATEGORIES.expense = BIZ_CATS.expense.slice();
  fillCategories();
  document.documentElement.classList.add("ws-biz");
}

// ---- Styles and header indicator ----
const wsStyle = document.createElement("style");
wsStyle.textContent = `
header h1{max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.wsTag{font-size:.6rem;font-weight:800;letter-spacing:.06em;background:#f59e0b;color:#fff;border-radius:6px;padding:2px 6px;margin-left:6px}
.wsLogo{width:28px;height:28px;border-radius:8px;object-fit:cover}
.ws-biz header{border-bottom:3px solid #f59e0b}
.ws-biz #fab,.ws-biz .primary{background:#f59e0b}
.ws-biz .card.wide{background:linear-gradient(135deg,#d97706,#f59e0b)}
.wsRow{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--card);color:var(--text);border:0;border-radius:16px;box-shadow:var(--shadow);padding:12px;margin-bottom:8px;min-height:0}
.wsAv{width:44px;height:44px;border-radius:14px;background:var(--mint);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden;flex:none}
.wsAv img{width:44px;height:44px;object-fit:cover}
.wsInfo{flex:1;min-width:0}
.wsInfo strong{display:block;word-break:break-word}
.wsInfo small{color:var(--muted)}
.wsOn{font-size:.7rem;font-weight:700;background:var(--accent2);color:#fff;border-radius:999px;padding:2px 9px}
`;
document.head.appendChild(wsStyle);

const wsH1 = document.querySelector("header h1");
wsH1.textContent = wsEntry ? wsEntry.name : "SalaryPlan";
wsH1.setAttribute("role", "button");
wsH1.setAttribute("aria-label", "Switch workspace");
wsH1.onclick = () => openPage("Workspaces", workspacePage);
if (wsEntry) {
  const tag = document.createElement("span");
  tag.className = "wsTag";
  tag.textContent = "BUSINESS";
  wsH1.after(tag);
}
function validLogo(s) { return typeof s === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s); }
if (wsEntry && validLogo(wsEntry.logo)) {
  const img = document.createElement("img");
  img.className = "wsLogo"; img.alt = ""; img.src = wsEntry.logo;
  wsH1.before(img);
}
addTitle.textContent = "Add transaction · " + wsLabel();

// ---- Opening cash in the balance card and the Cash balance report ----
function adjustOpening() {
  const oc = openingCash(), month = $("month").value;
  if (!oc || !month) return;
  let before = 0, upto = 0;
  data.transactions.forEach(t => {
    const m = t.date.slice(0, 7), v = t.type === "income" ? t.amount : -t.amount;
    if (m < month) before += v;
    if (m <= month) upto += v;
  });
  (data.goals || []).forEach(g => g.contribs.forEach(c => {
    const m = c.date.slice(0, 7);
    if (m < month) before -= c.amount;
    if (m <= month) upto -= c.amount;
  }));
  const el = $("sumBalance"), txt = formatKobo(oc + upto);
  el.dataset.real = txt;
  el.textContent = hideBal ? MASK : txt;
  $("openNote").textContent = "Opening balance: " + formatKobo(oc + before);
}
const renderBeforeWs = render;
render = function () { renderBeforeWs(); adjustOpening(); };
$("month").addEventListener("change", adjustOpening);

const baseBuildSections = buildSections;
buildSections = function (month) {
  const s = baseBuildSections(month);
  const oc = openingCash();
  const cash = s.find(x => x.title === "Cash balance");
  if (oc && cash && cash.rows.length === 5) { cash.rows[0][1] += oc; cash.rows[4][1] += oc; }
  return s;
};

// ---- Switching ----
function switchTo(id) {
  if (!window.SP_PATCHED) { alert("The one-line app.js update is missing, so switching is switched off to protect your records."); return; }
  const list = wsList();
  const cur = lsGet("sp_cur") || "NGN";
  if (wsActiveId === "personal") lsSet("sp_ws_personal_cur", cur);
  else { const e = list.find(w => w.id === wsActiveId); if (e) { e.currency = cur; wsSaveList(list); } }
  const target = id === "personal" ? (lsGet("sp_ws_personal_cur") || "NGN") : ((list.find(w => w.id === id) || {}).currency || "NGN");
  lsSet("sp_cur", target);
  if (id === "personal") lsDel("sp_data_key"); else lsSet("sp_data_key", "sp_biz_" + id);
  location.reload();
}
function askSwitch(id, name) {
  if (id === wsActiveId) return;
  if (confirm("Switch to " + name + "?\n\nThe app reloads. If you use a PIN, you'll enter it again.")) switchTo(id);
}

// ---- Pages ----
function wsAvatar(e, label) {
  const a = mkEl("span", "wsAv");
  if (e && validLogo(e.logo)) { const i = document.createElement("img"); i.src = e.logo; i.alt = ""; a.appendChild(i); }
  else a.textContent = (label || "?").trim().charAt(0).toUpperCase();
  return a;
}

function workspacePage(body) {
  if (!window.SP_PATCHED) {
    card(body, "One small update needed", [
      "Open app.js on GitHub and replace the line that starts with: const KEY =",
      "with: const KEY = (window.SP_PATCHED = true, localStorage.getItem(\"sp_data_key\") || \"salaryplan_data_v1\");",
      "Until then businesses are switched off, so your records can never be mixed up."
    ]);
    return;
  }
  const row = (id, name, sub, entry, onEdit) => {
    const r = mkEl("button", "wsRow");
    r.type = "button";
    const info = mkEl("div", "wsInfo");
    info.append(mkEl("strong", "", name), mkEl("small", "", sub));
    r.append(wsAvatar(entry, name), info);
    if (id === wsActiveId) r.appendChild(mkEl("span", "wsOn", "Active"));
    r.onclick = () => askSwitch(id, name);
    body.appendChild(r);
    if (onEdit) {
      const ed = mkEl("button", "secondary", "Edit " + name);
      ed.type = "button";
      ed.style.cssText = "margin:-2px 0 10px 56px;min-height:36px";
      ed.onclick = () => openPage("Edit business", b => businessForm(b, id));
      body.appendChild(ed);
    }
  };
  card(body, "You are in: " + wsLabel(), [
    "Each workspace has its own transactions, budgets, bills, savings, notes and reports. They are never mixed. Tap one to switch."
  ]);
  row("personal", "Personal", "Your own money", null, false);
  const list = wsList();
  list.filter(w => !w.archived).forEach(w => row(w.id, w.name, w.type + " · " + w.currency, w, true));
  const add = mkEl("button", "primary", "Add a business");
  add.type = "button";
  add.style.cssText = "width:100%;margin-top:6px";
  add.onclick = () => openPage("New business", b => businessForm(b, null));
  body.appendChild(add);
  const arch = list.filter(w => w.archived);
  if (arch.length) {
    const ab = mkEl("button", "secondary", "Archived businesses (" + arch.length + ")");
    ab.type = "button";
    ab.style.cssText = "width:100%;margin-top:8px";
    ab.onclick = () => openPage("Archived businesses", archivedPage);
    body.appendChild(ab);
  }
  const c = card(body, "Backup all workspaces", [
    "The normal Export backup in the menu only saves the workspace you are in. This saves Personal and every business in one file, and restoring it replaces everything."
  ]);
  const ex = mkEl("button", "secondary", "Export all workspaces");
  ex.type = "button";
  ex.onclick = exportAll;
  const im = mkEl("button", "secondary", "Import all workspaces");
  im.type = "button";
  im.style.marginLeft = "8px";
  im.onclick = () => wsFile.click();
  c.append(ex, im);
}

function archivedPage(body) {
  const list = wsList().filter(w => w.archived);
  if (!list.length) body.appendChild(mkEl("p", "muted", "No archived businesses."));
  body.appendChild(mkEl("p", "muted", "Archived businesses keep all their records. They are just hidden from the switcher."));
  list.forEach(w => {
    const r = mkEl("div", "wsRow");
    const info = mkEl("div", "wsInfo");
    info.append(mkEl("strong", "", w.name), mkEl("small", "", w.type));
    const re = mkEl("button", "secondary", "Restore");
    re.type = "button";
    re.onclick = () => {
      const all = wsList();
      const e = all.find(x => x.id === w.id);
      if (e) { e.archived = false; wsSaveList(all); }
      openPage("Workspaces", workspacePage);
    };
    r.append(wsAvatar(w, w.name), info, re);
    body.appendChild(r);
  });
}

function readLogo(file, cb2) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const s = 96, c = document.createElement("canvas");
    c.width = s; c.height = s;
    const r = Math.min(img.width, img.height);
    c.getContext("2d").drawImage(img, (img.width - r) / 2, (img.height - r) / 2, r, r, 0, 0, s, s);
    URL.revokeObjectURL(url);
    cb2(c.toDataURL("image/jpeg", 0.8));
  };
  img.onerror = () => { URL.revokeObjectURL(url); cb2(""); };
  img.src = url;
}

function businessForm(body, id) {
  const list = wsList();
  const e = id ? list.find(w => w.id === id) : null;
  const isActive = !!id && id === wsActiveId;
  let logo = e && validLogo(e.logo) ? e.logo : "";
  const mk = (type, val, ph, max) => { const i = document.createElement("input"); i.type = type; if (val) i.value = val; if (ph) i.placeholder = ph; if (max) i.maxLength = max; return i; };
  const lab = (t, el) => { const l = mkEl("label", "", t); l.appendChild(el); l.style.marginBottom = "10px"; return l; };
  const sel = (opts, val) => { const s = document.createElement("select"); opts.forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); }); s.value = val; return s; };

  const nameIn = mk("text", e ? e.name : "", "Business name", 60);
  const typeSel = sel(BIZ_TYPES.map(t => [t, t]), e ? e.type : BIZ_TYPES[0]);
  const descIn = mk("text", e ? e.desc : "", "What the business does (optional)", 200);
  const phoneIn = mk("tel", e ? e.phone : "", "Phone (optional)", 30);
  const emailIn = mk("email", e ? e.email : "", "Email (optional)", 80);
  const addrIn = mk("text", e ? e.address : "", "Address (optional)", 120);
  const curSel = sel(Object.keys(FX_CODES).map(c => [c, c + " - " + FX_CODES[c]]), e ? e.currency : "NGN");
  const fySel = sel(FULL_MONTHS.map((m, i) => [String(i + 1), m]), String(e && e.fyStart ? e.fyStart : 1));
  body.append(lab("Business name", nameIn), lab("Business type", typeSel), lab("Description", descIn),
    lab("Phone", phoneIn), lab("Email", emailIn), lab("Address", addrIn), lab("Currency", curSel), lab("Financial year starts in", fySel));

  let openIn = null;
  if (!e || isActive) {
    openIn = mk("number", isActive && openingCash() ? (openingCash() / 100).toFixed(2) : "", "0.00");
    openIn.step = "0.01"; openIn.min = "0"; openIn.inputMode = "decimal";
    body.appendChild(lab("Opening cash balance", openIn));
  } else {
    body.appendChild(mkEl("p", "muted", "To change this business's opening cash balance, switch to it first."));
  }

  const logoRow = mkEl("div");
  const prev = mkEl("div", "wsAv");
  const showPrev = () => { prev.innerHTML = ""; if (logo) { const i = document.createElement("img"); i.src = logo; i.alt = ""; prev.appendChild(i); } else prev.textContent = (nameIn.value || "?").charAt(0).toUpperCase(); };
  showPrev();
  const file = document.createElement("input");
  file.type = "file"; file.accept = "image/*"; file.hidden = true;
  file.onchange = () => { if (file.files[0]) readLogo(file.files[0], d => { logo = d; showPrev(); }); };
  const pick = mkEl("button", "secondary", "Choose logo (optional)");
  pick.type = "button";
  pick.onclick = () => file.click();
  const rm = mkEl("button", "secondary", "Remove logo");
  rm.type = "button";
  rm.onclick = () => { logo = ""; showPrev(); };
  logoRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px";
  logoRow.append(prev, pick, rm, file);
  body.appendChild(logoRow);

  const save = mkEl("button", "primary", e ? "Save changes" : "Create business");
  save.type = "button";
  save.style.cssText = "width:100%";
  save.onclick = () => {
    const name = nameIn.value.trim();
    if (!name) { alert("Please enter the business name."); return; }
    const rec = { name: name, type: typeSel.value, desc: descIn.value.trim(), phone: phoneIn.value.trim(), email: emailIn.value.trim(),
      address: addrIn.value.trim(), currency: curSel.value, fyStart: Number(fySel.value), logo: logo };
    const oc = openIn ? toKobo(openIn.value) : null;
    const all = wsList();
    if (e) {
      Object.assign(all.find(w => w.id === e.id), rec);
      wsSaveList(all);
      if (isActive) {
        lsSet("sp_cur", rec.currency);
        if (!data.budgets) data.budgets = {};
        data.budgets._opening = oc || 0;
        saveData();
      }
      location.reload();
      return;
    }
    const nid = newId().replace(/[^a-z0-9]/g, "");
    all.push(Object.assign({ id: nid, archived: false, created: new Date().toISOString() }, rec));
    wsSaveList(all);
    lsSet("sp_biz_" + nid, JSON.stringify({ version: 1, transactions: [], budgets: oc ? { _opening: oc } : {} }));
    if (confirm("Business created. Switch to it now?")) switchTo(nid);
    else openPage("Workspaces", workspacePage);
  };
  body.appendChild(save);

  const back = mkEl("button", "secondary", "Cancel");
  back.type = "button";
  back.style.cssText = "width:100%;margin-top:8px";
  back.onclick = () => openPage("Workspaces", workspacePage);
  body.appendChild(back);

  if (e) {
    if (isActive) {
      body.appendChild(mkEl("p", "muted", "To archive this business, switch to another workspace first."));
    } else {
      const ar = mkEl("button", "secondary", "Archive this business");
      ar.type = "button";
      ar.style.cssText = "width:100%;margin-top:8px;color:var(--danger)";
      ar.onclick = () => {
        if (!confirm("Archive " + e.name + "?\n\nNothing is deleted. You can restore it any time.")) return;
        const all = wsList();
        all.find(w => w.id === e.id).archived = true;
        wsSaveList(all);
        openPage("Workspaces", workspacePage);
      };
      body.appendChild(ar);
    }
  }
}

// ---- Backup and restore of every workspace ----
function exportAll() {
  const grab = k => { try { return JSON.parse(lsGet(k) || "null"); } catch (e) { return null; } };
  const bundle = { format: "salaryplan-workspaces", version: 1, exported: new Date().toISOString(),
    list: wsList(), personal: grab("salaryplan_data_v1"), personalCurrency: lsGet("sp_ws_personal_cur") || "NGN", businesses: {} };
  wsList().forEach(w => { bundle.businesses[w.id] = grab("sp_biz_" + w.id); });
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "salaryplan-all-workspaces-" + today() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function cleanWorkspaceData(d) {
  if (!d || !Array.isArray(d.transactions)) return null;
  const good = d.transactions.filter(validTx).map(t => ({
    id: t.id, type: t.type, amount: t.amount, date: t.date,
    time: typeof t.time === "string" && /^\d{2}:\d{2}$/.test(t.time) ? t.time : "",
    category: t.category.slice(0, 50), note: typeof t.note === "string" ? t.note.slice(0, 100) : ""
  }));
  const out = { version: 1, transactions: good, budgets: cleanBudgets(d.budgets) };
  if (typeof cleanBills === "function") { out.bills = cleanBills(d.bills); out.billPayments = cleanPayments(d.billPayments); }
  if (typeof cleanGoals === "function") out.goals = cleanGoals(d.goals);
  return out;
}

const wsFile = document.createElement("input");
wsFile.type = "file"; wsFile.accept = "application/json,.json"; wsFile.hidden = true;
document.body.appendChild(wsFile);
wsFile.onchange = () => {
  const f = wsFile.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const b = JSON.parse(rd.result);
      if (!b || b.format !== "salaryplan-workspaces") throw new Error("format");
      const names = (Array.isArray(b.list) ? b.list.length : 0);
      if (!confirm("This REPLACES Personal and all " + names + " business(es) on this phone with the file's contents. Continue?")) { wsFile.value = ""; return; }
      const personal = cleanWorkspaceData(b.personal);
      if (personal) lsSet("salaryplan_data_v1", JSON.stringify(personal));
      const list = [];
      (Array.isArray(b.list) ? b.list : []).forEach(w => {
        if (!w || typeof w.id !== "string" || !/^[a-z0-9]{1,40}$/.test(w.id) || typeof w.name !== "string") return;
        const d = cleanWorkspaceData(b.businesses && b.businesses[w.id]);
        if (!d) return;
        lsSet("sp_biz_" + w.id, JSON.stringify(d));
        list.push({ id: w.id, name: w.name.slice(0, 60), type: String(w.type || "Other").slice(0, 40), desc: String(w.desc || "").slice(0, 200),
          phone: String(w.phone || "").slice(0, 30), email: String(w.email || "").slice(0, 80), address: String(w.address || "").slice(0, 120),
          currency: FX_CODES[w.currency] ? w.currency : "NGN", fyStart: Number.isInteger(w.fyStart) && w.fyStart >= 1 && w.fyStart <= 12 ? w.fyStart : 1,
          logo: validLogo(w.logo) ? w.logo : "", archived: !!w.archived, created: String(w.created || "").slice(0, 40) });
      });
      wsSaveList(list);
      lsSet("sp_ws_personal_cur", FX_CODES[b.personalCurrency] ? b.personalCurrency : "NGN");
      lsSet("sp_cur", FX_CODES[b.personalCurrency] ? b.personalCurrency : "NGN");
      lsDel("sp_data_key");
      alert("Restored. The app will reload into Personal.");
      location.reload();
    } catch (err) {
      alert("That file is not a valid SalaryPlan all-workspaces backup.");
    }
    wsFile.value = "";
  };
  rd.readAsText(f);
};

// ---- Menu item ----
const wsItem = mkEl("button", "dItem");
wsItem.type = "button";
const wsIc = mkEl("span", "ic");
wsIc.innerHTML = svgIcon("grid");
wsItem.append(wsIc, mkEl("span", "", "Workspaces"));
wsItem.onclick = () => openPage("Workspaces", workspacePage);
drawer.insertBefore(wsItem, drawer.querySelector(".dItem"));

render();
