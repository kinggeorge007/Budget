(() => {
  "use strict";

  // Budget controls: no native Android pop-ups anywhere.
  //   <select>                    -> button + showDropdown()      (core.js)
  //   date / time / month fields  -> button + bottom-sheet picker (this file)
  //   alert()                     -> toast, or a dialog for long messages
  //   confirm() / prompt()        -> askConfirm() / askText() / askForm()   (promises)
  //
  // The original <select> and <input> elements stay in the page, hidden, as the place where the value
  // lives. All existing code that reads or writes .value or listens for "change" keeps working.
  // What cannot be replaced by a web app: the keyboard, the file / photo chooser, the share sheet
  // and the print dialog. Those belong to the phone.

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const p2 = n => (n < 10 ? "0" : "") + n;
  const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };

  // ---------------------------------------------------------------------------------------------
  // 1. Promise dialogs (replace confirm / prompt)
  // ---------------------------------------------------------------------------------------------
  function askConfirm(msg, o) {
    o = o || {};
    const text = String(msg);
    const m = text.match(/^(.*?[?.])\s+([\s\S]+)$/);
    const title = m && m[1].length <= 80 ? m[1] : (text.length <= 80 ? text : "Please confirm");
    const message = m && m[1].length <= 80 ? m[2] : (text.length <= 80 ? null : text);
    let label = "Confirm", danger = false;
    if (/^(delete|remove)/i.test(text)) { label = "Delete"; danger = true; }
    else if (/erase/i.test(text)) { label = "Erase"; danger = true; }
    else if (/^clear/i.test(text)) { label = "Clear"; danger = true; }
    else if (/replace/i.test(text)) { label = "Replace"; danger = true; }
    else if (/^archive/i.test(text)) label = "Archive";
    else if (/^mark as unpaid/i.test(text)) label = "Mark unpaid";
    else if (/^switch/i.test(text)) label = "Switch";
    else if (/^record/i.test(text)) label = "Record";
    return showConfirmDialog({
      title: o.title || title,
      message: o.message !== undefined ? o.message : message,
      confirmLabel: o.confirmLabel || label,
      danger: o.danger !== undefined ? o.danger : danger
    });
  }

  // askForm({ title, confirmLabel, fields:[{ key, label, value, max, money }] }) -> {key:value} or null
  function askForm(o) {
    return new Promise(resolve => {
      const wrap = el("div", "ctl-form");
      const inputs = {};
      o.fields.forEach(f => {
        const l = el("label");
        l.appendChild(document.createTextNode(f.label));
        const i = document.createElement("input");
        if (f.money) { i.type = "number"; i.setAttribute("inputmode", "decimal"); i.step = "0.01"; }
        else i.type = "text";
        i.value = f.value == null ? "" : f.value;
        if (f.max) i.maxLength = f.max;
        i.autocomplete = "off";
        l.appendChild(i);
        wrap.appendChild(l);
        inputs[f.key] = i;
      });
      const submit = h => {
        const out = {};
        Object.keys(inputs).forEach(k => { out[k] = inputs[k].value; });
        h.close(out);
      };
      const h = showModal({
        title: o.title,
        body: wrap,
        actions: [
          { label: "Cancel", kind: "secondary", value: null },
          { label: o.confirmLabel || "Save", kind: "primary", keepOpen: true, onClick: submit }
        ],
        onClose: v => resolve(v && typeof v === "object" ? v : null)
      });
      wrap.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submit(h); } });
      setTimeout(() => { const first = wrap.querySelector("input"); if (first) { first.focus(); try { first.select(); } catch (e) {} } }, 150);
    });
  }
  function askText(o) {
    return askForm({ title: o.title, confirmLabel: o.confirmLabel, fields: [{ key: "v", label: o.label, value: o.value, max: o.max }] })
      .then(r => (r ? r.v : null));
  }

  // alert(): non-blocking. Short messages become a toast, long ones a dialog with OK.
  window.alert = function (msg) {
    const text = String(msg);
    if (text.length > 150) { showModal({ title: "Budget", body: text, actions: [{ label: "OK", kind: "primary" }] }); return; }
    const bad = /could not|can't|cannot|not a valid|please|error|needed|must|enter |choose |no budget|no recovery|first account|wrong|too many|invalid/i.test(text);
    showToast(text, { type: bad ? "error" : undefined, duration: Math.min(6500, 2400 + text.length * 35) });
  };
  window.askConfirm = askConfirm;
  window.askForm = askForm;
  window.askText = askText;

  // ---------------------------------------------------------------------------------------------
  // 2. Helpers for hidden native elements
  // ---------------------------------------------------------------------------------------------
  // One shared hook on the value setter of selects and inputs. Each enhanced element registers a
  // callback in __ctlSync, so a value set by code (not by the user) still refreshes its button.
  [HTMLSelectElement.prototype, HTMLInputElement.prototype].forEach(proto => {
    const d = Object.getOwnPropertyDescriptor(proto, "value");
    if (!d || !d.set || d.set.__ctl) return;
    const set = function (v) { d.set.call(this, v); if (this.__ctlSync) this.__ctlSync(); };
    set.__ctl = true;
    Object.defineProperty(proto, "value", { configurable: true, enumerable: d.enumerable, get: d.get, set });
  });
  function hookValue(elm, cb) { elm.__ctlSync = cb; }
  function setValue(elm, v) {
    elm.value = v;
    elm.dispatchEvent(new Event("input", { bubbles: true }));
    elm.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------------------------------------------------------------------------------------------
  // 3. <select> -> dropdown
  // ---------------------------------------------------------------------------------------------
  function enhanceSelect(sel) {
    if (sel.dataset.ctl) return;
    sel.dataset.ctl = "1";
    const b = btn("", "ctl-select");
    b.setAttribute("aria-haspopup", "listbox");
    b.setAttribute("aria-label", sel.getAttribute("aria-label") || "Choose an option");
    const text = el("span", "ctl-sel-text");
    b.appendChild(text);
    sel.classList.add("ctl-hidden");
    sel.tabIndex = -1;
    sel.after(b);
    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      text.textContent = o ? o.textContent : "Select";
      b.disabled = sel.disabled;
    };
    sync();
    hookValue(sel, sync);
    sel.addEventListener("change", sync);
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true });
    b.onclick = () => {
      showDropdown({
        anchor: b,
        value: sel.value,
        options: Array.from(sel.options).filter(o => !o.disabled).map(o => ({ value: o.value, label: o.textContent })),
        onSelect: v => { if (v !== sel.value) setValue(sel, v); }
      });
    };
  }

  // ---------------------------------------------------------------------------------------------
  // 4. date / time / month -> pickers in a bottom sheet
  // ---------------------------------------------------------------------------------------------
  function pickDate(inp) {
    const cur = /^\d{4}-\d{2}-\d{2}$/.test(inp.value) ? inp.value : todayIso();
    let y = +cur.slice(0, 4), m = +cur.slice(5, 7);
    const body = el("div", "pk");
    const h = showBottomSheet({ title: "Select date", body });
    const draw = () => {
      body.innerHTML = "";
      const head = el("div", "pk-head");
      head.append(
        btn("‹", "pk-nav", () => { m--; if (m < 1) { m = 12; y--; } draw(); }),
        el("strong", "", MONTHS[m - 1] + " " + y),
        btn("›", "pk-nav", () => { m++; if (m > 12) { m = 1; y++; } draw(); })
      );
      head.children[0].setAttribute("aria-label", "Previous month");
      head.children[2].setAttribute("aria-label", "Next month");
      const grid = el("div", "pk-grid");
      ["S", "M", "T", "W", "T", "F", "S"].forEach(d => grid.appendChild(el("div", "pk-wd", d)));
      const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
      for (let i = 0; i < first; i++) grid.appendChild(el("div"));
      for (let d = 1; d <= days; d++) {
        const iso = y + "-" + p2(m) + "-" + p2(d);
        const b = btn(String(d), "pk-day" + (iso === inp.value ? " sel" : "") + (iso === todayIso() ? " today" : ""), () => { setValue(inp, iso); h.close(); });
        grid.appendChild(b);
      }
      const foot = el("div", "pk-foot");
      foot.append(btn("Today", "secondary", () => { setValue(inp, todayIso()); h.close(); }), btn("Cancel", "secondary", () => h.close()));
      body.append(head, grid, foot);
    };
    draw();
  }

  function pickMonth(inp) {
    const cur = /^\d{4}-\d{2}$/.test(inp.value) ? inp.value : todayIso().slice(0, 7);
    let y = +cur.slice(0, 4);
    const body = el("div", "pk");
    const h = showBottomSheet({ title: "Select month", body });
    const draw = () => {
      body.innerHTML = "";
      const head = el("div", "pk-head");
      head.append(btn("‹", "pk-nav", () => { y--; draw(); }), el("strong", "", String(y)), btn("›", "pk-nav", () => { y++; draw(); }));
      head.children[0].setAttribute("aria-label", "Previous year");
      head.children[2].setAttribute("aria-label", "Next year");
      const grid = el("div", "pk-grid pk-months");
      MONTHS.forEach((name, i) => {
        const v = y + "-" + p2(i + 1);
        grid.appendChild(btn(name.slice(0, 3), "pk-day" + (v === inp.value ? " sel" : "") + (v === todayIso().slice(0, 7) ? " today" : ""), () => { setValue(inp, v); h.close(); }));
      });
      const foot = el("div", "pk-foot");
      foot.append(btn("This month", "secondary", () => { setValue(inp, todayIso().slice(0, 7)); h.close(); }), btn("Cancel", "secondary", () => h.close()));
      body.append(head, grid, foot);
    };
    draw();
  }

  function pickTime(inp) {
    const now = new Date();
    const v = /^\d{2}:\d{2}$/.test(inp.value) ? inp.value : p2(now.getHours()) + ":" + p2(now.getMinutes());
    let h24 = +v.slice(0, 2), mi = Math.round(+v.slice(3, 5) / 5) * 5;
    if (mi === 60) { mi = 0; h24 = (h24 + 1) % 24; }
    let ap = h24 >= 12 ? "PM" : "AM", h12 = h24 % 12 || 12;
    const body = el("div", "pk");
    const h = showBottomSheet({ title: "Select time", body });
    const draw = () => {
      body.innerHTML = "";
      const label = (t) => body.appendChild(el("div", "pk-label", t));
      label("Hour");
      const hours = el("div", "pk-grid pk-six");
      for (let n = 1; n <= 12; n++) hours.appendChild(btn(String(n), "pk-day" + (n === h12 ? " sel" : ""), () => { h12 = n; draw(); }));
      body.appendChild(hours);
      label("Minute");
      const mins = el("div", "pk-grid pk-six");
      for (let n = 0; n < 60; n += 5) mins.appendChild(btn(p2(n), "pk-day" + (n === mi ? " sel" : ""), () => { mi = n; draw(); }));
      body.appendChild(mins);
      const apRow = el("div", "pk-ap");
      ["AM", "PM"].forEach(a => apRow.appendChild(btn(a, "secondary" + (a === ap ? " on" : ""), () => { ap = a; draw(); })));
      body.appendChild(apRow);
      const foot = el("div", "pk-foot");
      foot.append(
        btn("Set time", "primary", () => { setValue(inp, p2((h12 % 12) + (ap === "PM" ? 12 : 0)) + ":" + p2(mi)); h.close(); }),
        btn("Clear", "secondary", () => { setValue(inp, ""); h.close(); })
      );
      body.appendChild(foot);
    };
    draw();
  }

  function enhanceTemporal(inp) {
    if (inp.dataset.ctl) return;
    inp.dataset.ctl = "1";
    const kind = inp.type;
    const b = btn("", "ctl-select" + (inp.id === "month" ? " ctl-month" : ""));
    b.setAttribute("aria-label", inp.getAttribute("aria-label") || (kind === "time" ? "Choose time" : kind === "month" ? "Choose month" : "Choose date"));
    const text = el("span", "ctl-sel-text");
    b.appendChild(text);
    inp.required = false;
    inp.classList.add("ctl-hidden");
    inp.tabIndex = -1;
    inp.after(b);
    const sync = () => {
      const v = inp.value;
      if (!v) text.textContent = kind === "time" ? "Optional" : "Select";
      else if (kind === "date" && typeof niceDate === "function") text.textContent = niceDate(v);
      else if (kind === "time" && typeof niceTime === "function") text.textContent = niceTime(v);
      else if (kind === "month") text.textContent = MONTHS[+v.slice(5, 7) - 1] + " " + v.slice(0, 4);
      else text.textContent = v;
    };
    sync();
    hookValue(inp, sync);
    inp.addEventListener("change", sync);
    b.onclick = () => (kind === "date" ? pickDate : kind === "time" ? pickTime : pickMonth)(inp);
  }

  // ---------------------------------------------------------------------------------------------
  // 5. Apply to everything, now and whenever new screens add controls
  // ---------------------------------------------------------------------------------------------
  function enhanceAll() {
    document.querySelectorAll("select").forEach(enhanceSelect);
    document.querySelectorAll('input[type="date"],input[type="time"],input[type="month"]').forEach(enhanceTemporal);
    // Our own messages replace the browser's "Please fill out this field" bubbles.
    document.querySelectorAll("form").forEach(f => { f.noValidate = true; });
  }
  let timer = null;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(enhanceAll, 0); })
    .observe(document.body, { childList: true, subtree: true });
  enhanceAll();

  window.UI = window.UI || {};
  window.UI.controls = { enhanceAll, askConfirm, askText, askForm };
})();
