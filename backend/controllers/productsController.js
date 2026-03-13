const { z } = require("zod");
const { createProduct } = require("../services/productService");
const { getClientById } = require("../services/clientService");

const createProductSchema = z.object({
  body: z.object({
    client_id: z.string().cuid(),
    name: z.string().min(2),
    price: z.number().positive(),
    currency: z.string().min(3).max(3).optional(),
    redirect_url: z.string().url().optional(),
  }),
});

async function createProductHandler(req, res, next) {
  try {
    const { client_id } = req.validated.body;
    const client = await getClientById(client_id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const product = await createProduct(req.validated.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

module.exports = { createProductHandler, createProductSchema };
