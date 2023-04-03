/**
 * https://github.com/fabe/telegram-chatgpt-bot-worker
 */

const API_KEY = "OPENAI_API_TOKEN"; // Get it from https://platform.openai.com/account/api-keys
const TOKEN = "TELEGRAM_BOT_TOKEN"; // Get it from @BotFather https://core.telegram.org/bots#6-botfather
const CHAT_ID = null; // Integer, Chat ID of your Telegram chat. If you don't want to verify, set to null

const GPT_MODEL = "gpt-3.5-turbo";
const GPT_MAX_TOKENS = 1024;
const GPT_TEMPERATURE = 0.7;
const WEBHOOK = "/endpoint";
const SECRET = "WEBHOOK_SECRET"; // A-Z, a-z, 0-9, _ and -

/**
 * Wait for requests to the worker
 */
addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event));
  } else if (url.pathname === "/registerWebhook") {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET));
  } else if (url.pathname === "/unRegisterWebhook") {
    event.respondWith(unRegisterWebhook(event));
  } else {
    event.respondWith(new Response(null, { status: 404 }));
  }
});

/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
function handleWebhook(event) {
  // Check secret
  if (event.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== SECRET) {
    return new Response("Unauthorized", { status: 403 });
  }

  // Handle the request async
  const handler = async function () {
    const update = await event.request.json();
    await onUpdate(update);
  };
  event.waitUntil(handler());
  return new Response("Ok");
}

/**
 * Handle incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate(update) {
  if ("message" in update) {
    await onMessage(update.message);
  }
}

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage(message) {
  if (CHAT_ID && message.chat.id !== CHAT_ID) return false;

  await sendTyping(message.chat.id);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      max_tokens: GPT_MAX_TOKENS,
      messages: [{ role: "user", content: message.text }],
      model: GPT_MODEL,
      stream: false,
      temperature: GPT_TEMPERATURE,
    }),
  });

  const data = await response.json();
  return sendMarkdown(message.chat.id, data.choices[0].message.content.trim());
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText(chatId, text) {
  return (
    await fetch(
      apiUrl("sendMessage", {
        chat_id: chatId,
        text,
      })
    )
  ).json();
}

/**
 * Send markdown message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendMarkdown(chatId, text) {
  return (
    await fetch(
      apiUrl("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "markdown",
      })
    )
  ).json();
}

/**
 * Set is typing
 * https://core.telegram.org/bots/api#sendchataction
 */
async function sendTyping(chatId) {
  return (
    await fetch(
      apiUrl("sendChatAction", {
        chat_id: chatId,
        action: "typing",
      })
    )
  ).json();
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook(event, requestUrl, suffix, secret) {
  // https://core.telegram.org/bots/api#setwebhook
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
  const r = await (
    await fetch(apiUrl("setWebhook", { url: webhookUrl, secret_token: secret }))
  ).json();
  return new Response("ok" in r && r.ok ? "Ok" : JSON.stringify(r, null, 2));
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl("setWebhook", { url: "" }))).json();
  return new Response("ok" in r && r.ok ? "Ok" : JSON.stringify(r, null, 2));
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl(methodName, params = null) {
  let query = "";
  if (params) {
    query = "?" + new URLSearchParams(params).toString();
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`;
}
