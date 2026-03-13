async function createPayment({ amount, currency, metadata }) {
  return {
    gatewayId: `stone_${Date.now()}`,
    status: "PROCESSING",
    details: metadata,
  };
}

async function getPaymentStatus(gatewayId) {
  return { status: "PAID", gatewayId };
}

module.exports = { createPayment, getPaymentStatus };
