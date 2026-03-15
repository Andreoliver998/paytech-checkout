const express = require("express");
const { z } = require("zod");
const path = require("path");
const validate = require("../middlewares/validate");
const logger = require("../utils/logger");
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
      logger.logPayment(payment.local_payment_id, "created", { method: "CARD" });
      return res.status(201).json(payment);
    }

    const payment = await createCheckoutPixPayment({
      paymentLinkSlug: body.payment_link_slug,
      customerName: body.customer_name,
      customerEmail: body.email,
      amount: body.amount,
    });
    logger.logPayment(payment.local_payment_id, "created", { method: "PIX" });
    res.status(201).json(payment);
  } catch (err) {
    logger.error("Mercado Pago create error", {
      message: err.message,
      details: err.response?.data,
    });
    res.status(500).json({ 
      message: "Internal server error", 
      detail: err.response?.data || err.message 
    });
  }
});

router.get("/status/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = await syncPaymentStatusByGatewayId(id);
    logger.logPayment(id, "status_checked", { status: status.status });
    res.json(status);
  } catch (err) {
    logger.error("Mercado Pago status error", {
      payment_id: req.params.id,
      message: err.message,
      details: err.response?.data,
    });
    next(err);
  }
});

module.exports = router;
