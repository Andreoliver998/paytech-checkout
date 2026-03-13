async function createPayment({ amount, currency, metadata }) {
  // Here we would call Stripe API
  return {
    gatewayId: `stripe_${Date.now()}`,
    status: "PROCESSING",
    details: metadata,
  };
}

async function getPaymentStatus(gatewayId) {
  // Dummy status resolver
  return { status: "PAID", gatewayId };
}

module.exports = { createPayment, getPaymentStatus };
