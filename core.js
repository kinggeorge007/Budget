(() => {
  "use strict";

  // Budget core (Phase 1): one navigation system and one set of reusable UI components.
  // Loaded last. It wraps the existing openPage() and showTab() instead of replacing them, so every
  // screen that already calls them keeps working and now gets history for free.
  //
  //   Navigation : navigateTo(), goBack()
  //   Components : showModal(), showConfirmDialog(), showBottomSheet(), showActionMenu(),
  //                showDropdown(), showQuickMenu(), showToast()
  //   Theme      : setTheme() / getTheme() / applyTheme() (in settings.js), switch lives in More
  //   Layout     : fitText() keeps big amounts inside their box

  // ======================================================================
  // 1. NAVIGATION
  // ======================================================================
  //
  // Two kinds of screens exist:
  //   - Tabs (Home, Budget, Reports...) switched with showTab().
  //   - Pages (More, Settings, Calendar, Notes...) shown in the full-screen #pageDlg with openPage().
  //
  // Pages keep a stack. Opening a page whose title is already in the stack returns to that entry
  // instead of pushing a duplicate. That one rule makes "refresh this page" (calendar month arrows,
  // save then show the list again) and "Cancel / Back to list" buttons behave correctly.
  //
  // Tabs keep a short visit history so the Android back button walks back through them to Home.
  //
  // Every overlay (page, add/edit pop-ups, and the components below) registers in `layers`. While
  // anything is open, or a non-Home tab is showing, ONE sentinel entry sits in the browser history so
  // the Android/browser back button is caught and mapped to goBack() instead of leaving the app.

  const pageStack = [];            // [{ title, build, scroll }]
  const tabStack = [];             // ["home", "budget", ...]
  const layers = [];               // open <dialog>s, topmost last
  const seenDialogs = new WeakSet();

  let armed = 0;                   // id of the sentinel history entry we own (0 = none)
  let armSeq = 0;
  let pendingPops = 0;             // history.back() calls we made ourselves and are waiting on
  let syncTimer = null;
  let silentTab = false;

  const rawOpenPage = openPage;
  const rawShowTab = showTab;

  // ---- history sentinel ----
  function wantsArm() {
    return layers.length > 0 || tabStack.length > 1;
  }

  function syncArm() {
    clearTimeout(syncTimer);
    // Deferred one tick so "close then open" in the same click never touches history twice.
    syncTimer = setTimeout(() => {
      if (pendingPops > 0) return;           // popstate handler re-syncs when our own back() lands
      if (wantsArm() && !armed) {
        try {
          armed = ++armSeq;
          history.pushState({ spNav: armed }, "");
        } catch (e) { armed = 0; }
      } else if (!wantsArm() && armed) {
        const top = history.state && history.state.spNav === armed;
        armed = 0;
        if (top) { pendingPops++; history.back(); }
      }
    }, 0);
  }

  window.addEventListener("popstate", e => {
    if (pendingPops > 0) {                   // that was our own history.back()
      pendingPops--;
      if (!pendingPops) syncArm();
      return;
    }
    if (!armed) return;
    if (e.state && e.state.spNav === armed) return;   // landed ON our sentinel: someone else's entry was removed
    armed = 0;                                        // our sentinel was consumed by the back button
    backStep();
    syncArm();                                        // re-arm if there is still something to unwind
  });

  // A reload can leave an old sentinel as the current entry. Neutralise it.
  try {
    if (history.state && history.state.spNav) history.replaceState(null, "");
  } catch (e) {}

  // ---- layers: every <dialog> shown with showModal() ----
  function dismissLayer(d) {
    if (d === pageDlg) return pageBack();
    if (typeof d._uiDismiss === "function") return d._uiDismiss();
    d.close();
  }

  function dropLayer(d) {
    const i = layers.indexOf(d);
    if (i >= 0) layers.splice(i, 1);
    syncArm();
  }

  const nativeShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    nativeShowModal.call(this);
    if (this.id === "lockDlg") return;       // the lock screen must never be dismissed by Back
    if (layers.indexOf(this) < 0) layers.push(this);
    if (!seenDialogs.has(this)) {
      seenDialogs.add(this);
      this.addEventListener("close", () => dropLayer(this));
    }
    syncArm();
  };

  // ---- pages ----
  pageDlg.addEventListener("close", () => { pageStack.length = 0; });

  // Escape key, and Android Back on browsers that map it to the dialog "cancel" event.
  pageDlg.addEventListener("cancel", e => {
    e.preventDefault();
    pageBack();
  });

  openPage = function (title, build) {
    if (!pageDlg.open) pageStack.length = 0;
    else if (pageStack.length) pageStack[pageStack.length - 1].scroll = pageDlg.scrollTop;

    const at = pageStack.findIndex(p => p.title === title);
    if (at >= 0) pageStack.length = at;      // returning to a page already in the stack
    const entry = { title, build, scroll: 0 };
    pageStack.push(entry);
    try {
      rawOpenPage(title, build);
    } catch (err) {
      pageStack.pop();
      throw err;
    }
  };

  function pageBack() {
    if (pageStack.length > 1) {
      pageStack.pop();
      const prev = pageStack[pageStack.length - 1];
      rawOpenPage(prev.title, prev.build);
      pageDlg.scrollTop = prev.scroll || 0;
    } else {
      pageDlg.close();
    }
  }

  // The header arrow in every page.
  pBack.onclick = pageBack;

  // ---- tabs ----
  let startTab = "home";
  try {
    const saved = sessionStorage.getItem("sp_tab");
    if (saved && tabButtons[saved]) startTab = saved;
  } catch (e) {}
  tabStack.push("home");
  if (startTab !== "home") tabStack.push(startTab);

  showTab = function (id) {
    if (pageDlg.open) pageDlg.close();       // tabs live under the page sheet
    rawShowTab(id);
    if (!silentTab) {
      const top = tabStack[tabStack.length - 1];
      if (id !== top) {
        if (tabStack.length > 1 && tabStack[tabStack.length - 2] === id) tabStack.pop();
        else tabStack.push(id);
        if (tabStack.length > 12) tabStack.splice(0, tabStack.length - 12);
      }
      syncArm();
    }
  };

  // ---- one step back, from anywhere ----
  function backStep() {
    const top = layers[layers.length - 1];
    if (top) { dismissLayer(top); return true; }
    if (tabStack.length > 1) {
      tabStack.pop();
      silentTab = true;
      try { showTab(tabStack[tabStack.length - 1]); } finally { silentTab = false; }
      syncArm();
      return true;
    }
    return false;                            // nothing left: the browser/OS may leave the app
  }

  function goBack() {
    return backStep();
  }

  // navigateTo("budget") switches tab; navigateTo("Settings", settingsPage) opens a page.
  function navigateTo(target, build) {
    if (typeof target === "string" && tabButtons[target]) { showTab(target); return; }
    if (typeof target === "string" && typeof build === "function") { openPage(target, build); return; }
    throw new Error("navigateTo: unknown target " + target);
  }

  // The lock screen closes everything underneath it.
  if (typeof lockDlg !== "undefined" && lockDlg) {
    new MutationObserver(() => {
      if (lockDlg.hasAttribute("open")) layers.slice().forEach(d => { try { d.close(); } catch (e) {} });
    }).observe(lockDlg, { attributes: true, attributeFilter: ["open"] });
  }

  syncArm();

  // ======================================================================
  // 2. UI COMPONENTS
  // ======================================================================
  //
  // All overlays are <dialog>s opened with showModal(). That is deliberate: a page sheet opened with
  // showModal() lives in the browser's top layer, and only another top-layer element can appear above
  // it. A plain positioned <div> would be hidden behind the page.

  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function fill(parent, content) {
    if (content == null) return;
    if (typeof content === "function") { content(parent); return; }
    if (typeof content === "string") { parent.appendChild(el("p", "ui-text", content)); return; }
    parent.appendChild(content);
  }

  function button(label, kind, onClick) {
    const b = el("button", "ui-btn ui-btn-" + (kind || "secondary"), label);
    b.type = "button";
    if (onClick) b.onclick = onClick;
    return b;
  }

  // Shared engine: builds the dialog, animates it in and out, and wires every way of dismissing it.
  function makeLayer(kind, build, opts) {
    opts = opts || {};
    const dlg = document.createElement("dialog");
    dlg.className = "ui-layer ui-" + kind;
    const panel = el("div", "ui-panel");
    panel.tabIndex = -1;
    panel.setAttribute("autofocus", "");     // initial focus on the panel, not on the first button
    dlg.appendChild(panel);
    build(panel);
    document.body.appendChild(dlg);

    let finish;
    const closed = new Promise(res => { finish = res; });
    let done = false;

    const handle = {
      el: dlg,
      panel,
      closed,
      close(value) {
        if (done) return;
        done = true;
        const i = layers.indexOf(dlg);
        if (i >= 0) layers.splice(i, 1);
        syncArm();
        const end = () => {
          try { dlg.close(); } catch (e) {}
          dlg.remove();
          if (typeof opts.onClose === "function") opts.onClose(value);
          finish(value);
        };
        dlg.classList.remove("in");
        if (reduceMotion) end();
        else {
          let fired = false;
          const once = () => { if (!fired) { fired = true; end(); } };
          panel.addEventListener("transitionend", once, { once: true });
          setTimeout(once, 260);
        }
      }
    };

    dlg._uiDismiss = () => handle.close(opts.dismissValue);
    dlg.addEventListener("cancel", e => { e.preventDefault(); dlg._uiDismiss(); });
    if (opts.dismissible !== false) {
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg._uiDismiss(); });
    } else {
      dlg._uiDismiss = () => {};
    }

    dlg.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add("in")));
    return handle;
  }

  // ---- Modal: centred card with a title, content and buttons ----
  // showModal({ title, body, actions:[{label, kind:"primary|secondary|danger", value, onClick, keepOpen}],
  //             dismissible, onClose }) -> { close(value), closed:Promise<value> }
  function showModal(opts) {
    opts = opts || {};
    let h;
    h = makeLayer("modal", panel => {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      if (opts.title) {
        const t = el("h3", "ui-title", opts.title);
        t.id = "ui-t" + Date.now();
        panel.setAttribute("aria-labelledby", t.id);
        panel.appendChild(t);
      }
      const body = el("div", "ui-body");
      fill(body, opts.body);
      panel.appendChild(body);
      if (opts.actions && opts.actions.length) {
        const bar = el("div", "ui-actions" + (opts.actions.length > 2 ? " stack" : ""));
        opts.actions.forEach(a => {
          bar.appendChild(button(a.label, a.kind, () => {
            if (a.onClick) a.onClick(h);
            if (!a.keepOpen) h.close(a.value);
          }));
        });
        panel.appendChild(bar);
      }
    }, { dismissible: opts.dismissible, onClose: opts.onClose });
    return h;
  }

  // ---- Confirm dialog: resolves true / false. Replaces confirm(). ----
  // if (await showConfirmDialog({ title:"Delete this note?", message:"This cannot be undone.", danger:true })) ...
  function showConfirmDialog(opts) {
    opts = opts || {};
    return new Promise(resolve => {
      showModal({
        title: opts.title || "Are you sure?",
        body: opts.message || null,
        actions: [
          { label: opts.cancelLabel || "Cancel", kind: "secondary", value: false },
          { label: opts.confirmLabel || "Confirm", kind: opts.danger ? "danger" : "primary", value: true }
        ],
        onClose: v => resolve(v === true)
      });
    });
  }

  // ---- Bottom sheet: slides up, drag the handle down to dismiss ----
  // showBottomSheet({ title, body, actions, onClose }) -> { close(value), closed }
  function showBottomSheet(opts) {
    opts = opts || {};
    let h;
    h = makeLayer("sheet", panel => {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      const grab = el("div", "ui-grab");
      grab.appendChild(el("span", "ui-handle"));
      panel.appendChild(grab);
      if (opts.title) panel.appendChild(el("h3", "ui-title", opts.title));
      const body = el("div", "ui-body");
      fill(body, opts.body);
      panel.appendChild(body);
      if (opts.actions && opts.actions.length) {
        const bar = el("div", "ui-actions stack");
        opts.actions.forEach(a => {
          bar.appendChild(button(a.label, a.kind, () => {
            if (a.onClick) a.onClick(h);
            if (!a.keepOpen) h.close(a.value);
          }));
        });
        panel.appendChild(bar);
      }

      // drag to dismiss
      let y0 = null, dy = 0;
      grab.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; dy = 0; panel.style.transition = "none"; }, { passive: true });
      grab.addEventListener("touchmove", e => {
        if (y0 == null) return;
        dy = Math.max(0, e.touches[0].clientY - y0);
        panel.style.transform = "translateY(" + dy + "px)";
      }, { passive: true });
      const end = () => {
        if (y0 == null) return;
        y0 = null;
        panel.style.transition = "";
        if (dy > 90) { h.close(); } else { panel.style.transform = ""; }
      };
      grab.addEventListener("touchend", end);
      grab.addEventListener("touchcancel", end);
    }, { onClose: opts.onClose });
    return h;
  }

  // ---- Action menu: list of actions in a sheet. Replaces native option menus. ----
  // showActionMenu({ title, items:[{ label, hint, icon:"<svg…>", danger, onSelect }] })
  function showActionMenu(opts) {
    opts = opts || {};
    let h;
    h = makeLayer("sheet", panel => {
      panel.setAttribute("role", "menu");
      const grab = el("div", "ui-grab");
      grab.appendChild(el("span", "ui-handle"));
      panel.appendChild(grab);
      if (opts.title) panel.appendChild(el("h3", "ui-title", opts.title));
      const list = el("div", "ui-list");
      (opts.items || []).forEach(it => {
        const row = el("button", "ui-item" + (it.danger ? " danger" : ""));
        row.type = "button";
        row.setAttribute("role", "menuitem");
        if (it.icon) { const ic = el("span", "ui-ic"); ic.innerHTML = it.icon; row.appendChild(ic); }
        const txt = el("span", "ui-itxt");
        txt.appendChild(el("span", "ui-ilabel", it.label));
        if (it.hint) txt.appendChild(el("span", "ui-ihint", it.hint));
        row.appendChild(txt);
        row.onclick = () => { h.close(it.value); if (it.onSelect) setTimeout(it.onSelect, 0); };
        list.appendChild(row);
      });
      panel.appendChild(list);
      panel.appendChild(button(opts.cancelLabel || "Cancel", "secondary", () => h.close()));
      panel.lastChild.classList.add("ui-cancel");
    }, { onClose: opts.onClose });
    return h;
  }

  // ---- Dropdown: options list that opens right under a field. Replaces native <select> pop-ups. ----
  // showDropdown({ anchor:element, options:[{ value, label, hint }], value, onSelect(value, option) })
  function showDropdown(opts) {
    opts = opts || {};
    const options = opts.options || [];
    let h;
    h = makeLayer("drop", panel => {
      panel.setAttribute("role", "listbox");
      options.forEach(o => {
        const row = el("button", "ui-opt" + (o.value === opts.value ? " on" : ""));
        row.type = "button";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", o.value === opts.value ? "true" : "false");
        const txt = el("span", "ui-itxt");
        txt.appendChild(el("span", "ui-ilabel", o.label));
        if (o.hint) txt.appendChild(el("span", "ui-ihint", o.hint));
        row.appendChild(txt);
        if (o.value === opts.value) { const c = el("span", "ui-check"); c.innerHTML = ICON_CHECK; row.appendChild(c); }
        row.onclick = () => { h.close(o.value); if (opts.onSelect) opts.onSelect(o.value, o); };
        panel.appendChild(row);
      });
    }, { onClose: opts.onClose });

    // Position next to the anchor once it is in the DOM; flip above if there is no room below.
    const place = () => {
      const p = h.panel, vw = window.innerWidth, vh = window.innerHeight, gap = 6, edge = 10;
      if (!opts.anchor) { p.style.left = edge + "px"; p.style.top = "20%"; return; }
      const r = opts.anchor.getBoundingClientRect();
      const w = Math.min(Math.max(r.width, 200), vw - edge * 2);
      const left = Math.min(Math.max(r.left, edge), vw - w - edge);
      p.style.width = w + "px";
      p.style.left = left + "px";
      p.style.maxHeight = "";
      const natural = Math.min(p.scrollHeight, 320);
      const below = vh - r.bottom - gap - edge;
      const above = r.top - gap - edge;
      if (below >= natural || below >= above) {
        p.style.top = r.bottom + gap + "px";
        p.style.bottom = "";
        p.style.maxHeight = Math.min(320, below) + "px";
        p.classList.remove("up");
      } else {
        p.style.bottom = vh - r.top + gap + "px";
        p.style.top = "";
        p.style.maxHeight = Math.min(320, above) + "px";
        p.classList.add("up");
      }
    };
    place();
    const sel = h.panel.querySelector(".ui-opt.on");
    if (sel) sel.scrollIntoView({ block: "nearest" });
    return h;
  }

  // ---- Quick menu: round actions fan out of the + button. ----
  // showQuickMenu({ anchor:element, items:[{ label, aria, icon:"<svg…>", tone:"in|out|", onSelect }] })
  // Items are laid out on an arc above the anchor. Tap an item, the x, the dim area, or press Back to close.
  function showQuickMenu(opts) {
    opts = opts || {};
    const items = opts.items || [];
    let h;
    h = makeLayer("quick", panel => {
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-label", opts.label || "Add");
      items.forEach((it, i) => {
        const b = el("button", "ui-q" + (it.tone ? " " + it.tone : ""));
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.setAttribute("aria-label", it.aria || it.label);
        b.style.setProperty("--i", i);
        const c = el("span", "ui-qc");
        c.innerHTML = it.icon || "";
        b.append(c, el("span", "ui-ql", it.label));
        b.onclick = () => { h.close(it.value); if (it.onSelect) setTimeout(it.onSelect, 0); };
        panel.appendChild(b);
      });
      const x = el("button", "ui-qx");
      x.type = "button";
      x.setAttribute("aria-label", "Close menu");
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      x.onclick = () => h.close();
      panel.appendChild(x);
    }, { onClose: opts.onClose });

    // Arc geometry (px from the anchor centre): left, top, right. Clamped to the screen.
    const SPOTS = [[-88, -80], [0, -128], [88, -80]];
    const r = opts.anchor ? opts.anchor.getBoundingClientRect() : { left: innerWidth / 2 - 26, top: innerHeight - 90, width: 52, height: 52 };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const half = 34, edge = 8;
    const x = h.panel.querySelector(".ui-qx");
    x.style.left = cx - r.width / 2 + "px";
    x.style.top = cy - r.height / 2 + "px";
    x.style.width = r.width + "px";
    x.style.height = r.height + "px";
    h.panel.querySelectorAll(".ui-q").forEach((b, i) => {
      const sp = SPOTS[i] || SPOTS[1];
      const px = Math.min(Math.max(cx + sp[0], half + edge), innerWidth - half - edge);
      b.style.left = px - half + "px";
      b.style.top = cy + sp[1] - half + "px";
      b.style.setProperty("--dx", cx - px + "px");
      b.style.setProperty("--dy", -sp[1] + "px");
    });
    return h;
  }

  // ---- Toast: short message that fades by itself. Replaces alert() for information. ----
  // showToast("Saved"), showToast("Could not save", { type:"error" }), showToast("Deleted", { action:{ label:"Undo", onClick } })
  let toastBox = null;
  function ensureToastBox() {
    if (toastBox && toastBox.isConnected) return toastBox;
    toastBox = el("div", "ui-toasts");
    toastBox.setAttribute("role", "status");
    toastBox.setAttribute("aria-live", "polite");
    if (typeof toastBox.showPopover === "function") toastBox.setAttribute("popover", "manual");
    document.body.appendChild(toastBox);
    return toastBox;
  }

  function showToast(message, opts) {
    opts = opts || {};
    const box = ensureToastBox();
    if (typeof box.showPopover === "function") {
      // Re-showing moves the container to the front of the top layer, above any open dialog.
      try { if (box.matches(":popover-open")) box.hidePopover(); box.showPopover(); } catch (e) {}
    }
    const t = el("div", "ui-toast" + (opts.type ? " " + opts.type : ""));
    t.appendChild(el("span", "ui-toast-msg", String(message)));
    if (opts.action && opts.action.label) {
      const a = el("button", "ui-toast-act", opts.action.label);
      a.type = "button";
      a.onclick = () => { if (opts.action.onClick) opts.action.onClick(); remove(); };
      t.appendChild(a);
    }
    while (box.children.length >= 2) box.firstChild.remove();
    box.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("in")));

    let timer = setTimeout(remove, opts.duration || 2800);
    function remove() {
      clearTimeout(timer);
      t.classList.remove("in");
      setTimeout(() => {
        t.remove();
        if (!box.children.length && typeof box.hidePopover === "function") { try { box.hidePopover(); } catch (e) {} }
      }, reduceMotion ? 0 : 220);
    }
    return { dismiss: remove };
  }

  // ======================================================================
  // 3. LAYOUT HELPER: big amounts must never push the screen wider
  // ======================================================================
  function fitText(node, minPx) {
    if (!node || !node.parentElement) return;
    node.style.removeProperty("font-size");
    const cs = getComputedStyle(node.parentElement);
    const limit = node.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (!limit) return;
    let size = parseFloat(getComputedStyle(node).fontSize);
    const min = minPx || 12;
    let guard = 40;
    while (node.offsetWidth > limit && size > min && guard-- > 0) {
      size -= 1;
      node.style.setProperty("font-size", size + "px", "important");   // stylesheet sizes are !important
    }
  }

  const FIT_IDS = ["sumBalance", "sumIncome", "sumExpense"];
  function fitAll() {
    FIT_IDS.forEach(id => fitText(document.getElementById(id), 13));
  }
  let fitTimer = null;
  const fitSoon = () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitAll, 30); };
  FIT_IDS.forEach(id => {
    const n = document.getElementById(id);
    if (n) new MutationObserver(fitSoon).observe(n, { childList: true, characterData: true, subtree: true });
  });
  window.addEventListener("resize", fitSoon);
  window.addEventListener("orientationchange", fitSoon);
  document.addEventListener("themechange", fitSoon);
  fitSoon();

  // ======================================================================
  // 4. PUBLIC API
  // ======================================================================
  window.navigateTo = navigateTo;
  window.goBack = goBack;
  window.showModal = showModal;
  window.showConfirmDialog = showConfirmDialog;
  window.showBottomSheet = showBottomSheet;
  window.showActionMenu = showActionMenu;
  window.showDropdown = showDropdown;
  window.showToast = showToast;
  window.showQuickMenu = showQuickMenu;
  window.fitText = fitText;
  window.UI = {
    showModal, showConfirmDialog, showBottomSheet, showActionMenu, showDropdown, showQuickMenu, showToast,
    navigateTo, goBack, fitText,
    // for tests and later phases
    _nav: { pageStack, tabStack, layers, get armed() { return armed; } }
  };
})();
