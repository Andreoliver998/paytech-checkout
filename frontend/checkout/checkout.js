const state = {
  slug: null,
  product: null,
  client: null,
  cardBrand: "visa",
  detectedPaymentMethodId: null,
};

// API base resolution:
// Always use same-origin in production behind reverse proxy.
const API_BASE = window.location.origin;
const IS_LOCALHOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);

let mpPublicKey = window.MP_PUBLIC_KEY || null;
let mp = null;
let cardForm = null;
let lastInstallmentsBin = null;
let cardFormInitializing = false;
let cardFormRetryAttempted = false;

document.addEventListener("DOMContentLoaded", () => {
  if (!IS_LOCALHOST && window.location.protocol !== "https:") {
    showCheckoutError("Conexão insegura. Acesse o checkout via HTTPS.");
    return;
  }

  const slug = resolveSlug();
  state.slug = slug;
  if (!slug) {
    showCheckoutError("Link de checkout inválido. Abra /checkout/<slug>.");
    return;
  }
  // Keep URL clean to avoid stale query params from native form submits.
  if (window.location.search) {
    window.history.replaceState({}, "", `/checkout/${encodeURIComponent(slug)}`);
  }
  loadCheckout(slug);

  const form = document.getElementById("checkoutForm");
  form.addEventListener("submit", (event) => {
    // Never allow native form submit (which appends query params to URL).
    event.preventDefault();
    submitPayment();
  });

  const copyBtn = document.getElementById("copyBtn"); 
  copyBtn.addEventListener("click", () => {
    const copyInput = document.getElementById("pixCopy");
    copyInput.select();
    document.execCommand("copy");
    copyBtn.textContent = "Copiado!";
    setTimeout(() => (copyBtn.textContent = "Copiar"), 1500);
  });

  setupCardForm();
});

function resolveSlug() {
  const url = new URL(window.location.href);
  const fromQuery = (url.searchParams.get("slug") || "").trim();
  if (fromQuery) return fromQuery;

  const lastSegment = url.pathname.split("/").filter(Boolean).pop() || "";
  if (!lastSegment || ["checkout", "pay", "index.html"].includes(lastSegment)) {
    return null;
  }
  return decodeURIComponent(lastSegment);
}

async function loadCheckout(slug) {
  const encodedSlug = encodeURIComponent(slug);
  const urls = [
    `/api/checkout/${encodedSlug}`,
    `${API_BASE}/api/checkout/${encodedSlug}`,
  ];
  let lastError = "Erro ao carregar checkout";

  for (const url of urls) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Checkout load HTTP error:", { url, status: resp.status, body: text });
        lastError = `Falha ao carregar checkout (HTTP ${resp.status})`;
        continue;
      }
      const data = await resp.json();
      if (!data?.product || !data?.client) {
        console.error("Checkout payload inválido:", data);
        lastError = "Dados do checkout inválidos";
        continue;
      }
      state.product = data.product;
      state.client = data.client;
      try {
        renderCheckout(data);
      } catch (error) {
        // Product data already loaded; do not downgrade the checkout title if UI extras fail.
        console.error("Checkout render error:", error);
      }
      return;
    } catch (error) {
      console.error("Checkout load error:", { url, error });
      lastError = "Erro ao carregar checkout";
    }
  }
  showCheckoutError(lastError);
}

function showCheckoutError(message) {
  // If product data is already loaded, keep the resolved product name visible.
  if (state.product?.name) return;
  const productName = document.getElementById("productName");
  const productPrice = document.getElementById("productPrice");
  productName.textContent = message;
  productPrice.textContent = "";
}

function renderCheckout({ product, client }) {
  document.documentElement.style.setProperty("--brand", client.brand_color || "#1b65f1");
  document.getElementById("productName").textContent = product.name;
  document.getElementById("productPrice").textContent = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: product.currency || "BRL",
  }).format(product.price);

  document.getElementById("brandName").textContent = client.name;
  const logo = document.getElementById("brandLogo");
  if (client.logo_url) {
    logo.src = client.logo_url;
  } else {
    logo.style.display = "none";
  }

  try {
    maybeInitCardForm();
  } catch (error) {
    console.error("Card form init error:", error);
  }
}

function setupCardForm() {
  const cardSection = document.getElementById("card-section");
  const radioCard = document.getElementById("payCard");
  const radioPix = document.getElementById("payPix");

  setPaymentMethodUI(getSelectedPaymentMethod());

  radioCard.addEventListener("change", () => {
    setPaymentMethodUI("CARD");
  });
  radioPix.addEventListener("change", () => {
    setPaymentMethodUI("PIX");
  });

  ensureMercadoPagoSdk().then((ok) => {
    if (ok) {
      // If product data is already loaded, initialize card form now.
      maybeInitCardForm();
      return;
    }
    radioCard.checked = false;
    radioCard.disabled = true;
    radioPix.checked = true;
    cardSection.classList.add("hidden");
    alert("SDK do Mercado Pago não carregou. Pagamento por cartão indisponível.");
  });
}

function maybeInitCardForm() {
  if (!mp || !state.product || cardForm || cardFormInitializing) return;
  initCardForm();
}

function initCardForm() {
  if (!mp || cardForm || !state.product || cardFormInitializing) return;
  cardFormInitializing = true;

  const amount = Number(state.product.price || 0).toFixed(2);
  const amountInput = document.getElementById("transactionAmount");
  if (amountInput) amountInput.value = amount;
  resetInstallments("Selecione as parcelas");

  try {
    cardForm = mp.cardForm({
      amount,
      autoMount: true,
      form: {
        id: "checkoutForm",
        cardNumber: { id: "cardNumber" },
        expirationDate: { id: "expirationDate" },
        securityCode: { id: "securityCode" },
        cardholderName: { id: "cardholderName" },
        installments: { id: "installments" },
        cardholderEmail: { id: "customer_email" },
      },
      callbacks: {
        onSubmit: (event) => {
          // submit is handled by the form listener above
          event.preventDefault();
        },
        onError: (error) => {
          console.error("Mercado Pago card form error", error);
        },
      },
    });
    clearFeedback();
  } catch (error) {
    const message = String(error?.message || error || "");
    console.error("Falha ao inicializar cardForm:", error);
    cardForm = null;

    // Retry once after recreating DOM fields to clear stale SDK context bindings.
    if (!cardFormRetryAttempted) {
      cardFormRetryAttempted = true;
      rebuildCardFieldInputs();
      cardFormInitializing = false;
      initCardForm();
      return;
    }

    if (message.includes("Context 'expirationFields' already exists")) {
      console.warn("Mercado Pago context already exists; using fallback tokenization mode.");
    }
  } finally {
    cardFormInitializing = false;
  }

  attachBinListener(amount);
}

function attachBinListener(amount) {
  const cardNumberInput = document.getElementById("cardNumber");
  if (!cardNumberInput || cardNumberInput.dataset.binListenerAttached === "1") return;

  cardNumberInput.dataset.binListenerAttached = "1";
  cardNumberInput.addEventListener("input", () => {
    const cardNumber = String(cardNumberInput.value || "").replace(/\D/g, "");
    if (cardNumber.length < 6) {
      lastInstallmentsBin = null;
      resetInstallments("Selecione as parcelas");
      return;
    }
    const bin = cardNumber.substring(0, 6);
    if (bin === lastInstallmentsBin) return;
    lastInstallmentsBin = bin;
    loadInstallmentsByBin(bin, amount);
  });
}

function rebuildCardFieldInputs() {
  const ids = ["cardNumber", "expirationDate", "securityCode", "cardholderName"];
  ids.forEach((id) => {
    const oldEl = document.getElementById(id);
    if (!oldEl || !oldEl.parentNode) return;
    const newEl = oldEl.cloneNode(true);
    newEl.value = oldEl.value || "";
    newEl.removeAttribute("data-bin-listener-attached");
    oldEl.parentNode.replaceChild(newEl, oldEl);
  });
}

function resetInstallments(label) {
  const select = document.getElementById("installments");
  if (!select) return;
  select.disabled = false;
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  option.selected = true;
  option.disabled = true;
  select.appendChild(option);

  // Keep dropdown usable even before BIN detection.
  for (let i = 1; i <= 12; i += 1) {
    const installmentOption = document.createElement("option");
    installmentOption.value = String(i);
    installmentOption.textContent = `${i}x`;
    select.appendChild(installmentOption);
  }
}

async function loadInstallmentsByBin(bin, amount) {
  const select = document.getElementById("installments");
  if (!select) return;

  resetInstallments("Carregando parcelas...");

  try {
    const url = `https://api.mercadopago.com/v1/payment_methods/installments?bin=${encodeURIComponent(bin)}&amount=${encodeURIComponent(amount)}&public_key=${encodeURIComponent(mpPublicKey || "")}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Installments API HTTP ${resp.status}`);

    const data = await resp.json();
    const payerCostsRaw = Array.isArray(data) ? data?.[0]?.payer_costs || [] : data?.payer_costs || [];
    state.detectedPaymentMethodId = Array.isArray(data)
      ? data?.[0]?.payment_method_id || null
      : data?.payment_method_id || null;
    const payerCosts = payerCostsRaw.filter((cost) => Number(cost.installments) <= 12);

    if (!payerCosts.length) {
      resetInstallments("Selecione as parcelas");
      return;
    }

    select.disabled = false;
    select.innerHTML = "";
    payerCosts.forEach((cost) => {
      const option = document.createElement("option");
      option.value = String(cost.installments);
      option.textContent = cost.recommended_message || `${cost.installments}x`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar parcelas via API:", error);
    state.detectedPaymentMethodId = null;
    resetInstallments("Selecione as parcelas");
  }
}

async function resolvePaymentMethodIdByBin() {
  const cardNumber = String(document.getElementById("cardNumber")?.value || "").replace(/\D/g, "");
  const bin = cardNumber.substring(0, 6);
  if (bin.length < 6) return null;

  try {
    const url = `https://api.mercadopago.com/v1/payment_methods?bin=${encodeURIComponent(bin)}&public_key=${encodeURIComponent(mpPublicKey || "")}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const methods = Array.isArray(data) ? data : data?.results || [];
    return methods?.[0]?.id || null;
  } catch (error) {
    console.error("Falha ao resolver payment_method_id por BIN:", error);
    return null;
  }
}

function parseExpiry(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  const month = digits.slice(0, 2);
  const yearPart = digits.slice(2);
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart.slice(0, 4);
  return { month, year };
}

async function createCardTokenFallback() {
  const cardNumber = String(document.getElementById("cardNumber")?.value || "").replace(/\D/g, "");
  const securityCode = String(document.getElementById("securityCode")?.value || "").replace(/\D/g, "");
  const cardholderName = String(document.getElementById("cardholderName")?.value || "").trim();
  const expiryRaw = document.getElementById("expirationDate")?.value || "";
  const expiry = parseExpiry(expiryRaw);

  if (!expiry) {
    throw new Error("Validade do cartão inválida.");
  }

  const tokenResp = await mp.createCardToken({
    cardNumber,
    cardholderName,
    cardExpirationMonth: expiry.month,
    cardExpirationYear: expiry.year,
    securityCode,
  });

  const token = tokenResp?.id || tokenResp?.token || null;
  if (!token) {
    throw new Error("Não foi possível tokenizar o cartão.");
  }
  return token;
}

function buildApiErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  const detail = payload.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail?.message) return String(detail.message);
  if (Array.isArray(detail?.cause) && detail.cause.length) {
    const firstCause = detail.cause[0];
    if (firstCause?.description) return String(firstCause.description);
  }

  if (payload.message) return String(payload.message);
  return fallback;
}

function normalizeErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string" && err.trim()) return err;
  if (err.message && String(err.message).trim()) return String(err.message);
  if (err.error?.message) return String(err.error.message);
  return fallback;
}

function getSelectedPaymentMethod() {
  const form = document.getElementById("checkoutForm");
  return String(form?.payment_method?.value || "CARD").toUpperCase();
}

function setPaymentMethodUI(method) {
  const cardSection = document.getElementById("card-section");
  const pixContainer = document.getElementById("pixContainer");
  const cta = document.querySelector(".cta");

  if (method === "PIX") {
    cardSection.classList.add("hidden");
    pixContainer.classList.remove("hidden");
    if (cta) cta.textContent = "Gerar PIX";
    setFeedback("info", 'Selecione "Gerar PIX" para criar o QR Code.');
    return;
  }

  cardSection.classList.remove("hidden");
  pixContainer.classList.add("hidden");
  if (cta) cta.textContent = "Pagar agora";
  clearFeedback();
}

function setFeedback(type, message) {
  const box = document.getElementById("checkoutFeedback");
  if (!box) return;
  box.className = `feedback feedback--${type}`;
  box.textContent = message;
}

function clearFeedback() {
  const box = document.getElementById("checkoutFeedback");
  if (!box) return;
  box.className = "feedback hidden";
  box.textContent = "";
}

function setLoading(loading, method) {
  const cta = document.querySelector(".cta");
  if (!cta) return;
  cta.disabled = loading;

  if (!loading) {
    cta.textContent = method === "PIX" ? "Gerar PIX" : "Pagar agora";
    return;
  }

  cta.textContent = method === "PIX" ? "Gerando PIX..." : "Processando pagamento...";
}

function markInvalid(id, invalid) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("invalid", Boolean(invalid));
}

function validateCardInputs() {
  const cardNumber = document.getElementById("cardNumber")?.value || "";
  const expirationDate = document.getElementById("expirationDate")?.value || "";
  const securityCode = document.getElementById("securityCode")?.value || "";
  const cardholderName = document.getElementById("cardholderName")?.value?.trim() || "";
  const installments = document.getElementById("installments")?.value || "";

  const cardDigits = cardNumber.replace(/\D/g, "");
  const cvcDigits = securityCode.replace(/\D/g, "");
  const expiryDigits = expirationDate.replace(/\D/g, "");

  const cardInvalid = cardDigits.length < 13;
  const expiryInvalid = expiryDigits.length < 4;
  const cvcInvalid = cvcDigits.length < 3;
  const holderInvalid = cardholderName.length < 2;
  const installmentsInvalid = !installments;

  markInvalid("cardNumber", cardInvalid);
  markInvalid("expirationDate", expiryInvalid);
  markInvalid("securityCode", cvcInvalid);
  markInvalid("cardholderName", holderInvalid);
  markInvalid("installments", installmentsInvalid);

  if (cardInvalid || expiryInvalid || cvcInvalid || holderInvalid || installmentsInvalid) {
    setFeedback("error", "Preencha corretamente os dados do cartão e selecione as parcelas.");
    return false;
  }

  return true;
}

async function ensureMercadoPagoSdk() {
  if (mp) return true;
  if (typeof window.MercadoPago !== "function") return false;

  let key = mpPublicKey;
  if (!key) {
    try {
      const resp = await fetch("/api/config/public-keys", { cache: "no-store" });
      const data = await resp.json();
      key = data?.mp_public_key || null;
    } catch (error) {
      console.error("Falha ao carregar MP_PUBLIC_KEY:", error);
    }
  }
  if (!key) {
    console.error("MP_PUBLIC_KEY ausente.");
    return false;
  }

  mpPublicKey = key;
  mp = new window.MercadoPago(key);
  return true;
}

async function submitPayment() {
  const form = document.getElementById("checkoutForm");
  if (!state.product || !state.slug) {
    setFeedback("error", "Checkout ainda não carregou. Atualize a página.");
    return;
  }
  const paymentMethod = getSelectedPaymentMethod();
  const customerName = form.customer_name.value?.trim();
  const customerEmail = form.customer_email.value?.trim();

  try {
    clearFeedback();
    setLoading(true, paymentMethod);

    if (!customerName) throw new Error("Informe o nome completo");
    if (!customerEmail) throw new Error("Informe o email");

    if (paymentMethod === "PIX") {
      setFeedback("info", "Gerando cobrança PIX...");
      const pixPayload = {
        payment_link_slug: state.slug,
        customer_name: customerName,
        amount: Number(state.product.price),
        email: customerEmail,
        paymentMethod: "pix",
      };
      const pixResp = await fetch(`${API_BASE}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pixPayload),
      });
      const pixData = await pixResp.json();
      if (!pixResp.ok) {
        throw new Error(buildApiErrorMessage(pixData, "Erro ao processar PIX"));
      }

      showPix(pixData);
      setFeedback("info", "PIX gerado. Realize o pagamento para confirmar.");
      if (pixData.payment_id) {
        pollMercadoPagoStatus(pixData.payment_id, state.product.redirect_url);
      }
      return;
    }

    if (!validateCardInputs()) return;
    if (!mp) {
      const sdkReady = await ensureMercadoPagoSdk();
      if (!sdkReady) throw new Error("SDK de cartão indisponível no momento.");
    }

    let token = null;
    let paymentMethodId = state.detectedPaymentMethodId || null;
    let emailForPayload = customerEmail;

    if (cardForm) {
      const data = cardForm.getCardFormData();
      token = data?.token || null;
      paymentMethodId = data?.paymentMethodId || paymentMethodId;
      emailForPayload = data?.cardholderEmail || customerEmail;
    }

    if (!token) {
      token = await createCardTokenFallback();
    }

    const installments = Number(document.getElementById("installments")?.value || 0);
    if (!paymentMethodId) {
      paymentMethodId = await resolvePaymentMethodIdByBin();
    }
    if (!paymentMethodId) throw new Error("Não foi possível identificar a bandeira do cartão.");
    if (!installments) throw new Error("Selecione uma parcela válida.");

    const cardPayload = {
      payment_link_slug: state.slug,
      customer_name: customerName,
      token,
      payment_method_id: paymentMethodId,
      issuer_id: null,
      installments,
      amount: Number(state.product.price),
      email: emailForPayload,
      paymentMethod: "card",
    };

    const cardResp = await fetch(`${API_BASE}/api/payments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardPayload),
    });
    const cardData = await cardResp.json();
    if (!cardResp.ok) {
      throw new Error(buildApiErrorMessage(cardData, "Erro ao processar cartão"));
    }

    const successUrl = resolveSuccessRedirect(state.product.redirect_url);

    if (cardData.status === "approved") {
      setFeedback("info", "Pagamento aprovado. Redirecionando...");
      window.location.href = successUrl;
      return;
    }
    if (["pending", "in_process"].includes(cardData.status)) {
      setFeedback("info", "Pagamento pendente. Aguardando confirmação.");
      if (cardData.payment_id) {
        pollMercadoPagoStatus(cardData.payment_id, state.product.redirect_url);
      }
      return;
    }
    throw new Error(`Pagamento rejeitado: ${cardData.status_detail || cardData.status}`);
  } catch (err) {
    console.error("submitPayment error:", err);
    setFeedback("error", normalizeErrorMessage(err, "Falha ao processar pagamento"));
  } finally {
    setLoading(false, paymentMethod);
  }
}

function pollMercadoPagoStatus(id, redirect_url) {
  const successUrl = resolveSuccessRedirect(redirect_url);

  const interval = setInterval(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/payments/status/${id}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Erro ao obter status");

      if (data.status === "approved") {
        clearInterval(interval);
        setFeedback("info", "Pagamento confirmado. Redirecionando...");
        window.location.href = successUrl;
      }
      if (["rejected", "cancelled"].includes(data.status)) {
        clearInterval(interval);
        setFeedback("error", "Pagamento não aprovado.");
      }
    } catch (error) {
      clearInterval(interval);
      setFeedback("error", error.message);
    }
  }, 2000);
}

function resolveSuccessRedirect(redirectUrl) {
  const base = API_BASE || window.location.origin;
  const fallbackSuccess = base ? `${base}/success` : "/success";
  if (!redirectUrl) return fallbackSuccess;

  try {
    const target = new URL(redirectUrl, window.location.origin);
    const current = new URL(window.location.origin);

    // Security rule: never redirect payment success to a different domain.
    if (target.hostname !== current.hostname) {
      console.warn("Blocked cross-domain redirect_url, using fallback /success:", {
        redirectUrl,
      });
      return fallbackSuccess;
    }

    // Dev safety: if product points to old local frontend success, keep user on backend success route.
    if (
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
      target.port === "3002" &&
      target.pathname === "/success"
    ) {
      target.protocol = current.protocol;
      target.hostname = current.hostname;
      target.port = current.port;
      return target.toString();
    }

    return target.toString();
  } catch (error) {
    console.error("Invalid redirect_url, using fallback /success:", { redirectUrl, error });
    return fallbackSuccess;
  }
}

function showPix(paymentResponse) {
  const pixContainer = document.getElementById("pixContainer");
  const pixStatus = document.getElementById("pixStatus");
  pixContainer.classList.remove("hidden");
  const qrSrc =
    paymentResponse.pix_qr_code ||
    (paymentResponse.qr_code_base64
      ? `data:image/png;base64,${paymentResponse.qr_code_base64}`
      : null);
  if (qrSrc) document.getElementById("pixQr").src = qrSrc;
  document.getElementById("pixCopy").value =
    paymentResponse.pix_copy_paste || paymentResponse.qr_code || "";
  if (pixStatus) {
    pixStatus.textContent = "QR Code gerado. Aguardando confirmação do pagamento...";
  }
}
