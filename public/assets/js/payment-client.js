import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  buildLoginUrl,
  clearPendingPayment,
  getPendingPayment,
  setPendingPayment,
  updatePendingPayment,
} from "./auth-redirect.js";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const API_BASE = window.PAYMENT_API_BASE || "";

export async function startCheckout({ productId, returnPath = window.location.href, button } = {}) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const user = await waitForAuthUser();

  if (!user) {
    setPendingPayment({ productId, returnPath });
    window.location.href = buildLoginUrl(returnPath);
    return;
  }

  const pendingPayment = getPendingPayment();
  const clientRequestId =
    pendingPayment?.productId === productId ? pendingPayment.clientRequestId : crypto.randomUUID();

  setButtonLoading(button, true);

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}/api/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, clientRequestId }),
    });
    const data = await parseJsonResponse(response);

    updatePendingPayment({
      productId,
      returnPath,
      paymentId: data.paymentId,
      paypalOrderId: data.paypalOrderId,
      approveUrl: data.approveUrl,
      clientRequestId,
    }) || setPendingPayment({
      productId,
      returnPath,
      paymentId: data.paymentId,
      paypalOrderId: data.paypalOrderId,
      approveUrl: data.approveUrl,
    });

    window.location.href = data.approveUrl;
  } finally {
    setButtonLoading(button, false);
  }
}

export async function resumePendingPaymentIfAny({ productId, button } = {}) {
  const pendingPayment = getPendingPayment();

  if (!pendingPayment) {
    return false;
  }

  if (productId && pendingPayment.productId !== productId) {
    return false;
  }

  const user = await waitForAuthUser();

  if (!user) {
    return false;
  }

  if (pendingPayment.paymentId) {
    const synced = await syncPayment(pendingPayment.paymentId, user);

    if (synced.status === "COMPLETED") {
      clearPendingPayment();
      window.location.href = synced.returnPath || pendingPayment.returnPath;
      return true;
    }

    if (synced.approveUrl) {
      window.location.href = synced.approveUrl;
      return true;
    }
  }

  await startCheckout({
    productId: pendingPayment.productId,
    returnPath: pendingPayment.returnPath,
    button,
  });

  return true;
}

export async function capturePaymentFromReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentId = urlParams.get("paymentId");
  const paypalOrderId = urlParams.get("token");

  if (!paymentId) {
    throw new Error("paymentId is missing from PayPal return URL");
  }

  const user = await waitForAuthUser();

  if (!user) {
    const pendingPayment = getPendingPayment();
    setPendingPayment({
      productId: pendingPayment?.productId || "unknown",
      returnPath: window.location.href,
      paymentId,
      paypalOrderId,
    });
    window.location.href = buildLoginUrl(window.location.href);
    return null;
  }

  const token = await user.getIdToken(true);
  const response = await fetch(`${API_BASE}/api/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paypalOrderId }),
  });
  const data = await parseJsonResponse(response);

  clearPendingPayment();
  return data;
}

async function syncPayment(paymentId, user) {
  const token = await user.getIdToken(true);
  const response = await fetch(`${API_BASE}/api/payments/${encodeURIComponent(paymentId)}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  return parseJsonResponse(response);
}

export function waitForAuthUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user || null);
    });
  });
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.dataset.originalText ||= button.textContent;
  button.textContent = isLoading ? "Weiterleitung..." : button.dataset.originalText;
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "request_failed");
  }

  return data;
}
