import pg from "pg";
import { randomUUID } from "node:crypto";
import { bouquets as demoBouquets } from "./recommender.js";

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

export const databaseEnabled = Boolean(pool);

export async function ensureDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id text PRIMARY KEY,
      name text NOT NULL,
      bot_username text NOT NULL DEFAULT '',
      plan text NOT NULL DEFAULT 'Start',
      subscription text NOT NULL DEFAULT 'trial',
      monthly integer NOT NULL DEFAULT 0 CHECK (monthly >= 0),
      paid_until date,
      bot_status text NOT NULL DEFAULT 'setup',
      enabled boolean NOT NULL DEFAULT true,
      orders integer NOT NULL DEFAULT 0 CHECK (orders >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS bouquets (
      id text PRIMARY KEY,
      shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name text NOT NULL,
      flowers text NOT NULL,
      description text NOT NULL DEFAULT '',
      price integer NOT NULL CHECK (price >= 0),
      image text NOT NULL DEFAULT '',
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      available boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS bouquets_shop_id_idx ON bouquets(shop_id);
  `);

  const shopId = process.env.SHOP_ID;
  if (!shopId) return;
  await pool.query(
    `INSERT INTO shops (id, name, bot_username, plan, subscription, monthly, bot_status)
     VALUES ($1, $2, $3, 'Пилот', 'trial', 2900, 'online') ON CONFLICT (id) DO NOTHING`,
    [shopId, process.env.SHOP_NAME || "Цветы — пилот", process.env.BOT_USERNAME || ""]
  );
  const { rows: [{ count }] } = await pool.query("SELECT count(*)::int AS count FROM bouquets WHERE shop_id = $1", [shopId]);
  if (count === 0) {
    for (const bouquet of demoBouquets) {
      await createBouquet(shopId, bouquet);
    }
  }
}

const mapShop = (row) => ({
  id: row.id,
  name: row.name,
  bot: row.bot_username,
  plan: row.plan,
  subscription: row.subscription,
  monthly: row.monthly,
  paidUntil: row.paid_until ? (row.paid_until instanceof Date ? row.paid_until.toISOString().slice(0, 10) : String(row.paid_until).slice(0, 10)) : "",
  botStatus: row.bot_status,
  enabled: row.enabled,
  orders: row.orders
});

const mapBouquet = (row) => ({
  id: row.id,
  name: row.name,
  flowers: row.flowers,
  description: row.description,
  price: row.price,
  image: row.image,
  tags: row.tags,
  available: row.available
});

export async function listShops() {
  const { rows } = await pool.query("SELECT * FROM shops ORDER BY created_at");
  return rows.map(mapShop);
}

export async function getShop(id) {
  if (!pool) return null;
  const { rows } = await pool.query("SELECT * FROM shops WHERE id = $1", [id]);
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function createShop(shop) {
  const { rows } = await pool.query(
    `INSERT INTO shops (id, name, bot_username, plan, subscription, monthly, paid_until, bot_status, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [shop.id, shop.name, shop.bot, shop.plan, shop.subscription, shop.monthly, shop.paidUntil || null, "setup", true]
  );
  return mapShop(rows[0]);
}

export async function updateShop(id, shop) {
  const { rows } = await pool.query(
    `UPDATE shops SET name=$2, bot_username=$3, plan=$4, subscription=$5, monthly=$6,
       paid_until=$7, enabled=$8, bot_status=CASE WHEN $8 THEN bot_status ELSE 'setup' END, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, shop.name, shop.bot, shop.plan, shop.subscription, shop.monthly, shop.paidUntil || null, shop.enabled]
  );
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function listCatalog(shopId, availableOnly = false) {
  const { rows } = await pool.query(
    `SELECT * FROM bouquets WHERE shop_id=$1 ${availableOnly ? "AND available=true" : ""} ORDER BY created_at`,
    [shopId]
  );
  return rows.map(mapBouquet);
}

export async function createBouquet(shopId, bouquet) {
  const id = bouquet.id || randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO bouquets (id, shop_id, name, flowers, description, price, image, tags, available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
    [id, shopId, bouquet.name, bouquet.flowers, bouquet.description || "", bouquet.price, bouquet.image || "", JSON.stringify(bouquet.tags || []), bouquet.available !== false]
  );
  return mapBouquet(rows[0]);
}

export async function updateBouquet(shopId, id, bouquet) {
  const { rows } = await pool.query(
    `UPDATE bouquets SET name=$3, flowers=$4, description=$5, price=$6, image=$7,
       available=$8, updated_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *`,
    [shopId, id, bouquet.name, bouquet.flowers, bouquet.description || "", bouquet.price, bouquet.image || "", bouquet.available]
  );
  return rows[0] ? mapBouquet(rows[0]) : null;
}

export async function closeDatabase() {
  await pool?.end();
}
