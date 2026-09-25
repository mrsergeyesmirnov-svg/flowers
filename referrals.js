export function parseReferralCode(text) {
  return String(text || "").match(/^\/start(?:@\w+)?\s+ref_([a-z0-9_-]{1,32})$/i)?.[1]?.toLowerCase() || "";
}
