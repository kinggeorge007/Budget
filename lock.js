"use strict";
// SalaryPlan: PIN lock. This is a screen lock, not encryption.

ICONS.lock = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

const lkStyle = document.createElement("style");
lkStyle.textContent = `
html.locked body > *:not(#lockDlg){visibility:hidden}
#lockDlg{display:none}
#lockDlg[open]{position:fixed;top:0;left:0;width:100%;max-width:100%;height:100%;max-height:100%;margin:0;border:0;padding:24px 16px;background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center}
#lockDlg::backdrop{background:var(--bg)}
.lockBrand{color:var(--accent);margin:0 0 20px}
.lockBrand::before{display:none}
.padWrap{text-align:center;width:100%;max-width:320px;margin:0 auto}
.padWrap h3{margin:0}
.padDots{display:flex;gap:16px;justify-content:center;margin:18px 0 6px}
.padDots span{width:16px;height:16px;border-radius:50%;border:2px solid var(--accent2)}
.padDots span.on{background:var(--accent2)}
.padMsg{min-height:1.4em;color:var(--danger);margin:6px 0 14px;font-size:.9rem}
.padGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;justify-items:center}
.padGrid button{width:68px;height:68px;min-height:0;padding:0;border-radius:50%;border:0;background:var(--card);color:var(--text);font-size:1.5rem;font-weight:600;box-shadow:var(--shadow)}
.padGrid .blank{visibility:hidden}
`;
document.head.appendChild(lkStyle);

// ---- PIN storage (salted PBKDF2 hash, never the PIN itself) ----
function bytesToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(h) { return new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16))); }

async function pinHash(pin, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 100000, hash: "SHA-256" }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function getRec() {
  try {
    const r = JSON.parse(lsGet("sp_pin"));
    return r && r.salt && r.hash ? r : null;
  } catch (e) { return null; }
}

async function checkPin(pin) {
  const rec = getRec();
  if (!rec) return true;
  return (await pinHash(pin, rec.salt)) === rec.hash;
}

async function savePin(pin) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  lsSet("sp_pin", JSON.stringify({ salt: salt, hash: await pinHash(pin, salt) }));
  lsSet("sp_pin_fail", "0");
  lsSet("sp_pin_until", "0");
}

// ---- Keypad component (4 digits) ----
function buildPad(parent, opts) {
  const wrap = mkEl("div", "padWrap");
  const title = mkEl("h3", "", opts.title);
  const dots = mkEl("div", "padDots");
  for (let i = 0; i < 4; i++) dots.appendChild(mkEl("span"));
  const msg = mkEl("p", "padMsg", "");
  const grid = mkEl("div", "padGrid");
  let entry = "";
  let off = false;

  function draw() {
    Array.from(dots.children).forEach((d, i) => { d.className = i < entry.length ? "on" : ""; });
  }
  const api = {
    setTitle: t => { title.textContent = t; },
    setMsg: t => { msg.textContent = t; },
    clear: () => { entry = ""; draw(); },
    disable: v => { off = v; grid.style.opacity = v ? ".4" : "1"; }
  };
  function press(d) {
    if (off || entry.length >= 4) return;
    entry += d;
    draw();
    if (entry.length === 4) {
      const p = entry;
      setTimeout(() => opts.onComplete(p, api), 120);
    }
  }
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].forEach(k => {
    const b = mkEl("button", k === "" ? "blank" : "", k);
    b.type = "button";
    if (k === "⌫") {
      b.setAttribute("aria-label", "Delete");
      b.onclick = () => { if (!off) { entry = entry.slice(0, -1); draw(); } };
    } else if (k !== "") {
      b.onclick = () => press(k);
    }
    grid.appendChild(b);
  });
  wrap.append(title, dots, msg, grid);
  parent.appendChild(wrap);
  return api;
}

// ---- Lock screen ----
let locked = false;
const lockDlg = mkEl("dialog");
lockDlg.id = "lockDlg";
lockDlg.appendChild(mkEl("h2", "lockBrand", "SalaryPlan"));

async function tryUnlock(pin, api) {
  const now = Date.now();
  const until = Number(lsGet("sp_pin_until") || 0);
  if (now < until) {
    api.setMsg("Too many attempts. Try again in " + Math.ceil((until - now) / 1000) + " seconds.");
    api.clear();
    return;
  }
  if (await checkPin(pin)) {
    lsSet("sp_pin_fail", "0");
    lsSet("sp_pin_until", "0");
    api.setMsg("");
    api.clear();
    unlock();
    return;
  }
  const f = Number(lsGet("sp_pin_fail") || 0) + 1;
  lsSet("sp_pin_fail", String(f));
  if (f % 5 === 0) {
    const wait = 30 * (f / 5);
    lsSet("sp_pin_until", String(Date.now() + wait * 1000));
    api.setMsg("Too many wrong attempts. Wait " + wait + " seconds.");
  } else {
    api.setMsg("Wrong PIN. " + (5 - (f % 5)) + " tries left before a wait.");
  }
  api.clear();
}

const lockPad = buildPad(lockDlg, { title: "Enter your PIN", onComplete: tryUnlock });

const forgot = mkEl("button", "secondary", "Forgot PIN?");
forgot.type = "button";
forgot.style.marginTop = "18px";
forgot.onclick = () => {
  if (!confirm("A forgotten PIN cannot be recovered. To continue you must ERASE all SalaryPlan data on this phone and then restore from a backup file. Erase now?")) return;
  if (!confirm("Last chance: erase everything on this phone?")) return;
  lsDel(KEY);
  ["sp_pin", "sp_pin_fail", "sp_pin_until"].forEach(lsDel);
  location.reload();
};
lockDlg.appendChild(forgot);
document.body.appendChild(lockDlg);

// The lock screen cannot be dismissed with Back or Escape.
lockDlg.addEventListener("cancel", e => e.preventDefault());
lockDlg.addEventListener("close", () => { if (locked) lockDlg.showModal(); });

function showLock() {
  if (!getRec()) return;
  [pageDlg, addDlg, eDlg].forEach(d => { try { if (d && d.open) d.close(); } catch (e) {} });
  locked = true;
  document.documentElement.classList.add("locked");
  lockPad.clear();
  lockPad.setMsg("");
  if (!lockDlg.open) lockDlg.showModal();
}

function unlock() {
  locked = false;
  document.documentElement.classList.remove("locked");
  if (lockDlg.open) lockDlg.close();
}

// ---- Auto-lock when you come back to the app ----
function lockDelay() { return Number(lsGet("sp_lock_delay") || 60); }
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
  } else if (getRec() && hiddenAt && Date.now() - hiddenAt >= lockDelay() * 1000) {
    showLock();
  }
});

// ---- Security page (opened from the menu) ----
function verifyThen(body, titleText, onOk) {
  buildPad(body, {
    title: titleText,
    onComplete: async (pin, api) => {
      if (await checkPin(pin)) onOk();
      else { api.setMsg("Wrong PIN."); api.clear(); }
    }
  });
}

function setPinPage(body) {
  let first = null;
  buildPad(body, {
    title: "Choose a new 4-digit PIN",
    onComplete: async (pin, api) => {
      if (first === null) {
        first = pin;
        api.setTitle("Enter it again to confirm");
        api.setMsg("");
        api.clear();
      } else if (pin === first) {
        api.disable(true);
        await savePin(pin);
        api.setMsg("PIN saved.");
        setTimeout(() => openPage("Security", securityPage), 700);
      } else {
        first = null;
        api.setTitle("Choose a new 4-digit PIN");
        api.setMsg("The two PINs did not match. Try again.");
        api.clear();
      }
    }
  });
}

function securityPage(body) {
  const rec = getRec();
  const c = card(body, "PIN lock", [
    rec ? "PIN lock is ON. SalaryPlan asks for your PIN when you open it."
        : "PIN lock is OFF. Anyone who opens this app on your phone can see your finances."
  ]);
  const mk = (text, cls, fn) => {
    const b = mkEl("button", cls, text);
    b.type = "button";
    b.style.marginRight = "8px";
    b.style.marginTop = "6px";
    b.onclick = fn;
    c.appendChild(b);
  };
  if (!rec) {
    mk("Set PIN", "primary", () => openPage("Set PIN", setPinPage));
  } else {
    mk("Lock now", "primary", () => { pageDlg.close(); showLock(); });
    mk("Change PIN", "secondary", () => openPage("Change PIN", p =>
      verifyThen(p, "Enter your current PIN", () => openPage("New PIN", setPinPage))));
    mk("Turn off PIN", "secondary", () => openPage("Turn off PIN", p =>
      verifyThen(p, "Enter your PIN to turn it off", () => {
        ["sp_pin", "sp_pin_fail", "sp_pin_until"].forEach(lsDel);
        openPage("Security", securityPage);
      })));

    const al = card(body, "Lock when I come back after", []);
    const opts = mkEl("div", "pOpts");
    [["0", "Every time"], ["60", "1 minute"], ["300", "5 minutes"]].forEach(o => {
      const b = mkEl("button", String(lockDelay()) === o[0] ? "on" : "", o[1]);
      b.type = "button";
      b.onclick = () => { lsSet("sp_lock_delay", o[0]); openPage("Security", securityPage); };
      opts.appendChild(b);
    });
    al.appendChild(opts);
  }
  card(body, "Good to know", [
    "The PIN keeps other people out of the app on this phone. It does not encrypt your data.",
    "Backup files and CSV downloads are not protected by the PIN, so keep them somewhere safe.",
    "If you forget your PIN, the only way back in is to erase the app's data on this phone and restore a backup. Export a backup regularly."
  ]);
}

// ---- "Security" in the slide-out menu (after Notes and Settings) ----
const secItem = mkEl("button", "dItem");
secItem.type = "button";
const secIc = mkEl("span", "ic");
secIc.innerHTML = svgIcon("lock");
secItem.append(secIc, mkEl("span", "", "Security"));
secItem.onclick = () => openPage("Security", securityPage);
const menuItems = drawer.querySelectorAll(".dItem");
drawer.insertBefore(secItem, menuItems[2] || drawer.querySelector(".dFoot"));

// Lock straight away if a PIN is set.
if (getRec()) showLock();
window.spLockReady = true;
