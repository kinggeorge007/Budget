"use strict";
// SalaryPlan Stage 12: quick-action tiles, line icons and a hide/show balance button.

const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  budget: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  bills: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  savings: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  plus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  minus: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  backup: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
};
function svgIcon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
}

// ---- Tab bar: replace emoji with line icons ----
["home", "budget", "bills", "savings", "reports"].forEach(id => {
  const s = tabButtons[id].firstChild;
  s.className = "tabIc";
  s.innerHTML = svgIcon(id);
});

// ---- Quick action tiles ----
function openAdd(type) {
  $("type").value = type;
  $("type").dispatchEvent(new Event("change"));
  fab.onclick();
}

const TILES = [
  ["Add income", "plus", () => openAdd("income")],
  ["Add expense", "minus", () => openAdd("expense")],
  ["Bills", "bills", () => showTab("bills")],
  ["Savings", "savings", () => showTab("savings")],
  ["Budget", "budget", () => showTab("budget")],
  ["Reports", "reports", () => showTab("reports")],
  ["Backup", "backup", () => {
    showTab("reports");
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 60);
  }],
  ["History", "list", () => {
    showTab("home");
    setTimeout(() => $("list").closest("section").scrollIntoView(), 60);
  }]
];

const qa = document.createElement("section");
qa.className = "qa";
TILES.forEach(t => {
  const b = document.createElement("button");
  b.type = "button";
  const ic = document.createElement("span");
  ic.className = "ic";
  ic.innerHTML = svgIcon(t[1]);
  const label = document.createElement("span");
  label.textContent = t[0];
  b.append(ic, label);
  b.onclick = t[2];
  qa.appendChild(b);
});
document.querySelector(".cards").after(qa);
qa.style.display = tabButtons.home.className === "on" ? "" : "none";
TABS[0].parts.push(qa);

// ---- Hide / show balance ----
const MASK = "₦ ****";
let hideBal = false;
try { hideBal = localStorage.getItem("sp_hide") === "1"; } catch (e) {}

const eyeBtn = document.createElement("button");
eyeBtn.type = "button";
eyeBtn.id = "eyeBtn";
eyeBtn.setAttribute("aria-label", "Show or hide balance");
document.querySelector(".card.wide").appendChild(eyeBtn);

function applyHide() {
  const el = $("sumBalance");
  if (el.textContent !== MASK) el.dataset.real = el.textContent;
  el.textContent = hideBal ? MASK : (el.dataset.real || el.textContent);
  $("openNote").style.visibility = hideBal ? "hidden" : "visible";
  eyeBtn.innerHTML = svgIcon(hideBal ? "eyeOff" : "eye");
}

eyeBtn.onclick = () => {
  hideBal = !hideBal;
  try { localStorage.setItem("sp_hide", hideBal ? "1" : "0"); } catch (e) {}
  applyHide();
};

const renderBeforeHome = render;
render = function () { renderBeforeHome(); applyHide(); };
$("month").addEventListener("change", applyHide);

applyHide();
