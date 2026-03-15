# Security Configuration Guide

## Critical Fixes Applied (March 14, 2026)

This document outlines the security fixes applied to prevent vulnerabilities in production.

---

## 1. Webhook HMAC Signature Validation ✅

### Before and After

- **Before:** Simple string comparison `signature === secret`
- **After:** HMAC-SHA256 signature validation using `crypto.timingSafeEqual()`

### Configuration Required

```bash
# Set a strong random secret (use openssl rand -hex 32)
WEBHOOK_SECRET=your-secure-random-webhook-secret-here
MERCADOPAGO_WEBHOOK_SECRET=your-mercado-pago-webhook-secret
```

### How It Works

```text
Mercado Pago computes: HMAC-SHA256(request_body, secret)
Sends in header: x-mercadopago-signature

PayTech verifies:
1. Compute HMAC-SHA256(request_body, secret) locally
2. Compare with timing-safe comparison (protects against timing attacks)
3. Only process if signatures match
```

### Generate Secure Secret

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 2. CORS Whitelist Enforcement ✅

### Before and After Implementation

- **Before:** If `ALLOWED_ORIGINS` was empty, allowed ALL origins
- **After:** In production, enforces whitelist or rejects requests

### CORS Configuration

```bash
# Production example:
ALLOWED_ORIGINS=https://checkout.paytech.app.br,https://paytech.app.br,https://app.paytech.app.br

# Separate multiple origins with commas (no spaces)
```

### Environment-Specific Behavior

```javascript
// Development (NODE_ENV != "production")
- Allows requests with no origin (curl, mobile apps)
- Allows requests if ALLOWED_ORIGINS is empty
- Checks whitelist if configured

// Production (NODE_ENV = "production")
- REQUIRES origin header
- REQUIRES ALLOWED_ORIGINS to be configured
- Rejects any origin not in whitelist
- Logs warning at startup if not configured
```

---

## 3. Environment Variables Completed ✅

### All Required Variables (.env.example)

```bash
# Server Configuration
PORT=3003
NODE_ENV=production
DOMAIN=checkout.paytech.app.br
BASE_URL=https://checkout.paytech.app.br

# Database (CRITICAL)
DATABASE_URL=postgresql://paytech:paytech@localhost:5433/paytech_checkout

# Mercado Pago
MERCADOPAGO_PUBLIC_KEY=your_public_key_here
MERCADOPAGO_ACCESS_TOKEN=your_access_token_here

# Webhook Security (CRITICAL)
WEBHOOK_SECRET=your-secure-random-webhook-secret-here
MERCADOPAGO_WEBHOOK_SECRET=your-mercado-pago-webhook-secret

# CORS (CRITICAL in Production)
ALLOWED_ORIGINS=https://checkout.paytech.app.br,https://paytech.app.br

# Redirect URLs
SUCCESS_URL=https://paytech.app.br/success
FAILURE_URL=https://paytech.app.br/error
PENDING_URL=https://paytech.app.br/pending

# Default Payment Slug
DEFAULT_PAYMENT_SLUG=demo

# Logging
LOG_LEVEL=info
```

---

## 4. Gateway Adapters Status ✅

### Implemented Gateways

- ✅ **Mercado Pago** - FULLY IMPLEMENTED (production-ready)

### Not Implemented

- ❌ **Stripe** - Placeholder only, throws error if used
- ❌ **Stone** - Placeholder only, throws error if used

### To Enable Stripe/Stone

1. Install SDK: `npm install stripe` or `npm install stone-api`
2. Implement adapters in `/backend/gateway/`
3. Update `gatewayService.js` to handle the adapter
4. Thoroughly test before deploying

---

## 5. Structured Logging ✅

### Before and After Logging

- **Before:** Errors logged to `mp-error.log` file (could grow infinitely)
- **After:** Structured logging to console with timestamp and severity

### New Logger Module

```javascript
// File: /backend/utils/logger.js
const logger = require("../utils/logger");

logger.error("Payment failed", { payment_id: "abc123", error: "timeout" });
logger.warn("Signature validation failed", { ip: "192.168.1.1" });
logger.info("Payment created", { amount: 100, currency: "BRL" });
logger.debug("DB query executed", { duration: "45ms" });
```

### Log Level Configuration

```bash
# .env
LOG_LEVEL=info  # Options: error, warn, info, debug
```

### Log Output Example

```text
[2026-03-14T10:32:15.123Z] [ERROR] Payment failed {"payment_id":"abc123","error":"timeout"}
[2026-03-14T10:32:14.987Z] [WARN] Signature validation failed {"ip":"192.168.1.1"}
[2026-03-14T10:32:14.456Z] [INFO] Payment created {"amount":100,"currency":"BRL"}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate and set `WEBHOOK_SECRET` (32+ hex characters)
- [ ] Configure `ALLOWED_ORIGINS` with your domains
- [ ] Set `DATABASE_URL` to production database
- [ ] Configure Mercado Pago keys (`MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_ACCESS_TOKEN`)
- [ ] Set `LOG_LEVEL=info` (or `warn` for less noise)
- [ ] Test webhook signature validation with Mercado Pago
- [ ] Test CORS by making requests from allowed origins
- [ ] Monitor logs for security events

---

## Monitoring Security Events

### Critical Events to Alert On

1. **Webhook signature validation failures** → Possible attack attempt
2. **CORS origin rejections** → Possible CSRF attempt
3. **Multiple failed attempts** → Brute force behavior

### Example Alert Setup

```bash
# Monitor logs for failures
tail -f app.log | grep "Webhook signature validation failed"

# Integrate with your monitoring system (DataDog, New Relic, etc.)
```

---

## Future Improvements

- [ ] Rate limiting middleware for `/api/payments`
- [ ] Database transactions for payment consistency
- [ ] IP whitelisting for webhook endpoints
- [ ] JWT authentication for API endpoints
- [ ] Comprehensive API documentation (OpenAPI/Swagger)
- [ ] Unit and integration tests

---

## Support

For security questions or to report vulnerabilities, contact: [security@paytech.app.br](mailto:security@paytech.app.br)
