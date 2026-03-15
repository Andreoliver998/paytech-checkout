/**
 * Stone Payment Adapter - NOT IMPLEMENTED
 * 
 * This adapter is a placeholder and currently returns mock responses.
 * To use Stone, implement actual integration with Stone API.
 * 
 * Required dependencies:
 * - npm install stone-api (or appropriate Stone SDK)
 * 
 * Reference: https://docs.stone.com.br
 */

async function createPayment({ amount, currency, metadata }) {
  throw new Error(
    "Stone adapter is not implemented. " +
    "Please implement the Stone API integration or use Mercado Pago instead."
  );
}

async function getPaymentStatus(gatewayId) {
  throw new Error(
    "Stone adapter is not implemented. " +
    "Please implement the Stone API integration or use Mercado Pago instead."
  );
}

module.exports = { createPayment, getPaymentStatus };
