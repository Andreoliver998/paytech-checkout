const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

module.exports = {
  origin: function (origin, callback) {
    // allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error("CORS origin not allowed"), false);
    }
    return callback(null, true);
  },
  credentials: true,
};
