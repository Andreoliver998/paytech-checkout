const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.warn("⚠️  WARNING: ALLOWED_ORIGINS not configured in production. Cross-origin browser requests will be rejected.");
}

module.exports = {
  origin: function (origin, callback) {
    // Allow non-browser/server-to-server requests and direct navigation.
    if (!origin) return callback(null, true);

    // In production, block cross-origin browser traffic unless the whitelist is configured.
    if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
      return callback(new Error("CORS not configured"), false);
    }

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS origin '${origin}' not allowed`), false);
    }

    return callback(null, true);
  },
  credentials: true,
};
