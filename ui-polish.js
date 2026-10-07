(() => {
  "use strict";

  // Budget UI polish layer.
  // Keeps the existing data model and page logic intact while making native selects
  // behave like the rest of the app: no Android/native option popup.

  const SELECTS = new WeakMap();
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const nativeSelectedIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");

  function selectedOption(select) {
    const i = select.selectedIndex;
    return i >= 0 ? select.options[i] : null;
  }

  function syncSelect(select) {
    const ui = SELECTS.get(select);
    if (!ui) return;
    const option = selectedOption(select);
    ui.label.textContent = option ? option.textContent : (select.getAttribute("placeholder") || "Select an option");
    ui.trigger.disabled = !!select.disabled;
    ui.trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");
    ui.trigger.setAttribute("aria-expanded", "false");
    ui.trigger.title = option ? option.textContent : "Select an option";
  }

  function optionsFor(select) {
    return Array.from(select.options).map(o => ({
      value: o.value,
      label: o.textContent.trim(),
      disabled: o.disabled
    })).filter(o => !o.disabled);
  }

  function openSelect(select) {
    const ui = SELECTS.get(select);
    if (!ui || select.disabled) return;
    const options = optionsFor(select);
    if (!options.length) return;

    const handle = showDropdown({
      anchor: ui.trigger,
      value: select.value,
      options,
      onSelect(value) {
        if (select.value === value) {
          syncSelect(select);
          return;
        }
        if (nativeValue && nativeValue.set) nativeValue.set.call(select, value);
        else select.value = value;
        syncSelect(select);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    ui.trigger.setAttribute("aria-expanded", "true");
    handle.closed.then(() => {
      if (SELECTS.has(select)) ui.trigger.setAttribute("aria-expanded", "false");
    });
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement) || SELECTS.has(select)) return;
    if (select.dataset.nativeUi === "off") return;

    // Multiple-select controls are not currently used by Budget. Leave them native rather
    // than silently changing their semantics if a future module adds one.
    if (select.multiple || select.size > 1) return;

    const wrapper = document.createElement("div");
    wrapper.className = "ui-select-wrap";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ui-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", select.getAttribute("aria-label") || "Select option");

    const label = document.createElement("span");
    label.className = "ui-select-label";
    const caret = document.createElement("span");
    caret.className = "ui-select-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
    trigger.append(label, caret);

    const parent = select.parentNode;
    if (!parent) return;
    parent.insertBefore(wrapper, select);
    wrapper.append(trigger, select);

    select.classList.add("ui-native-select");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const ui = { wrapper, trigger, label };
    SELECTS.set(select, ui);

    trigger.addEventListener("click", e => {
      e.preventDefault();
      openSelect(select);
    });
    trigger.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openSelect(select);
      }
    });
    select.addEventListener("change", () => syncSelect(select));

    syncSelect(select);
  }

  function enhanceAll(root) {
    if (!root) return;
    if (root instanceof HTMLSelectElement) enhanceSelect(root);
    if (root.querySelectorAll) root.querySelectorAll("select").forEach(enhanceSelect);
  }

  // Programmatic assignments are common throughout the app (category refreshes, editing,
  // workspace switching). Keep the custom trigger in sync without changing those callers.
  if (nativeValue && nativeValue.set) {
    Object.defineProperty(HTMLSelectElement.prototype, "value", {
      configurable: nativeValue.configurable,
      enumerable: nativeValue.enumerable,
      get: nativeValue.get,
      set(v) {
        nativeValue.set.call(this, v);
        queueMicrotask(() => syncSelect(this));
      }
    });
  }
  if (nativeSelectedIndex && nativeSelectedIndex.set) {
    Object.defineProperty(HTMLSelectElement.prototype, "selectedIndex", {
      configurable: nativeSelectedIndex.configurable,
      enumerable: nativeSelectedIndex.enumerable,
      get: nativeSelectedIndex.get,
      set(v) {
        nativeSelectedIndex.set.call(this, v);
        queueMicrotask(() => syncSelect(this));
      }
    });
  }

  enhanceAll(document);

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) enhanceAll(node);
      });
      if (m.target instanceof HTMLSelectElement) {
        syncSelect(m.target);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ---- Global layout refinements ----
  const style = document.createElement("style");
  style.textContent = `
    /* Consistent mobile controls */
    .ui-select-wrap{position:relative;width:100%;min-width:0}
    .ui-native-select{position:absolute!important;inset:auto!important;width:1px!important;height:1px!important;min-height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}
    .ui-select-trigger{width:100%;min-height:50px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;background:var(--ctl-bg)!important;color:var(--text)!important;border:1px solid var(--border)!important;border-radius:12px!important;font:inherit;font-size:16px!important;line-height:1.2;box-shadow:none;cursor:pointer;transition:border-color .15s ease,background .15s ease,transform .08s ease}
    .ui-select-trigger:focus-visible{outline:2px solid var(--text);outline-offset:2px}
    .ui-select-trigger:active{transform:scale(.995)}
    .ui-select-trigger:disabled{opacity:.5;cursor:not-allowed}
    .ui-select-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ui-select-caret{flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:var(--text-secondary)}
    .ui-select-caret svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    label>.ui-select-wrap{margin-top:1px}

    /* Inputs: one control language across every page and dialog. */
    input:not([type="file"]),textarea{min-height:50px;padding:12px 14px!important;background:var(--ctl-bg)!important;color:var(--text)!important;border:1px solid var(--border)!important;border-radius:12px!important;box-shadow:none!important;font-size:16px!important}
    textarea{min-height:110px;line-height:1.45;resize:vertical}
    input:not([type="file"]):focus,textarea:focus{outline:2px solid color-mix(in srgb,var(--text) 18%,transparent)!important;outline-offset:0;border-color:var(--text)!important}
    input::placeholder,textarea::placeholder{color:var(--text-secondary);opacity:.8}
    input[type="date"],input[type="time"],input[type="month"]{font-variant-numeric:tabular-nums}

    /* Prevent long labels/numbers from creating horizontal scroll. */
    body,main,section,.pBody,.pCard,.ui-panel{min-width:0;max-width:100%}
    h1,h2,h3,p,strong,span,button,label{overflow-wrap:anywhere}
    button{font-family:inherit}

    /* Cards/pages: a little more breathing room on compact Android screens. */
    section{min-width:0}
    .pBody{padding-left:var(--gutter)!important;padding-right:var(--gutter)!important;padding-bottom:calc(112px + env(safe-area-inset-bottom,0px))!important}
    .pCard{padding:16px!important;margin-bottom:12px!important}
    .ui-modal .ui-panel{max-width:min(420px,calc(100vw - 28px));padding:20px}
    .ui-drop .ui-panel{max-width:calc(100vw - 20px);box-shadow:0 16px 42px rgba(0,0,0,.24);border-color:var(--border)}
    .ui-opt{min-height:50px;padding:0 12px;border-radius:10px}

    /* Bottom navigation remains comfortable with gesture/navigation bars. */
    #tabBar{padding-bottom:env(safe-area-inset-bottom,0px)!important}
    #tabBar button{min-width:0}

    @media (min-width:700px){
      main{max-width:680px}
      .pBody{max-width:720px;margin:0 auto}
      .ui-select-trigger{min-height:52px}
    }
    @media (max-width:360px){
      :root{--gutter:14px}
      header{padding-left:14px!important;padding-right:14px!important}
      header h1{max-width:32vw}
      header #month{max-width:128px;padding:0 10px}
      .ui-select-trigger{padding-left:12px;padding-right:12px}
      .ui-btn{padding-left:16px;padding-right:16px}
    }
    @media (prefers-reduced-motion:reduce){
      .ui-select-trigger{transition:none}
    }
  `;
  document.head.appendChild(style);

  // Replace the last remaining informational native alerts with the app toast. This is deliberately
  // limited to alerts: synchronous confirm/prompt calls are kept compatible with existing workflows.
  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.alert = message => {
    if (typeof window.showToast === "function") {
      window.showToast(String(message), { type: /error|invalid|could not|cannot|wrong|failed/i.test(String(message)) ? "error" : "" });
    } else if (nativeAlert) {
      nativeAlert(message);
    }
  };

  // Make stale service-worker builds less likely to survive an update.
  window.addEventListener("load", () => {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg && reg.update) reg.update();
        }).catch(() => {});
      }
    } catch (e) {}
  });
})();
