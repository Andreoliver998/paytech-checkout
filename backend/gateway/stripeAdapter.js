/**
 * Stripe Payment Adapter - NOT IMPLEMENTED
 * 
 * This adapter is a placeholder and currently returns mock responses.
 * To use Stripe, implement actual integration with Stripe API.
 * 
 * Required dependencies:
 * - npm install stripe
 * 
 * Reference: https://stripe.com/docs/api
 */

async function createPayment({ amount, currency, metadata }) {
  throw new Error(
    "Stripe adapter is not implemented. " +
    "Please implement the Stripe API integration or use Mercado Pago instead."
  );
}

async function getPaymentStatus(gatewayId) {
  throw new Error(
    "Stripe adapter is not implemented. " +
    "Please implement the Stripe API integration or use Mercado Pago instead."
  );
}

module.exports = { createPayment, getPaymentStatus };
