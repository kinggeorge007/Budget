"use strict";
// Budget profile (Phase 5).
//
// There are no accounts or servers in this app, so the profile lives on the phone like everything else:
//   sp_name    the name the app already stores (set on the welcome screen)  -- reused, same key
//   sp_avatar  the photo, resized in the browser to a small square JPEG (about 20 KB)
// Nothing here talks to a network or touches transactions, budgets or notes.

const PROFILE_PHOTO = 256;           // px, square
const PROFILE_MAX_FILE = 15 * 1024 * 1024;

function profileGet(key) {
  try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
}
function profileSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    return true;
  } catch (e) { return false; }
}

// Round avatar: the photo, else the first letter of the name, else a person outline.
function avatarEl(size, photo, name) {
  const a = mkEl("div", "avatar " + (size || "md"));
  const src = photo === undefined ? profileGet("sp_avatar") : photo;
  const nm = name === undefined ? profileGet("sp_name") : name;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    a.appendChild(img);
  } else if (nm) {
    a.textContent = nm.trim().charAt(0).toUpperCase();
  } else {
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  }
  return a;
}

// Read a picked file, crop to a centred square and shrink it. Resolves to a JPEG data URL.
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("Please choose an image.")); return; }
    if (file.size > PROFILE_MAX_FILE) { reject(new Error("That photo is too large.")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const c = document.createElement("canvas");
        c.width = c.height = PROFILE_PHOTO;
        const g = c.getContext("2d");
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, PROFILE_PHOTO, PROFILE_PHOTO);
        g.drawImage(img, sx, sy, side, side, 0, 0, PROFILE_PHOTO, PROFILE_PHOTO);
        resolve(c.toDataURL("image/jpeg", 0.85));
      } catch (e) { reject(e); }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a photo.")); };
    img.src = url;
  });
}

// Card at the top of More: tap to open the profile.
function profileCard(body) {
  const name = profileGet("sp_name");
  const b = mkEl("button", "profCard");
  b.type = "button";
  b.setAttribute("aria-label", "Open profile");
  b.appendChild(avatarEl("md"));
  const t = mkEl("div", "profTxt");
  t.appendChild(mkEl("strong", "", name || "Your profile"));
  t.appendChild(mkEl("span", "", name ? "View and edit profile" : "Add your name and photo"));
  b.appendChild(t);
  b.appendChild(mkEl("span", "profGo", "\u203A"));
  b.onclick = () => openPage("Profile", profilePage);
  body.appendChild(b);
}

function profilePage(body) {
  const name = profileGet("sp_name");
  const top = mkEl("div", "profTop");
  top.appendChild(avatarEl("lg"));
  top.appendChild(mkEl("h3", "profName", name || "No name yet"));
  top.appendChild(mkEl("p", "muted", "Stored on this phone only"));
  body.appendChild(top);

  const c = mkEl("div", "pCard");
  const row = (k, v) => {
    const r = mkEl("div", "pRow");
    r.append(mkEl("span", "", k), mkEl("strong", "", v));
    c.appendChild(r);
  };
  row("Name", name || "Not set");
  row("Photo", profileGet("sp_avatar") ? "Added" : "Not added");
  body.appendChild(c);

  const edit = mkEl("button", "primary", "Edit profile");
  edit.type = "button";
  edit.style.width = "100%";
  edit.onclick = () => openPage("Edit profile", profileEditPage);
  body.appendChild(edit);
}

function profileEditPage(body) {
  let photo = profileGet("sp_avatar");       // pending value, written on Save
  const holder = mkEl("div", "profTop");
  const fileIn = document.createElement("input");
  fileIn.type = "file";
  fileIn.accept = "image/*";
  fileIn.style.display = "none";
  fileIn.setAttribute("aria-label", "Choose photo");

  const nameIn = document.createElement("input");
  nameIn.type = "text";
  nameIn.maxLength = 30;
  nameIn.placeholder = "Your name";
  nameIn.value = profileGet("sp_name");
  nameIn.setAttribute("aria-label", "Your name");

  function paint() {
    holder.innerHTML = "";
    const tap = mkEl("button", "avatarBtn");
    tap.type = "button";
    tap.setAttribute("aria-label", "Change photo");
    tap.appendChild(avatarEl("lg", photo, nameIn.value.trim()));
    tap.appendChild(mkEl("span", "avatarEdit", "Edit"));
    tap.onclick = choose;
    holder.appendChild(tap);
    const change = mkEl("button", "secondary profPhotoBtn", photo ? "Change photo" : "Add photo");
    change.type = "button";
    change.onclick = choose;
    holder.appendChild(change);
  }

  function choose() {
    const items = [
      { label: photo ? "Choose a new photo" : "Choose from gallery", hint: "Pick a picture from your phone", onSelect: () => { fileIn.removeAttribute("capture"); fileIn.click(); } },
      { label: "Take a photo", hint: "Use the camera", onSelect: () => { fileIn.setAttribute("capture", "user"); fileIn.click(); } }
    ];
    if (photo) items.push({ label: "Remove photo", danger: true, onSelect: () => { photo = ""; paint(); } });
    showActionMenu({ title: "Profile photo", items: items });
  }

  fileIn.addEventListener("change", () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = "";
    if (!f) return;
    resizePhoto(f).then(url => { photo = url; paint(); })
      .catch(err => showToast(err.message || "Could not use that photo", { type: "error" }));
  });
  nameIn.addEventListener("input", () => {
    // the letter avatar follows the name while there is no photo
    if (!photo) paint();
  });

  const save = mkEl("button", "primary", "Save profile");
  save.type = "button";
  save.style.width = "100%";
  save.style.marginTop = "16px";
  save.onclick = () => {
    const okName = profileSet("sp_name", nameIn.value.trim().slice(0, 30));
    const okPhoto = profileSet("sp_avatar", photo);
    if (!okName || !okPhoto) { showToast("Could not save. Phone storage may be full.", { type: "error" }); return; }
    if (typeof applyName === "function") applyName();
    showToast("Profile saved");
    openPage("Profile", profilePage);
  };

  paint();
  const label = mkEl("label", "profLabel", "Name");
  body.append(holder, fileIn, label, nameIn, save);
}
