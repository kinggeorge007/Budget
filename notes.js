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
.nItem{display:block;width:100%;text-align:left;background:var(--card);color:var(--text);border:0;border-radius:16px;box-shadow:var(--shadow);padding:14px;margin-bottom:10px;min-height:0}
.nItem strong{display:block;margin-bottom:4px;word-break:break-word}
.nItem .nPrev{color:var(--muted);font-size:.9rem;word-break:break-word}
.nItem .nDate{color:var(--muted);font-size:.75rem;margin-top:6px}
.nArea{width:100%;min-height:260px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--text);padding:12px;font:inherit;line-height:1.5;resize:vertical}
.nBar{display:flex;gap:8px;margin-top:12px}
.nBar button{flex:1}
.nTop{display:grid;gap:10px;margin-bottom:14px}
.nTitle{margin:0 0 10px;font-size:1.2rem;word-break:break-word}
.nText{white-space:pre-wrap;line-height:1.6;word-break:break-word;background:var(--card);border-radius:16px;padding:14px;box-shadow:var(--shadow)}
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

function notesPage(body) {
  const top = mkEl("div", "nTop");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search notes";
  search.value = nSearch;
  search.setAttribute("aria-label", "Search notes");
  const add = mkEl("button", "primary", "New note");
  add.type = "button";
  add.onclick = () => openPage("New note", b => noteEditor(b, null));
  top.append(search, add);
  const list = mkEl("div");
  body.append(top, list);

  function draw() {
    list.innerHTML = "";
    const q = nSearch.trim().toLowerCase();
    const items = getNotes().slice()
      .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))
      .filter(n => !q || (n.title + " " + n.text).toLowerCase().includes(q));
    if (!items.length) {
      list.appendChild(mkEl("p", "muted", q ? "No notes match your search." : "No notes yet. Tap New note to write one."));
      return;
    }
    items.forEach(n => {
      const b = mkEl("button", "nItem");
      b.type = "button";
      const firstLine = n.text.split("\n")[0];
      b.appendChild(mkEl("strong", "", n.title || firstLine.slice(0, 60) || "Untitled"));
      if (n.text) b.appendChild(mkEl("div", "nPrev", n.text.replace(/\s+/g, " ").slice(0, 90)));
      b.appendChild(mkEl("div", "nDate", fmtStamp(n.updated || n.created)));
      b.onclick = () => openPage("Note", pb => noteView(pb, n.id));
      list.appendChild(b);
    });
  }
  search.addEventListener("input", () => { nSearch = search.value; draw(); });
  draw();
}

function noteView(body, id) {
  const note = getNotes().find(x => x.id === id);
  if (!note) { body.appendChild(mkEl("p", "muted", "This note no longer exists.")); return; }
  if (note.title) body.appendChild(mkEl("h3", "nTitle", note.title));
  const txt = mkEl("div", "nText");
  renderLinked(txt, note.text, note.id);
  body.appendChild(txt);
  body.appendChild(mkEl("p", "muted", "Tap a highlighted word to jump to it in the app. " + fmtStamp(note.updated || note.created)));

  const bar = mkEl("div", "nBar");
  const edit = mkEl("button", "primary", "Edit");
  edit.type = "button";
  edit.onclick = () => openPage("Edit note", b => noteEditor(b, note.id));
  const all = mkEl("button", "secondary", "All notes");
  all.type = "button";
  all.onclick = () => openPage("Notes", notesPage);
  const del = mkEl("button", "secondary", "Delete");
  del.type = "button";
  del.style.color = "var(--danger)";
  del.onclick = () => {
    if (!confirm("Delete this note?")) return;
    data.budgets._notes = getNotes().filter(x => x.id !== note.id);
    saveData();
    openPage("Notes", notesPage);
  };
  bar.append(edit, all, del);
  body.appendChild(bar);
}

function noteEditor(body, id) {
  let note = id ? getNotes().find(x => x.id === id) : null;

  const titleIn = document.createElement("input");
  titleIn.type = "text";
  titleIn.maxLength = 100;
  titleIn.placeholder = "Title (optional)";
  titleIn.value = note ? note.title : "";
  titleIn.setAttribute("aria-label", "Note title");
  titleIn.style.marginBottom = "10px";

  const textIn = document.createElement("textarea");
  textIn.className = "nArea";
  textIn.maxLength = 5000;
  textIn.placeholder = "Write your note here...";
  textIn.value = note ? note.text : "";
  textIn.setAttribute("aria-label", "Note text");

  const status = mkEl("p", "muted", "Saves automatically as you type. Words like Food, your bill names and savings goals become tappable links when you view the note.");

  function persist() {
    const title = titleIn.value.trim();
    const text = textIn.value;
    if (!title && !text.trim()) return;
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
  }
  titleIn.addEventListener("input", persist);
  textIn.addEventListener("input", persist);

  const bar = mkEl("div", "nBar");
  const done = mkEl("button", "primary", "Done");
  done.type = "button";
  done.onclick = () => {
    if (note) openPage("Note", b => noteView(b, note.id));
    else openPage("Notes", notesPage);
  };
  const del = mkEl("button", "secondary", "Delete");
  del.type = "button";
  del.style.color = "var(--danger)";
  del.onclick = () => {
    if (note) {
      if (!confirm("Delete this note?")) return;
      data.budgets._notes = getNotes().filter(x => x.id !== note.id);
      saveData();
    }
    openPage("Notes", notesPage);
  };
  bar.append(done, del);
  body.append(titleIn, textIn, status, bar);
}

// ---- "Notes" as the first item in the slide-out menu ----
const noteItem = mkEl("button", "dItem");
noteItem.type = "button";
const noteIc = mkEl("span", "ic");
noteIc.innerHTML = svgIcon("note");
noteItem.append(noteIc, mkEl("span", "", "Notes"));
noteItem.onclick = () => openPage("Notes", notesPage);
drawer.insertBefore(noteItem, drawer.querySelector(".dItem"));
