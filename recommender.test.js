import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { availableBouquets, recommend } from "./recommender.js";
import { adminSummary, findShopByBot, readShops } from "./admin-data.js";
import { validateTelegramInitData } from "./telegram-auth.js";

test("подбор учитывает описание и бюджет", () => {
  const [first] = recommend({ description: "она нежная, любит минимализм", occasion: "первая встреча", budget: 6000 });
  assert.equal(first.id, "cloud");
  assert.equal(recommend({ description: "яркая и смелая", occasion: "день рождения", budget: 8000 }).length, 3);
});

test("явный запрет полностью исключает цветок из рекомендаций", () => {
  const request = {
    description: "она нежная и любит минимализм",
    occasion: "день рождения",
    budget: 10000,
    avoid: "Она точно не любит розы"
  };
  const result = recommend(request);

  assert.equal(result.length, 3);
  assert.ok(result.every((bouquet) => !bouquet.flowers.toLowerCase().includes("роз")));
  assert.ok(availableBouquets(request).every((bouquet) => !bouquet.flowers.toLowerCase().includes("роз")));
});

test("запрет понимает разные формы названия цветка", () => {
  const result = recommend({ avoid: "без лилий и хризантем", budget: 8000 });
  assert.ok(result.every((bouquet) => !/лили|хризантем/i.test(bouquet.flowers)));
});

test("подбор использует ассортимент магазина из базы", () => {
  const catalog = [{ id: "only", name: "Тест", flowers: "Тюльпаны", description: "", price: 4000, image: "", tags: ["нежная"] }];
  assert.equal(recommend({ description: "нежная", budget: 5000, catalog })[0].id, "only");
});

test("тип получателя влияет на подбор", () => {
  assert.equal(recommend({ recipientType: "коллега", budget: 10000 })[0].id, "mono");
  assert.ok(recommend({ recipientType: "учитель", budget: 5000 }).slice(0, 3).some((bouquet) => bouquet.tags.includes("учитель")));
});

test("учителю не предлагается романтический повод", () => {
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const teacherOptions = app.match(/"учитель": \[(.*?)\],\n  "школа"/s)?.[1] || "";
  assert.ok(teacherOptions.includes("день учителя"));
  assert.ok(!teacherOptions.includes("первая встреча"));
  assert.ok(!teacherOptions.includes("годовщина"));
});

test("суперадмин считает только активную подписку в MRR", () => {
  const shops = readShops(JSON.stringify([
    { id: "one", name: "Первый", subscription: "active", monthly: 4900, botStatus: "online", orders: 3 },
    { id: "two", name: "Второй", subscription: "trial", monthly: 2900, botStatus: "setup", orders: 1 }
  ]));
  assert.deepEqual(adminSummary(shops), { shops: 2, online: 1, active: 1, attention: 0, mrr: 4900, orders: 4 });
});

test("кабинет магазина связывается с текущим ботом без учёта @ и регистра", () => {
  const shops = [{ id: "test-shop", bot: "@Flower_F1ower_Bot" }];
  assert.equal(findShopByBot(shops, "flower_f1ower_bot")?.id, "test-shop");
  assert.equal(findShopByBot(shops, "another_bot"), null);
});

test("кабинет магазина содержит шесть рабочих разделов", () => {
  const admin = readFileSync(new URL("./admin.html", import.meta.url), "utf8");
  for (const section of ["orders", "catalog", "addons", "contacts", "team", "mailings"]) {
    assert.ok(admin.includes(`data-tab="${section}"`));
    assert.ok(admin.includes(`data-section="${section}"`));
  }
});

test("допродажи защищены от дублей, а фотографии загружаются файлом", () => {
  const database = readFileSync(new URL("./database.mjs", import.meta.url), "utf8");
  const admin = readFileSync(new URL("./admin.html", import.meta.url), "utf8");
  assert.ok(database.includes("bouquets_unique_name_idx"));
  assert.ok(database.includes("ON CONFLICT (shop_id, kind, (lower(name)))"));
  assert.ok(admin.includes('type="file" accept="image/jpeg,image/png,image/webp"'));
  assert.ok(!admin.includes("Ссылка на фотографию"));
});

test("админ определяется только по подписанным Telegram initData", () => {
  const token = "test-token";
  const now = 1_800_000_000;
  const params = new URLSearchParams({ auth_date: String(now), query_id: "test", user: JSON.stringify({ id: 123456789, first_name: "Admin" }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));

  assert.equal(validateTelegramInitData(params.toString(), token, { now })?.userId, "123456789");
  params.set("user", JSON.stringify({ id: 999 }));
  assert.equal(validateTelegramInitData(params.toString(), token, { now }), null);
});
