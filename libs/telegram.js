const axios = require("axios");

async function telegramNotify(text) {
  if (!process.env.TELEGRAM_BOT_ID || !process.env.TELEGRAM_CHAT_ID) {
    return;
  }
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_ID}/sendMessage`;
  const body = {
    chat_id: parseInt(process.env.TELEGRAM_CHAT_ID),
    text,
  };
  try {
    await axios.post(url, JSON.stringify(body), {
      headers: { "Content-Type": "application/json;charset=utf-8" },
    });
  } catch (error) {
    console.error("telegramNotify error:", error);
  }
}
module.exports = {
  telegramNotify,
};
