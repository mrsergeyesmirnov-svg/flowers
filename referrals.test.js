import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseReferralCode } from "./referrals.js";

test("extracts safe referral code from Telegram start payload", () => {
  assert.equal(parseReferralCode("/start ref_tema"), "tema");
  assert.equal(parseReferralCode("/start@flowers_boom_bot ref_TEMA"), "tema");
  assert.equal(parseReferralCode("/start ref_tema<script>"), "");
  assert.equal(parseReferralCode("/start"), "");
});

test("keeps first-touch attribution and exposes referral controls only in admin", () => {
  const database = readFileSync(new URL("./database.mjs", import.meta.url), "utf8");
  const admin = readFileSync(new URL("./admin.html", import.meta.url), "utf8");
  assert.match(database, /ON CONFLICT \(telegram_user_id\) DO UPDATE SET\s+username=EXCLUDED\.username/);
  assert.doesNotMatch(database, /DO UPDATE SET\s+partner_code=/);
  assert.ok(admin.includes('id="referralsPanel"'));
  assert.ok(admin.includes("super-only"));
});
