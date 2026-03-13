const prisma = require("../models/prisma");
const slugify = require("../utils/slugify");

async function createPaymentLink(data) {
  const slug = await buildUniqueSlug(data);

  return prisma.paymentLink.create({
    data: {
      product_id: data.product_id,
      slug,
      active: data.active ?? true,
    },
    include: {
      product: { include: { client: true } },
    },
  });
}

async function buildUniqueSlug(data) {
  const baseSource = data.slug || data.name || data.product_id;
  const baseSlug = slugify(baseSource) || String(data.product_id);
  let slug = baseSlug;
  let i = 2;

  // Guarantee unique slugs instead of letting Prisma throw on duplicates.
  while (await prisma.paymentLink.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i}`;
    i += 1;
  }
  return slug;
}

async function getActiveLink(slug) {
  return prisma.paymentLink.findUnique({
    where: { slug },
    include: {
      product: {
        include: { client: true },
      },
    },
  });
}

module.exports = { createPaymentLink, getActiveLink };
