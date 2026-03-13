function webhookAuth(req, res, next) {
  const signature = req.headers["x-webhook-signature"];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    return res.status(500).json({ message: "Webhook secret not configured" });
  }

  if (!signature || signature !== secret) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  next();
}

module.exports = webhookAuth;
