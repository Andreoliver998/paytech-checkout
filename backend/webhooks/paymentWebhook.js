const express = require("express");
const { syncPaymentStatusByGatewayId } = require("../services/checkoutPaymentService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.id;
    if (!paymentId) {
      return res.status(400).json({ message: "payment id missing" });
    }

    const status = await syncPaymentStatusByGatewayId(paymentId);
    return res.status(200).json(status);
  } catch (err) {
    console.error("Webhook payment error", err.response?.data || err.message);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

module.exports = router;
