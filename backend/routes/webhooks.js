const express = require("express");
const webhookController = require("../controllers/webhookController");

// Keep legacy webhook behavior intact.
const paymentWebhook = require("../webhooks/paymentWebhook");
const webhookAuth = require("../middlewares/webhookAuth");

const router = express.Router();

router.post("/mercadopago", webhookController.mercadoPagoWebhook);
router.use("/payment", webhookAuth, paymentWebhook);

module.exports = router;
