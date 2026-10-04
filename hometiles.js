"use strict";
// Home screen: show Calculator and Converter as their own tiles, plus a More tile.
(function () {
  function makeTile(label, icon, fn) {
    const b = document.createElement("button");
    b.type = "button";
    const ic = document.createElement("span");
    ic.className = "ic";
    ic.innerHTML = svgIcon(icon);
    const l = document.createElement("span");
    l.textContent = label;
    b.append(ic, l);
    b.onclick = fn;
    return b;
  }

  // The old "Tools" tile becomes Calculator.
  qa.querySelectorAll("button").forEach(b => {
    const l = b.querySelector("span:not(.ic)");
    if (l && l.textContent === "Tools") {
      b.querySelector(".ic").innerHTML = svgIcon("calc");
      l.textContent = "Calculator";
      b.onclick = () => openPage("Calculator", calculatorPage);
    }
  });

  qa.appendChild(makeTile("Converter", "swap", () => openPage("Currency converter", converterPage)));
  qa.appendChild(makeTile("More", "grid", () => openPage("More tools", toolsPage)));
})();
