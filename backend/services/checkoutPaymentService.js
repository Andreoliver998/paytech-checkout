const prisma = require("../models/prisma");
const { getActiveLink } = require("./paymentLinkService");
const { createPixPayment, createCardPayment, fetchPaymentStatus } = require("./mercadoPagoService");

function mapMpStatus(rawStatus) {
  const normalized = String(rawStatus || "").toUpperCase();
  if (["APPROVED", "PAID", "SUCCEEDED"].includes(normalized)) return "PAID";
  if (["REJECTED", "FAILED", "DECLINED"].includes(normalized)) return "FAILED";
  if (["CANCELLED", "CANCELED"].includes(normalized)) return "CANCELED";
  if (["IN_PROCESS", "PROCESSING"].includes(normalized)) return "PROCESSING";
  return "PENDING";
}

async function createBasePayment({ link, customerName, customerEmail, paymentMethod }) {
  return prisma.payment.create({
    data: {
      product_id: link.product.id,
      client_id: link.product.client.id,
      customer_name: customerName,
      customer_email: customerEmail,
      amount: Number(link.product.price),
      payment_method: paymentMethod,
      status: "PENDING",
    },
  });
}

async function createCheckoutPixPayment({ paymentLinkSlug, customerName, customerEmail, amount }) {
  const link = await getActiveLink(paymentLinkSlug);
  if (!link || !link.active) {
    throw new Error("Payment link not found");
  }

  const expectedAmount = Number(link.product.price);
  if (Number(amount) !== expectedAmount) {
    throw new Error("Invalid amount for checkout link");
  }

  const localPayment = await createBasePayment({
    link,
    customerName,
    customerEmail,
    paymentMethod: "PIX",
  });

  const mpPayment = await createPixPayment({
    amount: expectedAmount,
    email: customerEmail,
    external_reference: localPayment.id,
  });

  await prisma.payment.update({
    where: { id: localPayment.id },
    data: {
      status: mapMpStatus(mpPayment.status),
      gateway_reference: String(mpPayment.payment_id),
      pix_qr_code: mpPayment.qr_code_base64 ? `data:image/png;base64,${mpPayment.qr_code_base64}` : null,
      pix_copy_paste: mpPayment.qr_code || null,
    },
  });

  return {
    local_payment_id: localPayment.id,
    payment_id: mpPayment.payment_id,
    status: mpPayment.status,
    pix_qr_code: mpPayment.qr_code_base64 ? `data:image/png;base64,${mpPayment.qr_code_base64}` : null,
    pix_copy_paste: mpPayment.qr_code || null,
    qr_code_base64: mpPayment.qr_code_base64 || null,
    qr_code: mpPayment.qr_code || null,
    redirect_url: link.product.redirect_url || null,
    mp_response: mpPayment.raw || null,
  };
}

async function createCheckoutCardPayment({
  paymentLinkSlug,
  customerName,
  customerEmail,
  amount,
  token,
  paymentMethodId,
  issuerId,
  installments,
}) {
  const link = await getActiveLink(paymentLinkSlug);
  if (!link || !link.active) {
    throw new Error("Payment link not found");
  }

  const expectedAmount = Number(link.product.price);
  if (Number(amount) !== expectedAmount) {
    throw new Error("Invalid amount for checkout link");
  }

  const localPayment = await createBasePayment({
    link,
    customerName,
    customerEmail,
    paymentMethod: "CARD",
  });

  const mpPayment = await createCardPayment({
    token,
    amount: expectedAmount,
    email: customerEmail,
    payment_method_id: paymentMethodId,
    issuer_id: issuerId,
    installments,
    external_reference: localPayment.id,
  });

  await prisma.payment.update({
    where: { id: localPayment.id },
    data: {
      status: mapMpStatus(mpPayment.status),
      gateway_reference: String(mpPayment.id),
    },
  });

  return {
    local_payment_id: localPayment.id,
    payment_id: mpPayment.id,
    status: mpPayment.status,
    status_detail: mpPayment.status_detail || null,
    redirect_url: link.product.redirect_url || null,
    mp_response: mpPayment,
  };
}

async function syncPaymentStatusByGatewayId(gatewayPaymentId) {
  const mpStatus = await fetchPaymentStatus(gatewayPaymentId);
  const local = await prisma.payment.findFirst({
    where: { gateway_reference: String(mpStatus.payment_id) },
  });
  if (local) {
    await prisma.payment.update({
      where: { id: local.id },
      data: { status: mapMpStatus(mpStatus.status) },
    });
  }
  return { payment_id: mpStatus.payment_id, status: mpStatus.status };
}

module.exports = {
  createCheckoutPixPayment,
  createCheckoutCardPayment,
  syncPaymentStatusByGatewayId,
};
