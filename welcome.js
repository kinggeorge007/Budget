"use strict";
// SalaryPlan: welcome screen, PIN recovery code and "Send backup".

const RC_ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, no 0/O/1/I

const wStyle = document.createElement("style");
wStyle.textContent = `
#welDlg{position:fixed;top:0;left:0;width:100%;max-width:100%;height:100%;max-height:100%;margin:0;border:0;padding:0;background:var(--bg);color:var(--text);overflow:auto}
.welBody{max-width:520px;margin:0 auto;padding:36px 20px 40px}
.welLogo{width:72px;height:72px;border-radius:22px;background:linear-gradient(135deg,#00b36b,#009a5c);color:#fff;font-size:2.4rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.welBody h1{margin:0 0 6px}
.rcCode{font-family:ui-monospace,monospace;font-weight:700;font-size:1.6rem;letter-spacing:.08em;text-align:center;padding:16px;background:var(--card);border-radius:16px;margin:12px 0;word-break:break-all;user-select:all}
`;
document.head.appendChild(wStyle);

// ---- Recovery code ----
function newRecoveryCode() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += RC_ALPHA[b[i] % 32];
    if (i % 4 === 3 && i < 11) s += "-";
  }
  return s;
}
function cleanCode(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

function getRecov() {
  try {
    const r = JSON.parse(lsGet("sp_recov"));
    return r && r.salt && r.hash ? r : null;
  } catch (e) { return null; }
}
async function saveRecovery(code) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  lsSet("sp_recov", JSON.stringify({ salt: salt, hash: await pinHash(cleanCode(code), salt) }));
}
async function checkRecovery(code) {
  const r = getRecov();
  if (!r) return false;
  return (await pinHash(cleanCode(code), r.salt)) === r.hash;
}

function recoveryPage(body, code) {
  card(body, "Your recovery code", [
    "Save this code. If you forget your PIN, it lets you set a new one without erasing your data.",
    "Anyone who has this code can reset your PIN, so keep it private. If you email it to yourself, anyone who can open that inbox can use it."
  ]);
  body.appendChild(mkEl("div", "rcCode", code));
  const bar = mkEl("div", "nBar");
  const mail = mkEl("button", "secondary", "Email it to myself");
  mail.type = "button";
  mail.onclick = () => {
    location.href = "mailto:?subject=" + encodeURIComponent("SalaryPlan recovery code") +
      "&body=" + encodeURIComponent("My SalaryPlan recovery code: " + code + "\n\nKeep this email private.");
  };
  const copy = mkEl("button", "secondary", "Copy");
  copy.type = "button";
  copy.onclick = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => alert("Copied."), () => alert("Could not copy. Please write the code down."));
    else alert("Could not copy. Please write the code down.");
  };
  bar.append(mail, copy);
  body.appendChild(bar);
  const done = mkEl("button", "primary", "I saved it");
  done.type = "button";
  done.style.width = "100%";
  done.style.marginTop = "12px";
  done.onclick = () => openPage("Security", securityPage);
  body.appendChild(done);
}

// Create a recovery code right after a PIN is set.
let rcAfterSave = false, rcForceNew = false;
const baseSavePin = savePin;
savePin = async function (pin) {
  const had = !!getRec();
  await baseSavePin(pin);
  rcAfterSave = true;
  if (!had) rcForceNew = true;
};

const baseSecurityPage = securityPage;
securityPage = function (body) {
  if (rcAfterSave) {
    rcAfterSave = false;
    if (!getRecov() || rcForceNew) {
      rcForceNew = false;
      body.appendChild(mkEl("p", "muted", "Creating your recovery code..."));
      const code = newRecoveryCode();
      saveRecovery(code).then(() => openPage("Recovery code", b => recoveryPage(b, code)));
      return;
    }
  }
  baseSecurityPage(body);
  if (getRec()) {
    const c = card(body, "Recovery code", [
      getRecov() ? "A recovery code is set. You can create a new one if you lost it."
                 : "No recovery code yet. Create one so a forgotten PIN does not mean erasing your data."
    ]);
    const b = mkEl("button", "secondary", getRecov() ? "Create a new recovery code" : "Create recovery code");
    b.type = "button";
    b.onclick = () => openPage("Recovery code", p =>
      verifyThen(p, "Enter your PIN", async () => {
        const code = newRecoveryCode();
        await saveRecovery(code);
        openPage("Recovery code", pb => recoveryPage(pb, code));
      }));
    c.appendChild(b);
  }
};

// ---- "Forgot PIN?" on the lock screen: use the recovery code ----
const padWrapEl = lockDlg.querySelector(".padWrap");
const recPanel = mkEl("div", "padWrap");
recPanel.style.display = "none";
const recInput = document.createElement("input");
recInput.type = "text";
recInput.placeholder = "XXXX-XXXX-XXXX";
recInput.maxLength = 20;
recInput.autocomplete = "off";
recInput.setAttribute("autocapitalize", "characters");
recInput.setAttribute("aria-label", "Recovery code");
recInput.style.textAlign = "center";
const recMsg = mkEl("p", "padMsg", "");
const recGo = mkEl("button", "primary", "Reset PIN");
const recErase = mkEl("button", "secondary", "Erase all data instead");
const recBack = mkEl("button", "secondary", "Back");
[recGo, recErase, recBack].forEach(b => { b.type = "button"; b.style.width = "100%"; b.style.marginTop = "10px"; });
recPanel.append(
  mkEl("h3", "", "Reset your PIN"),
  mkEl("p", "muted", "Enter the recovery code you saved when you set your PIN."),
  recInput, recMsg, recGo, recErase, recBack
);
lockDlg.appendChild(recPanel);

function closeRecovery() {
  recPanel.style.display = "none";
  padWrapEl.style.display = "";
  forgot.style.display = "";
  recInput.value = "";
  recMsg.textContent = "";
}

forgot.onclick = () => {
  padWrapEl.style.display = "none";
  forgot.style.display = "none";
  recPanel.style.display = "block";
  recGo.disabled = !getRecov();
  recMsg.textContent = getRecov() ? "" :
    "No recovery code was created for this PIN. The only way in is to erase this app's data and restore a backup.";
};
recBack.onclick = closeRecovery;

recErase.onclick = () => {
  if (!confirm("This ERASES all SalaryPlan data on this phone. You can restore it later from a backup file. Continue?")) return;
  if (!confirm("Last chance: erase everything on this phone?")) return;
  lsDel(KEY);
  ["sp_pin", "sp_pin_fail", "sp_pin_until", "sp_recov"].forEach(lsDel);
  location.reload();
};

recGo.onclick = async () => {
  const until = Number(lsGet("sp_pin_until") || 0);
  if (Date.now() < until) {
    recMsg.textContent = "Too many attempts. Try again in " + Math.ceil((until - Date.now()) / 1000) + " seconds.";
    return;
  }
  if (await checkRecovery(recInput.value)) {
    lsSet("sp_pin_fail", "0");
    lsSet("sp_pin_until", "0");
    closeRecovery();
    rcForceNew = true;
    unlock();
    openPage("New PIN", setPinPage);
    return;
  }
  const f = Number(lsGet("sp_pin_fail") || 0) + 1;
  lsSet("sp_pin_fail", String(f));
  if (f % 5 === 0) {
    const wait = 30 * (f / 5);
    lsSet("sp_pin_until", String(Date.now() + wait * 1000));
    recMsg.textContent = "Too many wrong attempts. Wait " + wait + " seconds.";
  } else {
    recMsg.textContent = "That code is not right.";
  }
};

// ---- Send backup (phone share sheet) ----
async function shareBackup() {
  const name = "salaryplan-backup-" + today() + ".json";
  try {
    const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "SalaryPlan backup" });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  alert("Sharing a file is not available on this phone. Tap Export backup instead, then attach the file in your email app.");
}

const baseBackupPage = backupPage;
backupPage = function (body) {
  baseBackupPage(body);
  const c = card(body, "Send a copy", [
    "Send a backup file to your own email, WhatsApp or Google Drive, or save it on your phone. The file is not protected by your PIN, so only send it to places you trust."
  ]);
  const b = mkEl("button", "secondary", "Send backup...");
  b.type = "button";
  b.onclick = shareBackup;
  c.appendChild(b);
};

// ---- Welcome screen (first launch) ----
function applyName() {
  const n = lsGet("sp_name");
  const sub = drawer.querySelector(".dHead span");
  if (n && sub) sub.textContent = "Hi, " + n;
}
applyName();

const welDlg = mkEl("dialog");
welDlg.id = "welDlg";
const wb = mkEl("div", "welBody");
wb.appendChild(mkEl("div", "welLogo", "₦"));
wb.appendChild(mkEl("h1", "", "Welcome to SalaryPlan"));
wb.appendChild(mkEl("p", "muted", "A simple way to plan your money, month by month."));
card(wb, "Plan your money", ["Set a budget, track income and expenses, keep up with monthly bills and reach your savings goals."]);
card(wb, "Private by design", ["There is no account to create. Your data stays on this phone. No ads and no tracking."]);
card(wb, "Back up regularly", ["If you lose or reset your phone, a backup file is the only way to get your data back. Find it in the menu under Backup and restore."]);
const nameIn = document.createElement("input");
nameIn.type = "text";
nameIn.maxLength = 30;
nameIn.placeholder = "What should we call you? (optional)";
nameIn.setAttribute("aria-label", "Your name");
nameIn.style.marginBottom = "12px";
wb.appendChild(nameIn);
const wStart = mkEl("button", "primary", "Get started");
const wPin = mkEl("button", "secondary", "Set a PIN");
[wStart, wPin].forEach(b => { b.type = "button"; b.style.width = "100%"; b.style.marginTop = "8px"; });
wb.append(wStart, wPin);
welDlg.appendChild(wb);
document.body.appendChild(welDlg);

function saveName() {
  const n = nameIn.value.trim().slice(0, 30);
  if (n) { lsSet("sp_name", n); applyName(); }
}
welDlg.addEventListener("close", () => lsSet("sp_welcomed", "1"));
wStart.onclick = () => { saveName(); welDlg.close(); };
wPin.onclick = () => { saveName(); welDlg.close(); openPage("Set PIN", setPinPage); };

if (!lsGet("sp_welcomed")) {
  if (getRec()) lsSet("sp_welcomed", "1"); // existing PIN users skip it
  else welDlg.showModal();
                    }
// ---- "Welcome tour" in the slide-out menu, so the welcome screen can be reopened ----
const welItem = mkEl("button", "dItem");
welItem.type = "button";
const welIc = mkEl("span", "ic");
welIc.innerHTML = svgIcon("home");
welItem.append(welIc, mkEl("span", "", "Welcome tour"));
welItem.onclick = () => {
  closeDrawer();
  if (!welDlg.open) welDlg.showModal();
};
drawer.insertBefore(welItem, drawer.querySelector(".dFoot"));
