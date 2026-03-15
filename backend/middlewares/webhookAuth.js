const crypto = require("crypto");
const logger = require("../utils/logger");

function webhookAuth(req, res, next) {
  const signature = req.headers["x-mercadopago-signature"] || req.headers["x-webhook-signature"];
  const secret = process.env.WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("Webhook secret not configured");
    return res.status(500).json({ message: "Webhook secret not configured" });
  }

  if (!signature) {
    logger.warn("Webhook received without signature", { ip: req.ip });
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  // Validate HMAC-SHA256 signature
  try {
    const body = JSON.stringify(req.body);
    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
      logger.warn("Webhook signature validation failed", { ip: req.ip });
      return res.status(401).json({ message: "Invalid webhook signature" });
    }
  } catch (err) {
    logger.error("Webhook signature validation error", { error: err.message, ip: req.ip });
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  next();
}

module.exports = webhookAuth;
