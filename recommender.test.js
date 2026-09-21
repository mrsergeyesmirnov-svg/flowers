import test from "node:test";
import assert from "node:assert/strict";
import { recommend } from "./recommender.js";

test("подбор учитывает описание и бюджет", () => {
  const [first] = recommend({ description: "она нежная, любит минимализм", occasion: "первая встреча", budget: 6000 });
  assert.equal(first.id, "cloud");
  assert.equal(recommend({ description: "яркая и смелая", occasion: "день рождения", budget: 8000 }).length, 3);
});
