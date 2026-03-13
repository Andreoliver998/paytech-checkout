const axios = require("axios");
const { v4: uuid } = require("uuid");

const MP_API = "https://api.mercadopago.com/v1/payments";
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.warn("MERCADOPAGO_ACCESS_TOKEN not set. Mercado Pago requests will fail.");
}

function assertAccessToken() {
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
  }
}

async function createPixPayment({ amount, email, external_reference }) {
  assertAccessToken();
  const body = {
    transaction_amount: Number(amount),
    description: "PayTech Checkout Payment",
    payment_method_id: "pix",
    payer: { email },
  };
  if (external_reference) body.external_reference = String(external_reference);

  const response = await axios.post(
    MP_API,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": uuid(),
      },
    }
  );

  const data = response.data || {};
  const tx = data.point_of_interaction?.transaction_data || {};

  return {
    payment_id: data.id,
    status: data.status,
    qr_code: tx.qr_code,
    qr_code_base64: tx.qr_code_base64,
    raw: data,
  };
}

async function createCardPayment({
  token,
  amount,
  email,
  payment_method_id,
  issuer_id,
  installments,
  external_reference,
}) {
  assertAccessToken();
  const body = {
    transaction_amount: Number(amount),
    token,
    description: "PayTech Checkout Payment",
    installments: installments || 1,
    payment_method_id,
    payer: { email },
  };
  if (issuer_id) {
    body.issuer_id = Number(issuer_id);
  }
  if (external_reference) {
    body.external_reference = String(external_reference);
  }

  const response = await axios.post(
    MP_API,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": uuid(),
      },
    }
  );

  return response.data;
}

async function fetchPaymentStatus(id) {
  assertAccessToken();
  const response = await axios.get(`${MP_API}/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = response.data || {};
  return {
    status: data.status,
    payment_id: data.id,
  };
}

module.exports = { createPixPayment, createCardPayment, fetchPaymentStatus };
