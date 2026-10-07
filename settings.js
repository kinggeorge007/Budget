"use strict";
// SalaryPlan Stage 13: slide-out menu with Settings, Backup, How to use, Privacy and About.

const APP_VERSION = "1.1.0";

// ---- Extra icons (reuses the icon helper from home.js) ----
ICONS.menu = '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
ICONS.sliders = '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>';
ICONS.info = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
ICONS.shield = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
ICONS.help = '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
ICONS.back = '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>';

// ---- Styles ----
const sStyle = document.createElement("style");
sStyle.textContent = `
.brand{display:flex;align-items:center;gap:6px}
#menuBtn{width:44px;height:44px;min-height:0;padding:0;border:0;background:transparent;color:var(--text);display:flex;align-items:center;justify-content:center;border-radius:50%}
#menuBtn svg,.dItem svg,.pHead svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#drawerBg{position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s;z-index:40}
#drawerBg.open{opacity:1;pointer-events:auto}
#drawer{position:fixed;top:0;bottom:0;left:0;width:82%;max-width:320px;background:var(--bg);z-index:41;transform:translateX(-105%);transition:transform .25s;display:flex;flex-direction:column;box-shadow:4px 0 24px rgba(0,0,0,.3)}
#drawer.open{transform:none}
.dHead{background:linear-gradient(135deg,#00b36b,#009a5c);color:#fff;padding:36px 18px 18px}
.dHead strong{font-size:1.3rem;display:block}
.dHead span{font-size:.85rem;opacity:.9}
.dItem{display:flex;align-items:center;gap:14px;width:100%;min-height:56px;padding:0 18px;border:0;background:transparent;color:var(--text);font-size:1rem;font-weight:500;text-align:left;border-radius:0}
.dItem .ic{width:36px;height:36px;border-radius:12px;background:var(--mint);color:var(--accent);display:flex;align-items:center;justify-content:center}
.dFoot{margin-top:auto;padding:16px 18px;color:var(--muted);font-size:.8rem}
#pageDlg{position:fixed;top:0;left:0;width:100%;max-width:100%;height:100%;max-height:100%;margin:0;border:0;padding:0;background:var(--bg);color:var(--text);overflow:auto}
.pHead{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--bg);border-bottom:1px solid var(--line)}
.pHead button{width:44px;height:44px;min-height:0;padding:0;border:0;background:transparent;color:var(--text);display:flex;align-items:center;justify-content:center;border-radius:50%}
.pHead h2{margin:0}
.pHead h2::before{display:none}
.pBody{padding:16px}
.pCard{background:var(--card);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:var(--shadow)}
.pCard h3{margin:0 0 8px;font-size:1rem}
.pCard p{margin:6px 0;line-height:1.5}
.pRow{display:flex;justify-content:space-between;gap:12px;padding:6px 0}
.pOpts{display:flex;gap:8px}
.pOpts button{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-weight:600}
.pOpts button.on{background:var(--accent2);border-color:var(--accent2);color:#fff}
.pDanger{background:var(--danger);color:#fff;border:0;border-radius:12px;width:100%}
`;
document.head.appendChild(sStyle);

function mkEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---- Theme ----
// Theme: "light" (default, the existing look) or "dark" (charcoal). Anything else, including the
// old "system" value, is treated as light. Changing it only flips a CSS attribute: no reload.
const THEME_COLORS = { light: "#FFFFFF", dark: "#1C1C1E" };
function applyTheme(v) {
  v = v === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", v);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", THEME_COLORS[v]);
  document.dispatchEvent(new CustomEvent("themechange", { detail: v }));
}
function getTheme() {
  try { return localStorage.getItem("sp_theme") === "dark" ? "dark" : "light"; } catch (e) { return "light"; }
}
function setTheme(v) {
  v = v === "dark" ? "dark" : "light";
  try { localStorage.setItem("sp_theme", v); } catch (e) {}
  applyTheme(v);
}
applyTheme(getTheme());

// ---- Header menu button ----
const menuBtn = document.createElement("button");
menuBtn.type = "button";
menuBtn.id = "menuBtn";
menuBtn.setAttribute("aria-label", "Open menu");
menuBtn.innerHTML = svgIcon("menu");
const hdr = document.querySelector("header");
const brand = mkEl("div", "brand");
brand.appendChild(menuBtn);
brand.appendChild(hdr.querySelector("h1"));
hdr.insertBefore(brand, hdr.firstChild);

// ---- Drawer ----
const drawerBg = mkEl("div");
drawerBg.id = "drawerBg";
const drawer = mkEl("aside");
drawer.id = "drawer";

function openDrawer() { drawer.classList.add("open"); drawerBg.classList.add("open"); }
function closeDrawer() { drawer.classList.remove("open"); drawerBg.classList.remove("open"); }
menuBtn.onclick = openDrawer;
drawerBg.onclick = closeDrawer;

const dHead = mkEl("div", "dHead");
dHead.append(mkEl("strong", "", "SalaryPlan"), mkEl("span", "", "Monthly budgeting for salary earners"));
drawer.appendChild(dHead);

// ---- Full-screen page sheet ----
const pageDlg = mkEl("dialog");
pageDlg.id = "pageDlg";
const pHead = mkEl("div", "pHead");
const pBack = document.createElement("button");
pBack.type = "button";
pBack.setAttribute("aria-label", "Back");
pBack.innerHTML = svgIcon("back");
pBack.onclick = () => pageDlg.close();
const pTitle = mkEl("h2");
pHead.append(pBack, pTitle);
const pBody = mkEl("div", "pBody");
pageDlg.append(pHead, pBody);
document.body.appendChild(pageDlg);

function openPage(title, build) {
  pTitle.textContent = title;
  pBody.innerHTML = "";
  build(pBody);
  closeDrawer();
  if (!pageDlg.open) pageDlg.showModal();
  pageDlg.scrollTop = 0;
}

function card(parent, heading, paragraphs) {
  const c = mkEl("div", "pCard");
  if (heading) c.appendChild(mkEl("h3", "", heading));
  (paragraphs || []).forEach(t => c.appendChild(mkEl("p", "", t)));
  parent.appendChild(c);
  return c;
}

// ---- Pages ----
function settingsPage(body) {
  const t = card(body, "Appearance", []);
  const opts = mkEl("div", "pOpts");
  [["light", "Light"], ["dark", "Dark"]].forEach(o => {
    const b = mkEl("button", getTheme() === o[0] ? "on" : "", o[1]);
    b.type = "button";
    b.onclick = () => { setTheme(o[0]); openPage("Settings", settingsPage); };
    opts.appendChild(b);
  });
  t.appendChild(opts);

  const bal = card(body, "Balance", []);
  const bopts = mkEl("div", "pOpts");
  [[false, "Show"], [true, "Hide"]].forEach(o => {
    const b = mkEl("button", hideBal === o[0] ? "on" : "", o[1]);
    b.type = "button";
    b.onclick = () => {
      hideBal = o[0];
      try { localStorage.setItem("sp_hide", hideBal ? "1" : "0"); } catch (e) {}
      applyHide();
      openPage("Settings", settingsPage);
    };
    bopts.appendChild(b);
  });
  bal.appendChild(bopts);

  const cur = card(body, "Currency", []);
  const row = mkEl("div", "pRow");
  row.append(mkEl("span", "", "Currency"), mkEl("strong", "", "Nigerian naira (₦)"));
  cur.appendChild(row);

  const ref = card(body, "App files", [
    "If the app looks out of date after an update, refresh its saved files. Your budget data is not touched."
  ]);
  const rb = mkEl("button", "secondary", "Refresh app files");
  rb.type = "button";
  rb.onclick = () => {
    const done = () => location.reload();
    const clear = () => (window.caches
      ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
      : Promise.resolve());
    const regs = navigator.serviceWorker
      ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
      : Promise.resolve();
    regs.then(clear).then(done, done);
  };
  ref.appendChild(rb);

  const dz = card(body, "Erase data", [
    "Deletes every transaction, budget, bill and savings goal on this phone. Export a backup first if you might need it."
  ]);
  const eb = mkEl("button", "pDanger", "Erase all my data");
  eb.type = "button";
  eb.style.minHeight = "48px";
  eb.onclick = () => {
    if (!confirm("Erase ALL your SalaryPlan data on this phone? This cannot be undone.")) return;
    if (!confirm("Last chance: really erase everything?")) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };
  dz.appendChild(eb);
}

function backupPage(body) {
  const c = card(body, "Backup and restore", [
    "Your data lives only on this phone. If you uninstall the app or clear browser data, it is lost.",
    "Export a backup file regularly and keep it somewhere safe, such as your email or Google Drive. Import it to restore everything."
  ]);
  const e = mkEl("button", "primary", "Export backup");
  e.type = "button";
  e.onclick = () => $("exportBtn").click();
  const i = mkEl("button", "secondary", "Import backup");
  i.type = "button";
  i.style.marginLeft = "8px";
  i.onclick = () => $("importFile").click();
  c.append(e, i);
}

function helpPage(body) {
  card(body, "Add money in and out", [
    "Tap the + button, or the Add income and Add expense tiles on Home. Fill in the amount, date and category, then save."
  ]);
  card(body, "Pick a month", [
    "The month box at the top changes everything you see: balance, budget, bills, savings and reports."
  ]);
  card(body, "Plan your budget", [
    "In the Budget tab, set a planned amount for each category. Tap Items to list prices, like rice or beans under Food. Plans never change your cash balance."
  ]);
  card(body, "Bills and savings", [
    "Bills repeat every month. Mark a bill paid and it becomes a real expense. Savings contributions are set aside and are not counted as spending."
  ]);
  card(body, "Reports", [
    "The Reports tab shows your income and expenditure, budget against actual spending, and lets you download CSV files."
  ]);
}

function privacyPage(body) {
  card(body, "Your data stays on this phone", [
    "SalaryPlan stores everything in this phone's browser storage. Nothing is sent to a server.",
    "There are no accounts, no ads and no tracking. The app never asks for bank logins or card details.",
    "Only you can see your data. If you share a backup or CSV file, whoever has that file can read it."
  ]);
}

function aboutPage(body) {
  card(body, "SalaryPlan", [
    "A simple, private monthly budgeting app for salary earners. Plan your income, budget your money, track expenses and bills, and reach your savings goals."
  ]);
  const v = card(body, "", []);
  const row = mkEl("div", "pRow");
  row.append(mkEl("span", "", "Version"), mkEl("strong", "", APP_VERSION));
  v.appendChild(row);
  const row2 = mkEl("div", "pRow");
  row2.append(mkEl("span", "", "Currency"), mkEl("strong", "", "Nigerian naira (₦)"));
  v.appendChild(row2);
}

// ---- Menu items ----
[
  ["Settings", "sliders", () => openPage("Settings", settingsPage)],
  ["Backup and restore", "backup", () => openPage("Backup and restore", backupPage)],
  ["How to use", "help", () => openPage("How to use", helpPage)],
  ["Privacy and data", "shield", () => openPage("Privacy and data", privacyPage)],
  ["About", "info", () => openPage("About", aboutPage)]
].forEach(it => {
  const b = mkEl("button", "dItem");
  b.type = "button";
  const ic = mkEl("span", "ic");
  ic.innerHTML = svgIcon(it[1]);
  b.append(ic, mkEl("span", "", it[0]));
  b.onclick = it[2];
  drawer.appendChild(b);
});

drawer.appendChild(mkEl("div", "dFoot", "SalaryPlan version " + APP_VERSION));
document.body.append(drawerBg, drawer);
