const { z } = require("zod");
const { createPayment, getPaymentStatus } = require("../services/paymentService");
const { getActiveLink } = require("../services/paymentLinkService");

const createPaymentSchema = z.object({
  body: z.object({
    payment_link_slug: z.string(),
    customer_name: z.string().min(2),
    customer_email: z.string().email(),
    payment_method: z.enum(["CARD", "PIX"]),
  }),
});

const paymentStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

async function createPaymentHandler(req, res, next) {
  try {
    const { payment_link_slug, customer_name, customer_email, payment_method } = req.validated.body;
    const link = await getActiveLink(payment_link_slug);
    if (!link || !link.active) {
      return res.status(404).json({ message: "Payment link not found" });
    }

    const payment = await createPayment({
      product: link.product,
      client: link.product.client,
      customer: { name: customer_name, email: customer_email },
      amount: Number(link.product.price),
      payment_method,
    });

    res.status(201).json({
      id: payment.id,
      status: payment.status,
      payment_method: payment.payment_method,
      redirect_url: link.product.redirect_url,
      pix_qr_code: payment.pix_qr_code,
      pix_copy_paste: payment.pix_copy_paste,
    });
  } catch (err) {
    console.error("createPayment error", err.response?.data || err.message || err);
    res.status(500).json({ message: "Internal server error", detail: err.response?.data || err.message });
  }
}

async function paymentStatusHandler(req, res, next) {
  try {
    const payment = await getPaymentStatus(req.validated.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPaymentHandler,
  createPaymentSchema,
  paymentStatusHandler,
  paymentStatusSchema,
};
