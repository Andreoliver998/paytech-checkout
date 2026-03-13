const prisma = require("../models/prisma");

async function createProduct(data) {
  return prisma.product.create({
    data: {
      name: data.name,
      price: data.price,
      currency: data.currency || "BRL",
      client_id: data.client_id,
      redirect_url: data.redirect_url,
    },
  });
}

async function getProductWithClient(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { client: true, paymentLink: true },
  });
}

module.exports = { createProduct, getProductWithClient };
