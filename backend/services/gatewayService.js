const stripeAdapter = require("../gateway/stripeAdapter");
const mercadoPagoAdapter = require("../gateway/mercadoPagoAdapter");
const stoneAdapter = require("../gateway/stoneAdapter");

function resolveAdapter(provider) {
  switch ((provider || "").toLowerCase()) {
    case "stripe":
      return stripeAdapter;
    case "mercadopago":
    case "mercado_pago":
      return mercadoPagoAdapter;
    case "stone":
      return stoneAdapter;
    default:
      throw new Error(`Unsupported gateway provider: ${provider}`);
  }
}

async function createGatewayPayment({ provider, amount, currency, metadata }) {
  const adapter = resolveAdapter(provider);
  return adapter.createPayment({ amount, currency, metadata });
}

async function fetchGatewayStatus({ provider, gatewayId }) {
  const adapter = resolveAdapter(provider);
  return adapter.getPaymentStatus(gatewayId);
}

module.exports = { createGatewayPayment, fetchGatewayStatus };
