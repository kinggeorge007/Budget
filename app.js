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
function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function niceDate(iso) { const p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
function niceTime(t) { // Stored as 24-hour HH:MM, shown as 12-hour.
  const p = t.split(":");
  const h = Number(p[0]);
  return String(h % 1
