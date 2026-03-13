const { z } = require("zod");
const { createClient } = require("../services/clientService");

const createClientSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    gateway_provider: z.string().min(2),
    gateway_account_id: z.string().min(2),
    brand_color: z.string().optional(),
    logo_url: z.string().url().optional(),
  }),
});

async function createClientHandler(req, res, next) {
  try {
    const client = await createClient(req.validated.body);
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

module.exports = { createClientHandler, createClientSchema };
