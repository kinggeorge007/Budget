(() => {
  "use strict";

  // Floating Quick Add gesture control.
  // Tap = existing quick menu
  // Swipe up = Expense
  // Swipe down = Income
  // Swipe left/right = Note

  const ICON_IN =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="7 8 7 17 16 17"/></svg>';
  const ICON_OUT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/></svg>';
  const ICON_NOTE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

  function openQuickAdd(anchor) {
    showQuickMenu({
      anchor: anchor || document.querySelector("#tabBar .plusBtn"),
      label: "Quick add",
      items: [
        { label: "IN", aria: "Add income", icon: ICON_IN, tone: "in", onSelect: () => openAdd("income") },
        { label: "OUT", aria: "Add expense", icon: ICON_OUT, tone: "out", onSelect: () => openAdd("expense") },
        { label: "NOTE", aria: "New note", icon: ICON_NOTE, onSelect: () => openPage("New note", b => noteEditor(b, null)) }
      ]
    });
  }

  function installGestureButton(btn) {
    if (!btn || btn.dataset.gestureReady === "1") return;
    btn.dataset.gestureReady = "1";
    btn.setAttribute("aria-label", "Quick add. Swipe up for expense, down for income, left or right for note");
    btn.setAttribute("aria-haspopup", "menu");
    btn.classList.add("gesturePlus");

    let startX = 0, startY = 0, active = false, moved = false;
    const threshold = 42;

    const feedback = (action, progress) => {
      btn.dataset.gesture = action || "";
      btn.style.setProperty("--gesture-progress", String(Math.min(1, Math.max(0, progress || 0))));
    };

    btn.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      active = true;
      moved = false;
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      feedback("", 0);
    });

    btn.addEventListener("pointermove", e => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) return;
      moved = true;
      const vertical = Math.abs(dy) >= Math.abs(dx);
      const amount = vertical ? Math.abs(dy) : Math.abs(dx);
      if (amount < 10) return;
      let action;
      if (vertical) action = dy < 0 ? "expense" : "income";
      else action = "note";
      feedback(action, amount / threshold);
    });

    btn.addEventListener("pointerup", e => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const distance = Math.hypot(dx, dy);
      let action = null;
      if (distance >= threshold) {
        if (ay >= ax) action = dy < 0 ? "expense" : "income";
        else action = "note";
      }
      feedback(action || "", action ? 1 : 0);

      if (action === "expense") {
        e.preventDefault();
        openAdd("expense");
      } else if (action === "income") {
        e.preventDefault();
        openAdd("income");
      } else if (action === "note") {
        e.preventDefault();
        openPage("New note", b => noteEditor(b, null));
      } else if (!moved || distance < 12) {
        e.preventDefault();
        openQuickAdd(btn);
      }

      window.setTimeout(() => feedback("", 0), 180);
    });

    btn.addEventListener("pointercancel", () => {
      active = false;
      feedback("", 0);
    });
  }

  window.openQuickAdd = openQuickAdd;
  window.installQuickAddGesture = installGestureButton;
})();
