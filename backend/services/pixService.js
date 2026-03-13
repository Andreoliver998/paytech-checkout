const QRCode = require("qrcode");
const { v4: uuid } = require("uuid");

async function generatePixPayment({ amount, description }) {
  const copyPasteCode = `000201PIX${amount.toFixed(2)}${uuid()}`;
  const qr_code = await QRCode.toDataURL(copyPasteCode);

  return { qr_code, copy_paste_code: copyPasteCode };
}

module.exports = { generatePixPayment };
