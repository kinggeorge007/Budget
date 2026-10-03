"use strict";
// Home screen: swap the Backup tile for a Notes tile (Backup stays in the menu).
(function () {
  const tiles = document.querySelectorAll(".qa button");
  tiles.forEach(b => {
    const label = b.querySelector("span:not(.ic)");
    if (label && label.textContent === "Backup") {
      b.querySelector(".ic").innerHTML = svgIcon("note");
      label.textContent = "Notes";
      b.onclick = () => openPage("Notes", notesPage);
    }
  });
})();
