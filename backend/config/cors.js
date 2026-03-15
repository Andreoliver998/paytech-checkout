const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.warn("⚠️  WARNING: ALLOWED_ORIGINS not configured in production. CORS protection disabled!");
}

module.exports = {
  origin: function (origin, callback) {
    // In production, enforce whitelist
    if (process.env.NODE_ENV === "production") {
      if (!origin) {
        return callback(new Error("CORS origin required in production"), false);
      }
      if (allowedOrigins.length === 0) {
        return callback(new Error("CORS not configured"), false);
      }
    }

    // In dev, allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);

    // Check whitelist
    if (allowedOrigins.length > 0 && allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS origin '${origin}' not allowed`), false);
    }

    return callback(null, true);
  },
  credentials: true,
};
