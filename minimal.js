"use strict";
// Budget: minimalist redesign. Rebrand, header, bottom navigation, More screen and small touches.
// Loaded last so it can adjust everything the other files built.

// ---- Logo: exact geometry measured from the chosen reference ----
function logoSvg(size) {
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 100 100");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("aria-hidden", "true");
  const rect = (x, y, w, h, rx, fill) => {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("rx", rx); r.setAttribute("fill", fill);
    s.appendChild(r);
  };
  rect(0, 0, 100, 100, 31, "#212121");
  [[17.48, 27.97, 17.22, 53.36], [40.90, 17.81, 16.62, 63.52], [63.98, 37.86, 16.62, 43.14]]
    .forEach(b => rect(b[0], b[1], b[2], b[3], b[2] / 2, "#fff"));
  return s;
}

// ---- Icons added for the new navigation ----
ICONS.plus2 = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
ICONS.more = '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>';
ICONS.star = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
ICONS.trend = '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>';

// ---- Brand text: SalaryPlan becomes Budget on screen. Internal names and stored data are untouched. ----
const BRAND_MAP = [
  [/Monthly budgeting for salary earners/g, "Simple budgeting for people and businesses"],
  [/A simple, private monthly budgeting app for salary earners\./g, "A simple, private budgeting app for individuals, households, freelancers and businesses."],
  [/for salary earners/g, "for individuals and businesses"],
  [/SalaryPlan/g, "Budget"]
];
function brandText(s) { return typeof s === "string" ? BRAND_MAP.reduce((t, m) => t.replace(m[0], m[1]), s) : s; }

["alert", "confirm", "prompt"].forEach(k => {
  const f = window[k].bind(window);
  window[k] = (m, d) => f(brandText(m), d);
});

const BRAND_SKIP = ".nText,.nItem,.meta,.info,.hxItem,.chItem";
function sweepBrand() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeValue.indexOf("SalaryPlan") > -1 || n.nodeValue.indexOf("salary earners") > -1) hits.push(n);
  }
  hits.forEach(t => {
    const p = t.parentElement;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName) || p.closest(BRAND_SKIP)) return;
    t.nodeValue = brandText(t.nodeValue);
  });
  document.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(e => {
    ["placeholder", "aria-label", "title", "alt"].forEach(a => {
      const v = e.getAttribute(a);
      if (v && v.indexOf("SalaryPlan") > -1) e.setAttribute(a, brandText(v));
    });
  });
  document.title = brandText(document.title);
}
let brandTimer = null;
new MutationObserver(() => { clearTimeout(brandTimer); brandTimer = setTimeout(sweepBrand, 60); })
  .observe(document.body, { childList: true, subtree: true });

// Calendar files say Budget too (their internal IDs keep the old name so nothing duplicates).
const baseDescOf = descOf;
descOf = function (n, a) { return brandText(baseDescOf(n, a)); };

// ---- Header: logo and name on the left, month and settings on the right ----
const hdr = document.querySelector("header");
const brandEl = hdr.querySelector(".brand");
if (brandEl && !brandEl.querySelector(".wsLogo")) {
  const lg = logoSvg(30);
  lg.classList.add("brandLogo");
  brandEl.insertBefore(lg, brandEl.querySelector("h1"));
}
const gear = document.createElement("button");
gear.type = "button";
gear.id = "gearBtn";
gear.setAttribute("aria-label", "Settings");
gear.innerHTML = svgIcon("sliders");
gear.onclick = () => openPage("Settings", settingsPage);
const hdrRight = document.createElement("div");
hdrRight.className = "hdrRight";
hdr.appendChild(hdrRight);
hdrRight.append($("month"), gear);

// ---- Bottom navigation: Home, Budget, +, Reports, More ----
tabButtons.bills.style.display = "none";
tabButtons.savings.style.display = "none";

const plusBtn = document.createElement("button");
plusBtn.type = "button";
plusBtn.className = "plusBtn";
plusBtn.setAttribute("aria-label", "Add transaction");
plusBtn.innerHTML = svgIcon("plus2");
plusBtn.onclick = () => fab.onclick();
tabBar.insertBefore(plusBtn, tabButtons.reports);

const moreBtn = document.createElement("button");
moreBtn.type = "button";
const moreIc = mkEl("span", "tabIc");
moreIc.innerHTML = svgIcon("more");
moreBtn.append(moreIc, mkEl("div", "", "More"));
moreBtn.onclick = () => openPage("More", morePage);
tabBar.appendChild(moreBtn);

const baseShowTab2 = showTab;
showTab = function (id) {
  baseShowTab2(id);
  moreBtn.classList.toggle("on", id === "bills" || id === "savings");
};

// ---- More screen: every secondary destination, listed once ----
function srcHandler(label) {
  const pools = [qa.querySelectorAll("button"), drawer.querySelectorAll(".dItem")];
  for (let p = 0; p < pools.length; p++) {
    const list = pools[p];
    for (let i = 0; i < list.length; i++) {
      const s = list[i].querySelector("span:not(.ic)");
      if (s && s.textContent === label && list[i].onclick) return list[i].onclick;
    }
  }
  return null;
}

function morePage(body) {
  const groups = [
    ["Money", [
      ["Income", "plus", () => openPage("Income", b => historyPage(b, "income"))],
      ["Expenses", "minus", () => openPage("Expenses", b => historyPage(b, "expense"))],
      ["Bills", "bills"], ["Savings", "savings"], ["Calendar", "calendar"]
    ]],
    ["Tools", [["Calculator", "calc"], ["Currency converter", "swap", "Converter"], ["Notes", "note"]]]
  ];
  if (typeof wsEntry !== "undefined" && wsEntry) {
    groups.push(["Business", [["Books", "list"], ["Business reports", "trend", "P&L"]]]);
  }
  groups.push(["App", [["Workspaces", "grid"], ["Settings", "sliders"], ["Security", "lock"],
    ["Backup and restore", "backup"], ["How to use", "help"], ["Privacy and data", "shield"],
    ["About", "info"], ["Welcome tour", "star"]]]);

  groups.forEach(g => {
    const rows = g[1].map(r => ({
      label: r[0], icon: r[1],
      fn: typeof r[2] === "function" ? r[2] : srcHandler(r[2] || r[0])
    })).filter(r => r.fn);
    if (!rows.length) return;
    body.appendChild(mkEl("div", "moreGrp", g[0]));
    rows.forEach(r => {
      const b = mkEl("button", "moreRow");
      b.type = "button";
      const ic = mkEl("span", "ic");
      ic.innerHTML = svgIcon(r.icon);
      b.append(ic, mkEl("span", "", r.label), mkEl("span", "chev", "›"));
      b.onclick = () => { pageDlg.close(); r.fn(); };
      body.appendChild(b);
    });
  });
}

// ---- Small colour dot beside each transaction, steady per category ----
const DOT_PAL = ["--accent-orange", "--accent-red", "--accent-green", "--accent-teal", "--accent-indigo"];
function dotVar(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOT_PAL[h % 5];
}
function addDots() {
  document.querySelectorAll("#list li .info strong").forEach(s => {
    if (s.querySelector(".cdt")) return;
    const d = document.createElement("span");
    d.className = "cdt";
    d.style.background = "var(" + dotVar(s.textContent) + ")";
    s.insertBefore(d, s.firstChild);
  });
}
new MutationObserver(addDots).observe($("list"), { childList: true });

// ---- Settings: the app is light only, so the Appearance card goes ----
const baseSettings3 = settingsPage;
settingsPage = function (body) {
  baseSettings3(body);
  Array.from(body.querySelectorAll(".pCard")).forEach(c => {
    const h = c.querySelector("h3");
    if (h && h.textContent === "Appearance") c.remove();
  });
};

// ---- Logo on the lock and welcome screens ----
const lockBrandEl = lockDlg.querySelector(".lockBrand");
if (lockBrandEl) {
  const lg2 = logoSvg(56);
  lg2.style.marginBottom = "12px";
  lockDlg.insertBefore(lg2, lockBrandEl);
}
const welLogoEl = document.querySelector(".welLogo");
if (welLogoEl) {
  welLogoEl.textContent = "";
  welLogoEl.appendChild(logoSvg(64));
}

// ---- The old Home charts are replaced by the new minimalist ones ----
const oldChartBody = document.getElementById("chartBody");
if (oldChartBody) {
  const oldSec = oldChartBody.parentElement;
  TABS[0].parts = TABS[0].parts.filter(p => p !== oldSec);
  oldSec.style.display = "none";
}

sweepBrand();
addDots();
