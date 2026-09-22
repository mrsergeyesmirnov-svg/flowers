import { createHmac, timingSafeEqual } from "node:crypto";

export function validateTelegramInitData(initData, botToken, { maxAgeSeconds = 300, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const received = Buffer.from(receivedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || authDate > now + 30 || now - authDate > maxAgeSeconds) return null;
  try {
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id) return null;
    return { userId: String(user.id), user };
  } catch {
    return null;
  }
}
