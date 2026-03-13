const path = require("path");

function renderCheckoutPage(req, res) {
  res.sendFile(path.join(__dirname, "..", "..", "frontend", "checkout", "index.html"));
}

module.exports = { renderCheckoutPage };
