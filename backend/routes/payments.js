const express = require("express");
const { z } = require("zod");
const fs = require("fs");
const path = require("path");
const validate = require("../middlewares/validate");
const {
  createCheckoutPixPayment,
  createCheckoutCardPayment,
  syncPaymentStatusByGatewayId,
} = require("../services/checkoutPaymentService");

const router = express.Router();

const pixSchema = z.object({
  payment_link_slug: z.string().min(1),
  customer_name: z.string().min(2),
  amount: z.coerce.number().positive(),
  email: z.string().email(),
});

const cardSchema = z.object({
  payment_link_slug: z.string().min(1),
  customer_name: z.string().min(2),
  token: z.string().min(5),
  amount: z.coerce.number().positive(),
  email: z.string().email(),
  payment_method_id: z.string().min(2),
  issuer_id: z.union([z.string(), z.number()]).optional().nullable(),
  installments: z.coerce.number().int().positive(),
});

const createPaymentSchema = z.object({
  body: z.union([pixSchema, cardSchema]),
});

router.post("/create", validate(createPaymentSchema), async (req, res, next) => {
  try {
    const body = req.validated.body;

    if (body.token) {
      const payment = await createCheckoutCardPayment({
        paymentLinkSlug: body.payment_link_slug,
        customerName: body.customer_name,
        customerEmail: body.email,
        amount: body.amount,
        token: body.token,
        paymentMethodId: body.payment_method_id,
        issuerId: body.issuer_id,
        installments: body.installments,
      });
      return res.status(201).json(payment);
    }

    const payment = await createCheckoutPixPayment({
      paymentLinkSlug: body.payment_link_slug,
      customerName: body.customer_name,
      customerEmail: body.email,
      amount: body.amount,
    });
    res.status(201).json(payment);
  } catch (err) {
    console.error("Mercado Pago create error", err.response?.data || err.message || err);
    try {
      fs.appendFileSync(path.join(__dirname, "..", "..", "mp-error.log"), JSON.stringify(err.response?.data || err.message || err) + "\n");
    } catch (_) {}
    res.status(500).json({ message: "Internal server error", detail: err.response?.data || err.message });
  }
});

router.get("/status/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = await syncPaymentStatusByGatewayId(id);
    res.json(status);
  } catch (err) {
    console.error("Mercado Pago status error", err.response?.data || err.message);
    next(err);
  }
});

module.exports = router;
