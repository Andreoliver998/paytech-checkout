const { syncPaymentStatusByGatewayId } = require("../services/checkoutPaymentService");
const logger = require("../utils/logger");

function extractPaymentId(req) {
  return (
    req.query?.["data.id"]
    || req.body?.data?.id
    || req.body?.id
    || null
  );
}

function isPaymentEvent(req) {
  const type = String(req.body?.type || "").toLowerCase();
  const action = String(req.body?.action || "").toLowerCase();
  return type === "payment" || action.startsWith("payment.");
}

function validateWebhookSecret(req) {
  const expected = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "").trim();
  if (!expected) return true;

  const provided = String(
    req.query?.secret
      || req.headers["x-webhook-secret"]
      || req.headers["x-paytech-webhook-secret"]
      || ""
  ).trim();

  return Boolean(provided) && provided === expected;
}

async function mercadoPagoWebhook(req, res) {
  try {
    if (!validateWebhookSecret(req)) {
      logger.warn("Mercado Pago webhook unauthorized", { ip: req.ip });
      return res.sendStatus(401);
    }

    if (!isPaymentEvent(req)) {
      return res.sendStatus(200);
    }

    const paymentId = extractPaymentId(req);
    if (!paymentId) {
      logger.warn("Mercado Pago webhook payment id missing");
      return res.sendStatus(200);
    }

    const status = await syncPaymentStatusByGatewayId(paymentId);
    logger.logWebhook("mercadopago.payment", 200, {
      payment_id: paymentId,
      status: status?.status || null,
      status_detail: status?.status_detail || null,
    });

    return res.sendStatus(200);
  } catch (error) {
    logger.error("Mercado Pago webhook error", {
      message: error.message,
      details: error.response?.data || null,
    });
    return res.sendStatus(500);
  }
}

module.exports = {
  mercadoPagoWebhook,
};
