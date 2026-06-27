/* ───────────────────────────────────────────────────────────────────────────
   Koffi IDP — Cloud store sync (Firestore)
   Mirrors the local `koffi-idp-store` (localStorage) to a per-user Firestore
   document `idpStores/{uid}` so the IDP backend (services, workflow runs, audit,
   automations) becomes a REAL cloud backend: persistent, shared across devices,
   tied to the signed-in account.

   Offline-first & non-invasive:
   - All existing code keeps reading/writing localStorage synchronously.
   - This module mirrors those writes to Firestore (debounced) and pulls the
     cloud copy on sign-in.
   - If Firestore is unavailable, or the user is signed out, it silently stays
     in localStorage-only mode (no regression).

   Requires (one-time, in the Firebase console):
   1. Enable Firestore (Native mode).
   2. Security rules:
        match /idpStores/{uid} {
          allow read, write: if request.auth != null && request.auth.uid == uid;
        }
─────────────────────────────────────────────────────────────────────────────*/
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "/assets/js/firebase-config.js";

const LS_KEY = "koffi-idp-store";
let db = null, docRef = null, unsub = null, pushTimer = null, applying = false, lastSync = null;

function lsGetRaw(){ try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } }
function lsSetRaw(v){ try { applying = true; localStorage.setItem(LS_KEY, v); } finally { applying = false; } }
function notify(){ try { window.dispatchEvent(new CustomEvent("koffi-store-synced")); } catch (e) {} }
function status(s){ try { window.KOFFI_STORE_STATUS = s; window.dispatchEvent(new CustomEvent("koffi-store-status", { detail:s })); } catch (e) {} }

/* Bullet-proof monkey-patch: original setItem always runs; sync logic can never
   break a write. Detects writes to the IDP store and pushes them to Firestore. */
try {
  const origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    origSet(k, v);
    try { if (k === LS_KEY && docRef && !applying) schedulePush(); } catch (e) {}
  };
} catch (e) { /* patching failed — sync-on-write disabled, no breakage */ }

function schedulePush(){ clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 800); }
async function pushNow(){
  if (!docRef) return;
  const raw = lsGetRaw(); if (!raw) return;
  if (raw === lastSync) return;                 // dedup: nothing actually changed → no loop
  let data; try { data = JSON.parse(raw); } catch (e) { return; }
  try { await setDoc(docRef, { store: data, updatedAt: Date.now() }); lastSync = raw; status("synced"); }
  catch (e) { console.warn("[idp-store] cloud push failed:", e && e.message); status("error"); }
}

try {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  db = getFirestore(app);
  status("local");

  onAuthStateChanged(auth, async (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) { docRef = null; status("local"); return; }     // signed out → localStorage only
    docRef = doc(db, "idpStores", user.uid);
    status("connecting");

    // Live cloud → local mirror (also covers first read after sign-in)
    unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d && d.store) { const j = JSON.stringify(d.store); lastSync = j; lsSetRaw(j); notify(); status("synced"); }
      } else {
        // No cloud doc yet → seed it from whatever is in localStorage now
        const raw = lsGetRaw();
        if (raw) { try { setDoc(docRef, { store: JSON.parse(raw), updatedAt: Date.now() }); status("synced"); } catch (e) {} }
        else status("synced");
      }
    }, (err) => { console.warn("[idp-store] snapshot error:", err && err.code); status("error"); });
  });
} catch (e) {
  console.warn("[idp-store] Firestore unavailable — localStorage only:", e && e.message);
  status("local");
}
