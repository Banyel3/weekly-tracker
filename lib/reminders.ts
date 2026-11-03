export const REMINDER_SENT_KEY = "lastSentOn:reminder";

/** Startup awaits the catch-up send, so a stalled connection must not hold readiness past the healthcheck. */
export const TELEGRAM_TIMEOUT_MS = 10_000;

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Returns true when Telegram accepted the message; logs and returns false otherwise. */
export async function sendTelegram(text: string, tag: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[${tag}] telegram responded ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error(`[${tag}] telegram request timed out after ${TELEGRAM_TIMEOUT_MS}ms`);
      return false;
    }
    console.error(`[${tag}] telegram request failed:`, err);
    return false;
  }
}
