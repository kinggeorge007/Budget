(() => {
  "use strict";

  // Budget quick add (Phase 3): the round + button in the bottom bar.
  // IN   -> the existing Add transaction pop-up, set to Income
  // OUT  -> the same pop-up, set to Expense
  // NOTE -> the existing New note screen
  // Nothing new is built here; it only routes to screens that already exist.

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

  window.openQuickAdd = openQuickAdd;
})();
