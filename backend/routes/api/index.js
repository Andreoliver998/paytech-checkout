const express = require("express");
const validate = require("../../middlewares/validate");
const {
  createClientHandler,
  createClientSchema,
} = require("../../controllers/clientsController");
const {
  createProductHandler,
  createProductSchema,
} = require("../../controllers/productsController");
const {
  createPaymentLinkHandler,
  createPaymentLinkSchema,
  getCheckoutInfoHandler,
} = require("../../controllers/paymentLinksController");
const {
  createPaymentHandler,
  createPaymentSchema,
  paymentStatusHandler,
  paymentStatusSchema,
} = require("../../controllers/paymentsController");

const router = express.Router();

router.get("/config/public-keys", (req, res) => {
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || process.env.MP_PUBLIC_KEY;
  const baseUrl = process.env.BASE_URL || null;
  if (!publicKey) {
    return res.status(500).json({ message: "MERCADOPAGO_PUBLIC_KEY not configured" });
  }
  res.json({ mp_public_key: publicKey, base_url: baseUrl });
});

router.post("/clients", validate(createClientSchema), createClientHandler);
router.post("/products", validate(createProductSchema), createProductHandler);
router.post("/payment-links", validate(createPaymentLinkSchema), createPaymentLinkHandler);
router.get("/payment-links/:slug", getCheckoutInfoHandler);
router.get("/checkout/:slug", getCheckoutInfoHandler);

router.post("/payments", validate(createPaymentSchema), createPaymentHandler);
router.get("/payments/:id", validate(paymentStatusSchema), paymentStatusHandler);

module.exports = router;
