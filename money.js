(() => {
  "use strict";

  // Budget money inputs (Phase 2).
  //
  // The field SHOWS  ₦1,000,000  while the person types, but input.value still returns the clean
  // number  "1000000". Every existing piece of code that reads or writes .value (saving, editing,
  // clearing, budget totals) keeps working unchanged, and nothing formatted is ever stored.
  //
  // How: each money input becomes type="text" inputmode="decimal" and gets its own `value` property
  //   get  -> strips the symbol and commas
  //   set  -> formats whatever it is given ("2500.50" -> "₦2,500.50")
  // The symbol comes from the existing currency setting (curSym in currency.js).

  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const MAX_INT_DIGITS = 12;
  const STATIC_IDS = ["amount", "eAmount", "billAmount", "goalTarget", "contribAmount"];

  const symbol = () => (typeof curSym === "string" && curSym) || "\u20A6";

  // "₦1,234.5x" -> "1234.5"   (digits, one dot, max two decimals, no leading zeros)
  function clean(raw) {
    let s = String(raw == null ? "" : raw).replace(/[^\d.]/g, "");
    if (!s) return "";
    const dot = s.indexOf(".");
    let int = dot < 0 ? s : s.slice(0, dot);
    let dec = dot < 0 ? null : s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    int = int.replace(/^0+(?=\d)/, "").slice(0, MAX_INT_DIGITS);
    if (int === "") int = "0";
    return dec === null ? int : int + "." + dec;
  }

  function group(int) {
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // "1234.5" -> "₦1,234.5"
  function display(c) {
    if (!c) return "";
    const dot = c.indexOf(".");
    return symbol() + group(dot < 0 ? c : c.slice(0, dot)) + (dot < 0 ? "" : c.slice(dot));
  }

  // Programmatic values: "25000.00" -> "25000" (keep real decimals, drop a pointless .00)
  function tidy(c) {
    return /\.0*$/.test(c) ? c.replace(/\.0*$/, "") : c;
  }

  // Public helper: formatCurrency(1000) -> "₦1,000"; formatCurrency(1000, { decimals: true }) -> "₦1,000.00"
  function formatCurrency(value, opts) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const fixed = !!(opts && opts.decimals);
    const body = Math.abs(n).toLocaleString("en", {
      minimumFractionDigits: fixed ? 2 : 0,
      maximumFractionDigits: 2
    });
    return (n < 0 ? "-" : "") + symbol() + body;
  }

  function attach(el) {
    if (el._money) return;
    el._money = true;
    const initial = nativeValue.get.call(el);

    el.type = "text";
    el.inputMode = "decimal";
    el.autocomplete = "off";
    el.setAttribute("autocapitalize", "off");
    el.removeAttribute("step");
    el.removeAttribute("min");
    el.setAttribute("data-money", "1");

    Object.defineProperty(el, "value", {
      configurable: true,
      get() { return clean(nativeValue.get.call(el)); },
      set(v) { nativeValue.set.call(el, display(tidy(clean(v)))); }
    });
    if (initial) el.value = initial;

    el.addEventListener("beforeinput", e => {
      // Backspace / Delete next to a comma should remove the digit, not appear to do nothing.
      if (el.selectionStart !== el.selectionEnd) return;
      const shown = nativeValue.get.call(el);
      const p = el.selectionStart;
      if (e.inputType === "deleteContentBackward" && shown[p - 1] === ",") el.setSelectionRange(p - 1, p - 1);
      else if (e.inputType === "deleteContentForward" && shown[p] === ",") el.setSelectionRange(p + 1, p + 1);
    });

    el.addEventListener("input", () => {
      const raw = nativeValue.get.call(el);
      const caret = el.selectionStart;
      const atEnd = caret == null || caret >= raw.length;
      const wanted = raw.slice(0, caret == null ? raw.length : caret).replace(/[^\d.]/g, "").length;

      const out = display(clean(raw));
      if (out !== raw) nativeValue.set.call(el, out);

      let pos = out.length;
      if (!atEnd) {
        let seen = 0;
        pos = 0;
        while (pos < out.length && seen < wanted) {
          if (/[\d.]/.test(out[pos])) seen++;
          pos++;
        }
      }
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    });
  }

  function isMoney(el) {
    if (!el || el.tagName !== "INPUT" || el._money || el.dataset.plain) return false;
    if (STATIC_IDS.indexOf(el.id) >= 0) return true;
    if (el.type !== "number") return false;
    const hint = ((el.placeholder || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
    return el.inputMode === "decimal" || /amount|price|planned|0\.00|\u20A6/.test(hint);
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (isMoney(root)) attach(root);
    root.querySelectorAll && root.querySelectorAll("input").forEach(i => { if (isMoney(i)) attach(i); });
  }

  scan(document.body);
  new MutationObserver(list => {
    list.forEach(m => m.addedNodes.forEach(scan));
  }).observe(document.body, { childList: true, subtree: true });

  // Changing the currency in Settings re-draws every symbol in place.
  if (typeof applyCurrency === "function") {
    const baseApply = applyCurrency;
    applyCurrency = function () {
      baseApply();
      document.querySelectorAll("input[data-money]").forEach(i => { i.value = i.value; });
    };
  }

  window.formatCurrency = formatCurrency;
})();
