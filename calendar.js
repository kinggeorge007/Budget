"use strict";
// SalaryPlan: calendar (bills, income, savings, goals and your own events) with
// "Add to phone calendar" (.ics file or Google Calendar link).
// Your own events live at data.budgets._events so backups carry them.

ICONS.calendar = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>';

function cleanEvents(a) {
  if (!Array.isArray(a)) return [];
  return a
    .filter(x => x && typeof x.id === "string" && typeof x.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.date))
    .map(x => ({
      id: x.id, title: x.title.slice(0, 100), date: x.date,
      time: /^\d{2}:\d{2}$/.test(x.time || "") ? x.time : "",
      amount: Number.isInteger(x.amount) && x.amount > 0 ? x.amount : 0,
      note: typeof x.note === "string" ? x.note.slice(0, 300) : "",
      remind: ["none", "0", "15", "60", "1440"].includes(String(x.remind)) ? String(x.remind) : "none",
      repeat: x.repeat === "monthly" ? "monthly" : "none",
      seq: Number.isInteger(x.seq) && x.seq >= 0 ? x.seq : 0
    }));
}
const baseCleanBudgets3 = cleanBudgets;
cleanBudgets = function (b) {
  const out = baseCleanBudgets3(b);
  out._events = cleanEvents(b && b._events);
  return out;
};
function getEvents() {
  if (!data.budgets) data.budgets = {};
  if (!Array.isArray(data.budgets._events)) data.budgets._events = [];
  return data.budgets._events;
}

const calStyle = document.createElement("style");
calStyle.textContent = `
.calNav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.calNav button{min-height:44px;padding:0 14px}
.calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.calHd{text-align:center;color:var(--muted);font-size:.75rem;padding:4px 0}
.calDay{min-height:54px;padding:5px 0;border:0;border-radius:12px;background:var(--card);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;font-weight:600}
.calDay.today{outline:2px solid var(--accent2)}
.calDay.sel{background:var(--accent2);color:#fff}
.calDots{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;max-width:36px}
.cdot{width:7px;height:7px;border-radius:50%;display:inline-block}
.k-paid{background:#00b36b}.k-overdue{background:#e0454b}.k-upcoming{background:#e0a100}.k-unpaid{background:#7a8c99}
.k-income{background:#14b8a6}.k-expense{background:#8b5cf6}.k-saving{background:#3b82f6}.k-goal{background:#ec4899}.k-event{background:#0ea5e9}
.calLegend{display:flex;flex-wrap:wrap;gap:10px;font-size:.75rem;color:var(--muted);margin:10px 0}
.calItem{background:var(--card);border-radius:14px;box-shadow:var(--shadow);padding:12px 14px;margin-bottom:8px}
.calItem .row{display:flex;justify-content:space-between;gap:8px;align-items:center}
.chip{font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 9px;color:#fff;white-space:nowrap}
.calItem small{color:var(--muted)}
`;
document.head.appendChild(calStyle);

let calMonth = "", calSel = "";
const KIND_TXT = { bill: "Bill", income: "Income received", expense: "Spent", saving: "Saved", goal: "Savings goal", event: "Event" };
const STATUS_TXT = { paid: "Paid", overdue: "Overdue", upcoming: "Due soon", unpaid: "Unpaid" };

function shiftMonth(m, n) {
  const p = m.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1 + n, 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}
function wsTag() { return typeof wsActiveId !== "undefined" ? wsActiveId : "personal"; }
function wsName() { return typeof wsLabel === "function" ? wsLabel() : "Personal"; }

// One date for each occurrence of a repeating event in a month. Nothing is copied or stored per month.
function evOccurs(ev, month) {
  const m0 = ev.date.slice(0, 7);
  if (month === m0) return ev.date;
  if (ev.repeat === "monthly" && month > m0) return dueDate(month, Number(ev.date.slice(8, 10)));
  return null;
}

// Everything for a month, read live from bills, transactions, savings and events.
function monthItems(month) {
  const map = {};
  const add = (d, it) => { (map[d] = map[d] || []).push(it); };
  ensureBills();
  data.bills.filter(b => b.active).forEach(b => {
    const d = dueDate(month, b.dueDay);
    const txId = paidTxId(month, b.id);
    let status = "unpaid", amount = b.amount;
    if (txId) { status = "paid"; amount = data.transactions.find(t => t.id === txId).amount; }
    else { const n = daysUntil(d); status = n < 0 ? "overdue" : n <= 7 ? "upcoming" : "unpaid"; }
    add(d, { kind: "bill", title: b.name, amount: amount, status: status, bill: b });
  });
  data.transactions.forEach(t => {
    if (!t.date.startsWith(month)) return;
    if (t.type === "income") add(t.date, { kind: "income", title: t.category, amount: t.amount, time: t.time });
    else if (!isBillPayment(t.id)) add(t.date, { kind: "expense", title: t.category, amount: t.amount, time: t.time });
  });
  (data.goals || []).forEach(g => {
    g.contribs.forEach(c => { if (c.date.startsWith(month)) add(c.date, { kind: "saving", title: g.name, amount: c.amount }); });
    if (g.deadline.startsWith(month)) add(g.deadline, { kind: "goal", title: g.name + " deadline", amount: 0 });
  });
  getEvents().forEach(ev => {
    const d = evOccurs(ev, month);
    if (d) add(d, { kind: "event", title: ev.title, amount: ev.amount, time: ev.time, ev: ev });
  });
  return map;
}

// ---- Calendar files (.ics) ----
function icsEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function icsFold(line) {
  const out = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); }
  out.push(s);
  return out.join("\r\n");
}
function compact(d) { return d.replace(/-/g, ""); }
function localStamp(y, m, d, hh, mm) { return y + pad2(m) + pad2(d) + "T" + pad2(hh) + pad2(mm) + "00"; }
function endOf(o) {
  const p = o.date.split("-").map(Number);
  if (o.time) {
    const t = o.time.split(":").map(Number);
    const e = new Date(p[0], p[1] - 1, p[2], t[0], t[1] + 30);
    return { timed: true, v: localStamp(e.getFullYear(), e.getMonth() + 1, e.getDate(), e.getHours(), e.getMinutes()) };
  }
  const e = new Date(p[0], p[1] - 1, p[2] + 1);
  return { timed: false, v: e.getFullYear() + pad2(e.getMonth() + 1) + pad2(e.getDate()) };
}
const TRIG_TIMED = { "0": "PT0S", "15": "-PT15M", "60": "-PT1H", "1440": "-P1D" };
const TRIG_DAY = { "0": "PT9H", "15": "PT8H45M", "60": "PT8H", "1440": "-PT15H" };

function buildIcs(o) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = endOf(o);
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SalaryPlan//Budget//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", "UID:" + o.uid, "DTSTAMP:" + now, "SEQUENCE:" + o.seq, "SUMMARY:" + icsEscape(o.title)];
  if (o.desc) L.push("DESCRIPTION:" + icsEscape(o.desc));
  if (o.time) {
    const t = o.time.split(":");
    L.push("DTSTART:" + compact(o.date) + "T" + t[0] + t[1] + "00", "DTEND:" + end.v);
  } else {
    L.push("DTSTART;VALUE=DATE:" + compact(o.date), "DTEND;VALUE=DATE:" + end.v);
  }
  if (o.repeat === "monthly") L.push("RRULE:FREQ=MONTHLY");
  if (o.remind !== "none") {
    const trig = (o.time ? TRIG_TIMED : TRIG_DAY)[o.remind];
    L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(o.title), "TRIGGER:" + trig, "END:VALARM");
  }
  L.push("END:VEVENT", "END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}

function downloadIcs(o) {
  const blob = new Blob([buildIcs(o)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "salaryplan-" + o.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) + ".ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function gcalUrl(o) {
  const end = endOf(o);
  const p = new URLSearchParams({ action: "TEMPLATE", text: o.title, details: o.desc || "" });
  if (o.time) {
    const t = o.time.split(":");
    p.set("dates", compact(o.date) + "T" + t[0] + t[1] + "00/" + end.v);
  } else {
    p.set("dates", compact(o.date) + "/" + end.v);
  }
  if (o.repeat === "monthly") p.set("recur", "RRULE:FREQ=MONTHLY");
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

function descOf(note, amount) {
  return "SalaryPlan (" + wsName() + ")" + (amount ? ". Amount: " + formatKobo(amount) : "") + (note ? ". " + note : "");
}
function evObj(ev) {
  return { uid: wsTag() + "-ev-" + ev.id + "@salaryplan", seq: ev.seq, title: ev.title, desc: descOf(ev.note, ev.amount),
    date: ev.date, time: ev.time, remind: ev.remind, repeat: ev.repeat };
}
function billObj(b, date) {
  return { uid: wsTag() + "-bill-" + b.id + "@salaryplan", seq: Math.floor(Date.now() / 1000), title: "Pay " + b.name,
    desc: descOf("Due day " + b.dueDay + " each month", b.amount), date: date, time: "", remind: "1440", repeat: "monthly" };
}
function remindText(o) {
  if (o.remind === "none") return "No reminder";
  const t = { "0": "At the time", "15": "15 minutes before", "60": "1 hour before", "1440": "1 day before" };
  const d = { "0": "9:00 am on the day", "15": "8:45 am on the day", "60": "8:00 am on the day", "1440": "9:00 am the day before" };
  return (o.time ? t : d)[o.remind];
}

function cb(text, cls, fn) {
  const b = mkEl("button", cls, text);
  b.type = "button";
  b.onclick = fn;
  return b;
}

function phonePage(body, o) {
  card(body, o.title, [
    "Date: " + niceDate(o.date) + (o.time ? " " + niceTime(o.time) : " (all day)") + (o.repeat === "monthly" ? ", repeats every month" : ""),
    "Reminder: " + remindText(o)
  ]);
  const c = card(body, "Add to your phone calendar", [
    "Tap the first button, then open the downloaded file and choose your Calendar app. Your calendar will ask before it adds the event."
  ]);
  c.appendChild(cb("Download calendar file (.ics)", "primary", () => downloadIcs(o)));
  const g = cb("Open in Google Calendar", "secondary", () => window.open(gcalUrl(o), "_blank"));
  g.style.marginTop = "8px";
  c.appendChild(g);
  card(body, "Good to know", [
    "A web app cannot write straight into your phone's calendar. It can only hand over a file or a link, and you approve it.",
    "Each event has a fixed ID. If you edit it here and download the file again, most calendar apps update the same event instead of adding a copy. Google Calendar's link always creates a new event, so use the file to avoid duplicates.",
    "Reminders ring from your calendar app, even when SalaryPlan is closed. SalaryPlan itself cannot ring while it is closed."
  ]);
  const back = cb("Back to calendar", "secondary", () => openPage("Calendar", calendarPage));
  back.style.marginTop = "8px";
  body.appendChild(back);
}

function eventForm(body, id, dateDefault) {
  const ev = id ? getEvents().find(x => x.id === id) : null;
  const mk = (type, val, ph) => { const i = document.createElement("input"); i.type = type; if (val) i.value = val; if (ph) i.placeholder = ph; return i; };
  const lab = (t, el) => { const l = mkEl("label", "", t); l.appendChild(el); l.style.marginBottom = "10px"; return l; };
  const titleIn = mk("text", ev ? ev.title : "", "e.g. Pay school fees");
  titleIn.maxLength = 100;
  const dateIn = mk("date", ev ? ev.date : dateDefault);
  const timeIn = mk("time", ev ? ev.time : "");
  const amtIn = mk("number", ev && ev.amount ? (ev.amount / 100).toFixed(2) : "", "Amount (optional)");
  amtIn.step = "0.01"; amtIn.min = "0"; amtIn.inputMode = "decimal";
  const noteIn = mk("text", ev ? ev.note : "", "Note (optional)");
  noteIn.maxLength = 300;
  const rem = document.createElement("select");
  [["none", "No reminder"], ["0", "At the time (9:00 am if no time)"], ["15", "15 minutes before"], ["60", "1 hour before"], ["1440", "1 day before"]]
    .forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; rem.appendChild(op); });
  rem.value = ev ? ev.remind : "none";
  const rep = document.createElement("select");
  [["none", "Does not repeat"], ["monthly", "Repeats every month"]]
    .forEach(o => { const op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; rep.appendChild(op); });
  rep.value = ev ? ev.repeat : "none";
  body.append(lab("Title", titleIn), lab("Date", dateIn), lab("Time (optional)", timeIn), lab("Amount", amtIn),
    lab("Reminder", rem), lab("Repeat", rep), lab("Note", noteIn));

  const bar = mkEl("div", "nBar");
  bar.append(
    cb("Save", "primary", () => {
      const title = titleIn.value.trim();
      if (!title) { alert("Please enter a title."); return; }
      if (!dateIn.value) { alert("Please choose a date."); return; }
      const rec = { title: title.slice(0, 100), date: dateIn.value, time: timeIn.value, amount: toKobo(amtIn.value),
        note: noteIn.value.trim().slice(0, 300), remind: rem.value, repeat: rep.value };
      if (ev) { Object.assign(ev, rec); ev.seq = (ev.seq || 0) + 1; }
      else getEvents().push(Object.assign({ id: newId(), seq: 0 }, rec));
      saveData();
      calMonth = rec.date.slice(0, 7);
      calSel = rec.date;
      openPage("Calendar", calendarPage);
    }),
    cb("Cancel", "secondary", () => openPage("Calendar", calendarPage))
  );
  body.appendChild(bar);
  if (ev) {
    const del = cb("Delete event", "secondary", () => {
      if (!confirm("Delete this event?")) return;
      data.budgets._events = getEvents().filter(x => x.id !== ev.id);
      saveData();
      openPage("Calendar", calendarPage);
    });
    del.style.cssText = "width:100%;margin-top:10px;color:var(--danger)";
    body.appendChild(del);
  }
}

function itemRow(it, date) {
  const r = mkEl("div", "calItem");
  const top = mkEl("div", "row");
  const left = mkEl("div");
  left.appendChild(mkEl("strong", "", (it.time ? niceTime(it.time) + " " : "") + it.title));
  left.appendChild(mkEl("div", "", ""));
  left.lastChild.appendChild(mkEl("small", "", KIND_TXT[it.kind] + (it.amount ? " · " + formatKobo(it.amount) : "")));
  top.appendChild(left);
  if (it.kind === "bill") {
    const chip = mkEl("span", "chip k-" + it.status, STATUS_TXT[it.status]);
    top.appendChild(chip);
  }
  r.appendChild(top);
  const bar = mkEl("div", "nBar");
  if (it.kind === "bill") {
    bar.append(
      cb("Open Bills", "secondary", () => { pageDlg.close(); showTab("bills"); }),
      cb("Add to phone calendar", "secondary", () => openPage("Add to phone calendar", b => phonePage(b, billObj(it.bill, date))))
    );
    r.appendChild(bar);
  } else if (it.kind === "event") {
    bar.append(
      cb("Edit", "secondary", () => openPage("Edit event", b => eventForm(b, it.ev.id, it.ev.date))),
      cb("Add to phone calendar", "secondary", () => openPage("Add to phone calendar", b => phonePage(b, evObj(it.ev))))
    );
    r.appendChild(bar);
  }
  return r;
}

function calendarPage(body) {
  if (!calMonth) calMonth = $("month").value || today().slice(0, 7);
  if (!calSel || calSel.slice(0, 7) !== calMonth) calSel = today().slice(0, 7) === calMonth ? today() : calMonth + "-01";
  const items = monthItems(calMonth);

  const nav = mkEl("div", "calNav");
  nav.append(
    cb("‹", "secondary", () => { calMonth = shiftMonth(calMonth, -1); openPage("Calendar", calendarPage); }),
    mkEl("strong", "", monthLabel(calMonth)),
    cb("›", "secondary", () => { calMonth = shiftMonth(calMonth, 1); openPage("Calendar", calendarPage); })
  );
  const todayBtn = cb("Today", "secondary", () => { calMonth = today().slice(0, 7); calSel = today(); openPage("Calendar", calendarPage); });
  todayBtn.style.cssText = "width:100%;margin-bottom:10px";
  body.append(nav, todayBtn);

  const grid = mkEl("div", "calGrid");
  ["S", "M", "T", "W", "T", "F", "S"].forEach(d => grid.appendChild(mkEl("div", "calHd", d)));
  const p = calMonth.split("-").map(Number);
  const first = new Date(p[0], p[1] - 1, 1).getDay();
  for (let i = 0; i < first; i++) grid.appendChild(mkEl("div"));
  const cells = {};
  const days = new Date(p[0], p[1], 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = calMonth + "-" + pad2(d);
    const c = mkEl("button", "calDay" + (date === today() ? " today" : ""), String(d));
    c.type = "button";
    const dots = mkEl("div", "calDots");
    const seen = [];
    (items[date] || []).forEach(it => {
      const k = it.kind === "bill" ? it.status : it.kind;
      if (!seen.includes(k) && seen.length < 4) { seen.push(k); dots.appendChild(mkEl("span", "cdot k-" + k)); }
    });
    c.appendChild(dots);
    c.onclick = () => { calSel = date; drawDay(); };
    cells[date] = c;
    grid.appendChild(c);
  }
  body.appendChild(grid);

  const legend = mkEl("div", "calLegend");
  [["paid", "Paid"], ["upcoming", "Due soon"], ["overdue", "Overdue"], ["unpaid", "Unpaid bill"], ["income", "Income"],
    ["expense", "Spent"], ["saving", "Saved"], ["goal", "Goal"], ["event", "Event"]].forEach(l => {
    const s = mkEl("span");
    s.append(mkEl("span", "cdot k-" + l[0]), document.createTextNode(" " + l[1]));
    legend.appendChild(s);
  });
  body.appendChild(legend);

  const listBox = mkEl("div");
  body.appendChild(listBox);

  function drawDay() {
    Object.keys(cells).forEach(d => cells[d].classList.toggle("sel", d === calSel));
    listBox.innerHTML = "";
    const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(calSel + "T00:00:00").getDay()];
    listBox.appendChild(mkEl("h3", "", wd + " " + niceDate(calSel)));
    const arr = items[calSel] || [];
    if (!arr.length) listBox.appendChild(mkEl("p", "muted", "Nothing scheduled on this day."));
    arr.forEach(it => listBox.appendChild(itemRow(it, calSel)));
    const add = cb("Add event on this day", "primary", () => openPage("New event", b => eventForm(b, null, calSel)));
    add.style.cssText = "width:100%;margin-top:8px";
    listBox.appendChild(add);
  }
  drawDay();
  card(body, "Phone calendar and reminders", [
    "Bills, income, savings and goals show up here automatically from your records. Your own events are saved on this phone.",
    "SalaryPlan can't ring while it is closed. For reminders that do, use Add to phone calendar on a bill or event."
  ]);
}

// ---- Home tile and menu item ----
(function () {
  const b = document.createElement("button");
  b.type = "button";
  const ic = mkEl("span", "ic");
  ic.innerHTML = svgIcon("calendar");
  b.append(ic, mkEl("span", "", "Calendar"));
  b.onclick = () => openPage("Calendar", calendarPage);
  qa.appendChild(b);

  const item = mkEl("button", "dItem");
  item.type = "button";
  const mi = mkEl("span", "ic");
  mi.innerHTML = svgIcon("calendar");
  item.append(mi, mkEl("span", "", "Calendar"));
  item.onclick = () => openPage("Calendar", calendarPage);
  drawer.insertBefore(item, drawer.querySelectorAll(".dItem")[2] || drawer.querySelector(".dFoot"));
})();
