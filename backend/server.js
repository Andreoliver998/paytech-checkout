
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const dotenv = require("dotenv");

// Force project .env values even if machine-level env vars already exist.
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const corsConfig = require("./config/cors");
const apiRoutes = require("./routes/api");
const webhookRoutes = require("./webhooks/webhooks");
const paymentRoutes = require("./routes/payments");
const { renderCheckoutPage } = require("./controllers/checkoutController");

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "";
const DEFAULT_PAYMENT_SLUG = process.env.DEFAULT_PAYMENT_SLUG || "demo";
const baseOrigin = (() => {
  try {
    return BASE_URL ? new URL(BASE_URL).origin : null;
  } catch (_) {
    return null;
  }
})();

app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://sdk.mercadopago.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          ...(baseOrigin ? [baseOrigin] : []),
          "https://api.mercadopago.com",
          "https://*.mercadopago.com",
        ],
        frameSrc: ["'self'", "https://*.mercadopago.com"],
      },
    },
  })
);
app.use(cors(corsConfig));
app.use(express.json());

// Static assets
app.use(express.static(path.join(__dirname, "..", "frontend")));

// API routes
app.use("/api", apiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);

// Checkout page by slug
app.get("/checkout/:slug", renderCheckoutPage);
app.get("/pay", (req, res) => {
  const slug = String(req.query.slug || DEFAULT_PAYMENT_SLUG).trim();
  return res.redirect(`/pay/${encodeURIComponent(slug)}`);
});
app.get("/pay/:slug", renderCheckoutPage);

// Success / cancel / pending routes
app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "success.html"));
});

app.get("/cancel", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "cancel.html"));
});

app.get("/pending", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "pending.html"));
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`PayTech Checkout running on port ${PORT}`);
});
