const prisma = require("../models/prisma");

async function createClient(data) {
  return prisma.client.create({
    data: {
      name: data.name,
      email: data.email,
      gateway_provider: data.gateway_provider,
      gateway_account_id: data.gateway_account_id,
      brand_color: data.brand_color,
      logo_url: data.logo_url,
    },
  });
}

async function getClientById(id) {
  return prisma.client.findUnique({ where: { id } });
}

module.exports = { createClient, getClientById };
