import test from "node:test";
import assert from "node:assert/strict";
import { availableBouquets, recommend } from "./recommender.js";

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
