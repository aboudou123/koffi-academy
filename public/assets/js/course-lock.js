/**
 * course-lock.js
 * Usage: <script src="/assets/js/course-lock.js" data-course="vault-security" data-price="79" data-currency="EUR" data-title="HashiCorp Vault 101"></script>
 */
(function () {
  const script = document.currentScript;
  const COURSE_ID = script?.dataset?.course || "";
  const PRICE = script?.dataset?.price || "?";
  const CURRENCY = script?.dataset?.currency || "EUR";
  const TITLE = script?.dataset?.title || document.title;
  const GRANT_KEY = `lingenieur_grant_${COURSE_ID}`;
  const FIREBASE_VER = "10.8.0";
  const checkoutParams = new URLSearchParams({
    course: COURSE_ID,
    title: TITLE,
    currency: CURRENCY,
  });
  if (PRICE && PRICE !== "?") checkoutParams.set("price", PRICE);
  const CHECKOUT_QUERY = checkoutParams.toString();

  if (!COURSE_ID) return;

  // Immediately blur content while we check
  document.documentElement.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.id = "course-gate";
  overlay.innerHTML = `
    <div class="cg-backdrop"></div>
    <div class="cg-modal">
      <div class="cg-logo">Koffi <span>Academy</span></div>
      <div class="cg-icon"><i class="fas fa-lock"></i></div>
      <h2 class="cg-title">${escHtml(TITLE)}</h2>
      <p class="cg-desc">Ce cours est réservé aux membres ayant effectué un achat.</p>
      <div class="cg-price">${PRICE} ${CURRENCY}</div>

      <div id="cg-main">
        <a href="/payment/checkout.html?${CHECKOUT_QUERY}" class="cg-btn cg-btn-paypal">
          <i class="fab fa-paypal"></i> Acheter avec PayPal
        </a>
        <a href="/payment/bank-transfer-request.html?${CHECKOUT_QUERY}" class="cg-btn cg-btn-bank">
          <i class="fas fa-university"></i> Demande par virement
        </a>
        <button class="cg-btn cg-btn-key" onclick="document.getElementById('cg-key-panel').style.display='block';this.style.display='none'">
          <i class="fas fa-key"></i> J'ai une clé d'accès
        </button>
      </div>

      <div id="cg-key-panel" style="display:none;margin-top:16px">
        <input id="cg-key-input" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off"
               style="width:100%;padding:12px;font-size:15px;border:1px solid #ccc;border-radius:8px;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">
        <button class="cg-btn cg-btn-verify" onclick="verifyKey()">
          <i class="fas fa-check"></i> Vérifier la clé
        </button>
        <div id="cg-key-msg" style="margin-top:8px;font-size:13px;color:#c00"></div>
      </div>

      <div id="cg-checking" style="display:none;text-align:center;padding:16px 0">
        <i class="fas fa-spinner fa-spin" style="font-size:24px;color:#07294d"></i>
        <p style="margin:8px 0 0;color:#666">Vérification en cours…</p>
      </div>
    </div>
  `;

  document.body.insertBefore(overlay, document.body.firstChild);

  const style = document.createElement("style");
  style.textContent = `
    #course-gate { position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px }
    #course-gate .cg-backdrop { position:absolute;inset:0;background:rgba(7,41,77,.72);backdrop-filter:blur(6px) }
    #course-gate .cg-modal { position:relative;background:#fff;border-radius:20px;padding:36px 32px;max-width:440px;width:100%;text-align:center;box-shadow:0 30px 80px rgba(7,41,77,.25) }
    #course-gate .cg-logo { font-size:22px;font-weight:900;color:#07294d;margin-bottom:16px }
    #course-gate .cg-logo span { color:#ffc600 }
    #course-gate .cg-icon { width:64px;height:64px;background:#f0f4f8;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;color:#07294d }
    #course-gate .cg-title { font-size:20px;font-weight:800;color:#07294d;margin:0 0 8px }
    #course-gate .cg-desc { color:#6b7280;font-size:14px;margin:0 0 12px }
    #course-gate .cg-price { font-size:28px;font-weight:900;color:#07294d;margin-bottom:24px }
    #course-gate .cg-btn { display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:10px;cursor:pointer;text-decoration:none;border:none;transition:.18s }
    #course-gate .cg-btn:hover { transform:translateY(-2px) }
    #course-gate .cg-btn-paypal { background:#003087;color:#fff }
    #course-gate .cg-btn-bank { background:#f0f4f8;color:#07294d;border:1px solid #d1d5db }
    #course-gate .cg-btn-key { background:transparent;color:#07294d;border:1px dashed #d1d5db }
    #course-gate .cg-btn-verify { background:#07294d;color:#fff;padding:11px;border-radius:8px;width:100%;font-size:14px;font-weight:700;border:none;cursor:pointer }
    @media(max-width:480px){ #course-gate .cg-modal{padding:24px 18px} }
  `;
  document.head.appendChild(style);

  // Expose verifyKey globally for onclick
  window.verifyKey = async function () {
    const key = document.getElementById("cg-key-input").value.trim();
    const msg = document.getElementById("cg-key-msg");
    if (!key) { msg.textContent = "Veuillez saisir une clé."; return; }

    msg.textContent = "";
    setChecking(true);

    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.toUpperCase(), courseId: COURSE_ID }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(GRANT_KEY, data.grantId);
        unlock();
      } else {
        msg.textContent = "Clé invalide ou déjà utilisée.";
        setChecking(false);
      }
    } catch {
      msg.textContent = "Erreur réseau. Réessayez.";
      setChecking(false);
    }
  };

  function setChecking(active) {
    document.getElementById("cg-main").style.display = active ? "none" : "block";
    document.getElementById("cg-key-panel").style.display = active ? "none" : "";
    document.getElementById("cg-checking").style.display = active ? "block" : "none";
  }

  function unlock() {
    document.getElementById("course-gate")?.remove();
    document.documentElement.style.overflow = "";
  }

  async function checkAccess() {
    // 1. Check stored grant (bank transfer)
    const grantId = localStorage.getItem(GRANT_KEY);
    if (grantId) {
      try {
        const res = await fetch(`/api/check-unlock?course=${COURSE_ID}&grantId=${grantId}`);
        const data = await res.json();
        if (data.unlocked) return true;
        // Grant revoked – remove
        localStorage.removeItem(GRANT_KEY);
      } catch { /* network error */ }
    }

    // 2. Check Firebase Auth (PayPal users)
    try {
      const [{ initializeApp, getApp, getApps }, { getAuth, onAuthStateChanged }] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-auth.js`),
      ]);
      const { firebaseConfig } = await import("/assets/js/firebase-config.js");
      const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(fbApp);

      const user = await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
      });

      if (!user) return false;

      const token = await user.getIdToken();
      const res = await fetch(`/api/check-unlock?course=${COURSE_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.unlocked === true;
    } catch {
      return false;
    }
  }

  // Run check
  checkAccess().then((unlocked) => {
    if (unlocked) unlock();
    // else: overlay stays visible
  });

  function escHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
