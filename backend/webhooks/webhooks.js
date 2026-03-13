
const express = require("express");
const router = express.Router();
const paymentWebhook = require("./paymentWebhook");
const webhookAuth = require("../middlewares/webhookAuth");

router.use("/payment", webhookAuth, paymentWebhook);

module.exports = router;
