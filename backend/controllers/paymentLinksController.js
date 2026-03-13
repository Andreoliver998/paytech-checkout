const { z } = require("zod");
const { createPaymentLink, getActiveLink } = require("../services/paymentLinkService");
const { getProductWithClient } = require("../services/productService");

const createPaymentLinkSchema = z.object({
  body: z.object({
    product_id: z.string().cuid(),
    slug: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

async function createPaymentLinkHandler(req, res, next) {
  try {
    const { product_id, slug, active } = req.validated.body;
    const product = await getProductWithClient(product_id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const link = await createPaymentLink({
      product_id,
      name: product.name,
      slug,
      active,
    });
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
}

async function getCheckoutInfoHandler(req, res, next) {
  try {
    const { slug } = req.params;
    const link = await getActiveLink(slug);
    if (!link || !link.active) {
      return res.status(404).json({ message: "Payment link not found or inactive" });
    }

    res.json({
      slug: link.slug,
      product: {
        id: link.product.id,
        name: link.product.name,
        price: Number(link.product.price),
        currency: link.product.currency,
        redirect_url: link.product.redirect_url,
      },
      client: {
        id: link.product.client.id,
        name: link.product.client.name,
        brand_color: link.product.client.brand_color,
        logo_url: link.product.client.logo_url,
      },
    });
  } catch (err) {
    if (
      err?.name === "PrismaClientInitializationError" ||
      String(err?.message || "").includes("Authentication failed against database server")
    ) {
      return res.status(503).json({ message: "Database connection failed" });
    }
    console.error("getCheckoutInfoHandler error:", err.message || err);
    next(err);
  }
}

module.exports = {
  createPaymentLinkHandler,
  createPaymentLinkSchema,
  getCheckoutInfoHandler,
};
