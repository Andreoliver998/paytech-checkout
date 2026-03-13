const prisma = require("../models/prisma");
const { createGatewayPayment, fetchGatewayStatus } = require("./gatewayService");
const { generatePixPayment } = require("./pixService");
const { createPixPayment } = require("./mercadoPagoService");

async function createPayment({ product, client, customer, amount, payment_method }) {
  const payment = await prisma.payment.create({
    data: {
      product_id: product.id,
      client_id: client.id,
      customer_name: customer.name,
      customer_email: customer.email,
      amount,
      payment_method,
      status: "PENDING",
    },
  });

  let updateData = {};

  if (payment_method === "PIX") {
    let pix;
    if ((client.gateway_provider || "").toLowerCase() === "mercadopago") {
      // Use Mercado Pago PIX to get EMV+QR válido
      pix = await createPixPayment({ amount: Number(amount), email: customer.email });
    } else {
      pix = await generatePixPayment({ amount: Number(amount), description: product.name });
    }
    updateData = {
      status: "PENDING",
      pix_qr_code: pix.qr_code_base64 ? `data:image/png;base64,${pix.qr_code_base64}` : pix.qr_code,
      pix_copy_paste: pix.copy_paste_code || pix.qr_code,
    };
  } else {
    try {
      const gatewayResp = await createGatewayPayment({
        provider: client.gateway_provider,
        amount: Number(amount),
        currency: product.currency,
        metadata: { paymentId: payment.id, clientId: client.id },
      });
      updateData = {
        status: mapStatus(gatewayResp.status),
        gateway_reference: gatewayResp.gatewayId || null,
      };
    } catch (err) {
      // Em modo demo, não falhe: marque como PROCESSING e siga para o redirect
      console.error("Gateway card error, falling back to PROCESSING:", err.message);
      updateData = {
        status: "PROCESSING",
        gateway_reference: null,
      };
    }
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: updateData,
  });

  return updated;
}

async function getPaymentStatus(id, client) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return null;

  if (!isFinalStatus(payment.status) && payment.gateway_reference) {
    try {
      const gatewayStatus = await fetchGatewayStatus({
        provider: client?.gateway_provider || "stripe",
        gatewayId: payment.gateway_reference,
      });
      if (gatewayStatus?.status && payment.status !== mapStatus(gatewayStatus.status)) {
        return prisma.payment.update({
          where: { id },
          data: { status: mapStatus(gatewayStatus.status) },
        });
      }
    } catch (err) {
      // keep current status on failure
      console.error("Gateway status fetch failed", err.message);
    }
  }
  return payment;
}

async function updatePaymentStatus(id, status) {
  return prisma.payment.update({
    where: { id },
    data: { status: mapStatus(status) },
  });
}

function mapStatus(rawStatus) {
  const normalized = (rawStatus || "").toUpperCase();
  if (["PAID", "APPROVED", "SUCCEEDED"].includes(normalized)) return "PAID";
  if (["FAILED", "DECLINED"].includes(normalized)) return "FAILED";
  if (["CANCELED", "CANCELLED"].includes(normalized)) return "CANCELED";
  if (["PROCESSING", "IN_PROCESS"].includes(normalized)) return "PROCESSING";
  return "PENDING";
}

function isFinalStatus(status) {
  return ["PAID", "FAILED", "CANCELED"].includes(status);
}

module.exports = { createPayment, getPaymentStatus, updatePaymentStatus };
