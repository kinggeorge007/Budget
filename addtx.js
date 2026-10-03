"use strict";
// SalaryPlan Stage 11: floating Add (+) button. The existing add form opens in a pop-up.

const addStyle = document.createElement("style");
addStyle.textContent =
  "#addDlg{width:calc(100% - 32px);max-width:560px;max-height:92vh;overflow:auto;border:1px solid var(--line);border-radius:18px;background:var(--bg);color:var(--text);padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.4)}" +
  "#addDlg::backdrop{background:rgba(0,0,0,.6)}" +
  "#fab{position:fixed;right:16px;bottom:78px;z-index:11;width:56px;height:56px;min-height:0;padding:0;border:0;border-radius:50%;background:linear-gradient(135deg,#0b6b43,#10a066);color:#fff;font-size:2rem;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.35)}";
document.head.appendChild(addStyle);

// Keep direct references, because the form leaves the page's main area when we move it.
const addForm = $("txForm");
const addSection = addForm.closest("section");

const addDlg = document.createElement("dialog");
addDlg.id = "addDlg";
const addTitle = document.createElement("h2");
addTitle.textContent = "Add transaction";
addTitle.style.margin = "0 0 12px";
addDlg.appendChild(addTitle);
addDlg.appendChild(addForm);
document.body.appendChild(addDlg);

const addCancel = document.createElement("button");
addCancel.type = "button";
addCancel.className = "secondary";
addCancel.textContent = "Cancel";
addCancel.onclick = () => addDlg.close();
addForm.appendChild(addCancel);

// The old section is now empty, so remove it from the Home tab.
TABS[0].parts = TABS[0].parts.filter(p => p !== addSection);
addSection.style.display = "none";

const fab = document.createElement("button");
fab.id = "fab";
fab.type = "button";
fab.textContent = "+";
fab.setAttribute("aria-label", "Add transaction");
fab.onclick = () => {
  $("date").value = today();
  $("time").value = nowTime();
  addDlg.showModal();
};
document.body.appendChild(fab);

// Close the pop-up after a successful save (the amount box is cleared on success).
addForm.addEventListener("submit", () => {
  if ($("amount").value === "") addDlg.close();
});
