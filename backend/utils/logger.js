/**
 * Logging utility for PayTech Checkout
 * 
 * Provides structured logging with different severity levels.
 * Can be easily swapped for Winston or Pino in the future.
 */

const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

const LOG_LEVEL_PRIORITY = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = LOG_LEVEL_PRIORITY[process.env.LOG_LEVEL?.toUpperCase() || "INFO"] || LOG_LEVEL_PRIORITY.INFO;

function formatTimestamp() {
  return new Date().toISOString();
}

function shouldLog(level) {
  return LOG_LEVEL_PRIORITY[level] <= currentLevel;
}

function format(level, message, data = null) {
  const timestamp = formatTimestamp();
  let output = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    if (typeof data === "object") {
      output += ` ${JSON.stringify(data)}`;
    } else {
      output += ` ${data}`;
    }
  }
  
  return output;
}

const logger = {
  error: (message, data) => {
    if (shouldLog("ERROR")) {
      console.error(format("ERROR", message, data));
    }
  },

  warn: (message, data) => {
    if (shouldLog("WARN")) {
      console.warn(format("WARN", message, data));
    }
  },

  info: (message, data) => {
    if (shouldLog("INFO")) {
      console.log(format("INFO", message, data));
    }
  },

  debug: (message, data) => {
    if (shouldLog("DEBUG")) {
      console.log(format("DEBUG", message, data));
    }
  },

  /**
   * Log API request
   */
  logRequest: (method, path, status, duration) => {
    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    logger[level.toLowerCase()](
      `${method} ${path}`,
      { status, duration: `${duration}ms` }
    );
  },

  /**
   * Log payment event
   */
  logPayment: (paymentId, event, data) => {
    logger.info(`Payment ${event}`, {
      payment_id: paymentId,
      ...data,
    });
  },

  /**
   * Log webhook event
   */
  logWebhook: (event, status, data) => {
    const level = status === 200 ? "INFO" : "WARN";
    logger[level](
      `Webhook ${event}`,
      { status, ...data }
    );
  },
};

module.exports = logger;
