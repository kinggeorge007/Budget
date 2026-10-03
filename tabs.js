"use strict";
// SalaryPlan Stage 9: bottom tab navigation. Shows one group of sections at a time.

const TABS = [
  { id: "home", label: "Home", icon: "🏠",
    parts: [document.querySelector(".cards"), $("txForm").closest("section"), $("list").closest("section")] },
  { id: "budget", label: "Budget", icon: "📊", parts: [bSection] },
  { id: "bills", label: "Bills", icon: "🧾", parts: [billSection] },
  { id: "savings", label: "Savings", icon: "🎯", parts: [goalSection] },
  { id: "reports", label: "Reports", icon: "📈",
    parts: [rSection, $("exportBtn").closest("section")] }
];

const tabStyle = document.createElement("style");
tabStyle.textContent =
  "main{padding-bottom:92px}" +
  "#tabBar{position:fixed;left:0;right:0;bottom:0;z-index:10;display:flex;background:var(--card);border-top:1px solid var(--line);box-shadow:0 -2px 10px rgba(0,0,0,.12)}" +
  "#tabBar button{flex:1;min-height:58px;background:transparent;color:var(--muted);border:0;border-radius:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:.7rem;font-weight:600;padding:6px 0}" +
  "#tabBar button span{font-size:1.25rem;line-height:1}" +
  "#tabBar button.on{color:var(--accent)}";
document.head.appendChild(tabStyle);

const tabBar = document.createElement("nav");
tabBar.id = "tabBar";
const tabButtons = {};

TABS.forEach(t => {
  const b = document.createElement("button");
  b.type = "button";
  const icon = document.createElement("span");
  icon.textContent = t.icon;
  const label = document.createElement("div");
  label.textContent = t.label;
  b.append(icon, label);
  b.onclick = () => showTab(t.id);
  tabButtons[t.id] = b;
  tabBar.appendChild(b);
});
document.body.appendChild(tabBar);

function showTab(id) {
  TABS.forEach(t => {
    t.parts.forEach(p => { p.style.display = t.id === id ? "" : "none"; });
    tabButtons[t.id].className = t.id === id ? "on" : "";
  });
  try { sessionStorage.setItem("sp_tab", id); } catch (e) {}
  window.scrollTo(0, 0);
}

let startTab = "home";
try {
  const saved = sessionStorage.getItem("sp_tab");
  if (saved && tabButtons[saved]) startTab = saved;
} catch (e) {}
showTab(startTab);
