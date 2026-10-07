"use strict";
// SalaryPlan: notes with tappable links to items in the app.
// Notes are stored at data.budgets._notes so existing backups and imports carry them
// without changing app.js.

ICONS.note = '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>';

function cleanNotes(n) {
  if (!Array.isArray(n)) return [];
  return n
    .filter(x => x && typeof x.id === "string" && typeof x.text === "string")
    .map(x => ({
      id: x.id,
      title: typeof x.title === "string" ? x.title.slice(0, 100) : "",
      text: x.text.slice(0, 5000),
      created: typeof x.created === "string" ? x.created.slice(0, 40) : "",
      updated: typeof x.updated === "string" ? x.updated.slice(0, 40) : ""
    }));
}

// Make sure imports keep the notes.
const baseCleanBudgets = cleanBudgets;
cleanBudgets = function (b) {
  const out = baseCleanBudgets(b);
  out._notes = cleanNotes(b && b._notes);
  return out;
};

function getNotes() {
  if (!data.budgets) data.budgets = {};
  if (!Array.isArray(data.budgets._notes)) data.budgets._notes = [];
  return data.budgets._notes;
}

function fmtStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  return niceDate(day) + " " + niceTime(pad2(d.getHours()) + ":" + pad2(d.getMinutes()));
}

const nStyle = document.createElement("style");
nStyle.textContent = `
.nTop{margin-bottom:14px}
.nTop input{width:100%}
.nList{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;padding-bottom:96px}
.nItem{display:block;width:100%;text-align:left;color:var(--text);border:0;min-height:0}
.nItem .nHead{display:block;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nItem .nDate{color:var(--muted);font-size:.78rem;margin-top:2px}
.nItem .nPrev{color:var(--muted);font-size:.9rem;margin-top:8px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.nEmpty{text-align:center;padding:56px 12px 0}
.nEmpty strong{display:block;font-size:1.05rem;margin-bottom:6px}
.nFab{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:3;width:58px;height:58px;min-height:0;padding:0;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.28)}
.nFab svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-linecap:round}
.nTitle{margin:0 0 4px;font-size:1.3rem;font-weight:500;letter-spacing:-.01em;overflow-wrap:anywhere}
.nStamp{color:var(--muted);font-size:.8rem;margin-bottom:18px}
.nText{white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere}
.nHint{font-size:.8rem;margin-top:22px}
.nTitleIn{width:100%;font-size:1.3rem;font-weight:500}
.nSaved{color:var(--muted);font-size:.78rem;min-height:1.2em;margin:6px 0 10px}
.nArea{width:100%;min-height:46vh;line-height:1.6;font:inherit;resize:none}
.nBar{display:flex;gap:10px;margin-top:16px}
.nBar button{flex:1}
.nLink{display:inline;min-height:0;padding:0 5px;border:0;border-radius:6px;background:var(--mint);color:var(--accent);font:inherit;font-weight:700;text-decoration:underline}
#nChip{position:fixed;left:16px;bottom:78px;z-index:12;display:none;align-items:center;background:var(--accent2);color:#fff;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.35)}
#nChip button{background:transparent;color:#fff;border:0;min-height:48px;padding:0 14px;font-weight:700}
@keyframes nFlash{0%,60%{box-shadow:0 0 0 3px var(--accent2)}100%{box-shadow:var(--shadow)}}
.nFlash{animation:nFlash 2.4s ease-out}
`;
document.head.appendChild(nStyle);

// ---- Links from note text to items in the app ----
function linkTerms() {
  const map = {};
  const add = (term, target) => {
    const k = String(term || "").trim().toLowerCase();
    if (k.length >= 3 && !map[k]) map[k] = target;
  };
  // Most specific first, so they win over general words.
  const its = (data.budgets && data.budgets._items) || {};
  Object.keys(its).sort().reverse().forEach(m => {
    Object.keys(its[m]).forEach(cat => {
      its[m][cat].forEach(it => add(it.name, { tab: "budget", cat: cat }));
    });
  });
  CATEGORIES.expense.forEach(c => { if (c !== "Other") add(c, { tab: "budget", cat: c }); });
  (data.bills || []).forEach(b => add(b.name, { tab: "bills", name: b.name }));
  (data.goals || []).forEach(g => add(g.name, { tab: "savings", name: g.name }));
  add("budget", { tab: "budget" }); add("budgets", { tab: "budget" });
  add("bills", { tab: "bills" });
  add("savings", { tab: "savings" });
  add("report", { tab: "reports" }); add("reports", { tab: "reports" });
  return map;
}

function renderLinked(container, text, noteId) {
  const terms = linkTerms();
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  if (!keys.length) { container.textContent = text; return; }
  const alt = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp("(?<![\\p{L}\\p{N}])(" + alt + ")(?![\\p{L}\\p{N}])", "giu");
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
    const target = terms[m[1].toLowerCase()];
    if (target) {
      const b = mkEl("button", "nLink", m[1]);
      b.type = "button";
      b.onclick = () => followLink(target, noteId);
      container.appendChild(b);
    } else {
      container.appendChild(document.createTextNode(m[1]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
}

let nReturn = null;

const nChip = mkEl("div");
nChip.id = "nChip";
const nChipBack = mkEl("button", "", "← Back to note");
nChipBack.type = "button";
const nChipX = mkEl("button", "", "✕");
nChipX.type = "button";
nChipX.setAttribute("aria-label", "Dismiss");
nChip.append(nChipBack, nChipX);
document.body.appendChild(nChip);

function returnToNote() {
  const r = nReturn;
  nReturn = null;
  nChip.style.display = "none";
  if (!r) return;
  if (getNotes().some(n => n.id === r.id)) openPage("Note", b => noteView(b, r.id));
  else openPage("Notes", notesPage);
}

nChipBack.onclick = () => {
  if (history.state && history.state.spNote) history.back();
  else returnToNote();
};
nChipX.onclick = () => { nReturn = null; nChip.style.display = "none"; };
window.addEventListener("popstate", () => { if (nReturn) returnToNote(); });

function focusTarget(t) {
  const find = (sel, name) => Array.from(document.querySelectorAll(sel)).find(r => {
    const s = r.querySelector("strong");
    return s && s.textContent === name;
  });
  let row = null;
  if (t.tab === "budget" && t.cat) {
    row = find("#bRows .bRow", t.cat);
    if (row) { const d = row.querySelector("details"); if (d) d.open = true; }
  } else if (t.tab === "bills" && t.name) {
    row = find("#billList .bRow", t.name);
  } else if (t.tab === "savings" && t.name) {
    row = find("#goalList .bRow", t.name);
  }
  if (row) {
    row.scrollIntoView({ block: "center" });
    row.classList.add("nFlash");
    setTimeout(() => row.classList.remove("nFlash"), 2500);
  }
}

function followLink(target, noteId) {
  nReturn = { id: noteId };
  try { history.pushState({ spNote: 1 }, ""); } catch (e) {}
  pageDlg.close();
  showTab(target.tab);
  nChip.style.display = "flex";
  setTimeout(() => focusTarget(target), 120);
}

// ---- Pages ----
let nSearch = "";

// "6 Oct 2026 • 4:30 PM"
const N_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function noteStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = d.getHours() % 12 || 12;
  return d.getDate() + " " + N_MON[d.getMonth()] + " " + d.getFullYear() + " \u2022 " +
    h + ":" + pad2(d.getMinutes()) + " " + (d.getHours() >= 12 ? "PM" : "AM");
}

// Heading and preview of a note for the list: the title, or the first line when there is none.
function noteHeading(n) {
  const first = (n.text.split("\n")[0] || "").trim();
  return n.title || first.slice(0, 60) || "Untitled";
}
function notePreview(n) {
  const body = n.title ? n.text : n.text.split("\n").slice(1).join(" ");
  return body.replace(/\s+/g, " ").trim().slice(0, 140);
}

function notesPage(body) {
  const top = mkEl("div", "nTop");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search notes";
  search.value = nSearch;
  search.setAttribute("aria-label", "Search notes");
  top.appendChild(search);

  const list = mkEl("div", "nList");

  const fab = mkEl("button", "nFab");
  fab.type = "button";
  fab.setAttribute("aria-label", "New note");
  fab.innerHTML = svgIcon("plus2");
  fab.onclick = () => openPage("New note", b => noteEditor(b, null));

  body.append(top, list, fab);

  function draw() {
    list.innerHTML = "";
    const q = nSearch.trim().toLowerCase();
    const items = getNotes().slice()
      .sort((a, b) => (b.updated || b.created || "").localeCompare(a.updated || a.created || ""))
      .filter(n => !q || (n.title + " " + n.text).toLowerCase().includes(q));
    if (!items.length) {
      const empty = mkEl("div", "nEmpty");
      empty.appendChild(mkEl("strong", "", q ? "No notes match" : "No notes yet"));
      empty.appendChild(mkEl("p", "muted", q ? "Try a different word." : "Tap + to write your first note."));
      list.appendChild(empty);
      return;
    }
    items.forEach(n => {
      const b = mkEl("button", "nItem");
      b.type = "button";
      b.appendChild(mkEl("strong", "nHead", noteHeading(n)));
      b.appendChild(mkEl("div", "nDate", noteStamp(n.updated || n.created)));
      const prev = notePreview(n);
      if (prev) b.appendChild(mkEl("div", "nPrev", prev));
      b.onclick = () => openPage("Note", pb => noteView(pb, n.id));
      list.appendChild(b);
    });
  }
  search.addEventListener("input", () => { nSearch = search.value; draw(); });
  draw();
}

function deleteNote(note) {
  return showConfirmDialog({
    title: "Delete this note?",
    message: "\u201C" + noteHeading(note) + "\u201D will be removed. This cannot be undone.",
    confirmLabel: "Delete",
    danger: true
  }).then(ok => {
    if (!ok) return false;
    data.budgets._notes = getNotes().filter(x => x.id !== note.id);
    saveData();
    showToast("Note deleted");
    openPage("Notes", notesPage, { replace: true });
    return true;
  });
}

function noteView(body, id) {
  const note = getNotes().find(x => x.id === id);
  if (!note) { body.appendChild(mkEl("p", "muted", "This note no longer exists.")); return; }
  if (note.title) body.appendChild(mkEl("h3", "nTitle", note.title));
  body.appendChild(mkEl("div", "nStamp", noteStamp(note.updated || note.created)));
  const txt = mkEl("div", "nText");
  renderLinked(txt, note.text, note.id);
  body.appendChild(txt);
  body.appendChild(mkEl("p", "muted nHint", "Tap a highlighted word to jump to it in the app."));

  const bar = mkEl("div", "nBar");
  const edit = mkEl("button", "primary", "Edit");
  edit.type = "button";
  edit.onclick = () => openPage("Edit note", b => noteEditor(b, note.id));
  const del = mkEl("button", "secondary nDel", "Delete");
  del.type = "button";
  del.onclick = () => deleteNote(note);
  bar.append(edit, del);
  body.appendChild(bar);
}

function noteEditor(body, id) {
  let note = id ? getNotes().find(x => x.id === id) : null;
  const existing = !!note;

  const titleIn = document.createElement("input");
  titleIn.type = "text";
  titleIn.className = "nTitleIn";
  titleIn.maxLength = 100;
  titleIn.placeholder = "Title";
  titleIn.value = note ? note.title : "";
  titleIn.setAttribute("aria-label", "Note title");

  const textIn = document.createElement("textarea");
  textIn.className = "nArea";
  textIn.maxLength = 5000;
  textIn.placeholder = "Write your note\u2026";
  textIn.value = note ? note.text : "";
  textIn.setAttribute("aria-label", "Note text");

  const status = mkEl("div", "nSaved", note ? noteStamp(note.updated || note.created) : "");

  // Kept from before: every keystroke is saved, so a draft survives the app locking or closing.
  function persist() {
    const title = titleIn.value.trim();
    const text = textIn.value;
    if (!title && !text.trim()) return false;
    const now = new Date().toISOString();
    if (!note) {
      note = { id: newId(), title: title, text: text, created: now, updated: now };
      getNotes().push(note);
    } else {
      note.title = title;
      note.text = text;
      note.updated = now;
    }
    saveData();
    status.textContent = "Saved \u2022 " + noteStamp(now);
    return true;
  }
  titleIn.addEventListener("input", persist);
  textIn.addEventListener("input", persist);

  const bar = mkEl("div", "nBar");
  const save = mkEl("button", "primary", "Save Note");
  save.type = "button";
  save.onclick = () => {
    if (!persist()) { showToast("Write something first"); return; }
    showToast("Note saved");
    if (existing) openPage("Note", b => noteView(b, note.id));
    else openPage("Notes", notesPage, { replace: true });
  };
  bar.appendChild(save);
  if (existing) {
    const del = mkEl("button", "secondary nDel", "Delete");
    del.type = "button";
    del.onclick = () => deleteNote(note);
    bar.appendChild(del);
  }
  body.append(titleIn, status, textIn, bar);
  if (!existing) setTimeout(() => titleIn.focus(), 60);
}

// ---- "Notes" as the first item in the slide-out menu ----
const noteItem = mkEl("button", "dItem");
noteItem.type = "button";
const noteIc = mkEl("span", "ic");
noteIc.innerHTML = svgIcon("note");
noteItem.append(noteIc, mkEl("span", "", "Notes"));
noteItem.onclick = () => openPage("Notes", notesPage);
drawer.insertBefore(noteItem, drawer.querySelector(".dItem"));
