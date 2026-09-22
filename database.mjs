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
      contact_phone text NOT NULL DEFAULT '',
      contact_telegram text NOT NULL DEFAULT '',
      address text NOT NULL DEFAULT '',
      about text NOT NULL DEFAULT '',
      map_url text NOT NULL DEFAULT '',
      schedule text NOT NULL DEFAULT '',
      pickup text NOT NULL DEFAULT '',
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
      kind text NOT NULL DEFAULT 'bouquet',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS bouquets_shop_id_idx ON bouquets(shop_id);
    CREATE TABLE IF NOT EXISTS shop_staff (
      id text PRIMARY KEY,
      shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name text NOT NULL,
      phone text NOT NULL,
      role text NOT NULL DEFAULT 'florist',
      telegram_user_id text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS shop_staff_shop_id_idx ON shop_staff(shop_id);
    CREATE TABLE IF NOT EXISTS shop_orders (
      id text PRIMARY KEY,
      shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      customer_name text NOT NULL DEFAULT '',
      customer_phone text NOT NULL DEFAULT '',
      total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
      status text NOT NULL DEFAULT 'new',
      florist_id text REFERENCES shop_staff(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS shop_orders_shop_id_idx ON shop_orders(shop_id);
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_telegram text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS about text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS map_url text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS schedule text NOT NULL DEFAULT '';
    ALTER TABLE shops ADD COLUMN IF NOT EXISTS pickup text NOT NULL DEFAULT '';
    ALTER TABLE bouquets ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'bouquet';
    ALTER TABLE shop_staff ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'florist';
    ALTER TABLE shop_staff ADD COLUMN IF NOT EXISTS telegram_user_id text;
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
  orders: row.orders,
  contactPhone: row.contact_phone,
  contactTelegram: row.contact_telegram,
  address: row.address,
  about: row.about,
  mapUrl: row.map_url,
  schedule: row.schedule,
  pickup: row.pickup
});

const mapBouquet = (row) => ({
  id: row.id,
  name: row.name,
  flowers: row.flowers,
  description: row.description,
  price: row.price,
  image: row.image,
  tags: row.tags,
  available: row.available,
  kind: row.kind || "bouquet"
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

export async function updateShopProfile(id, profile) {
  const { rows } = await pool.query(
    `UPDATE shops SET contact_phone=$2, contact_telegram=$3, address=$4, about=$5,
       map_url=$6, schedule=$7, pickup=$8, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, profile.contactPhone, profile.contactTelegram, profile.address, profile.about, profile.mapUrl, profile.schedule, profile.pickup]
  );
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function listCatalog(shopId, availableOnly = false, kind = "") {
  const { rows } = await pool.query(
    `SELECT * FROM bouquets WHERE shop_id=$1 ${availableOnly ? "AND available=true" : ""} ${kind ? "AND kind=$2" : ""} ORDER BY created_at`,
    kind ? [shopId, kind] : [shopId]
  );
  return rows.map(mapBouquet);
}

export async function createBouquet(shopId, bouquet) {
  const id = bouquet.id || randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO bouquets (id, shop_id, name, flowers, description, price, image, tags, available, kind)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
    [id, shopId, bouquet.name, bouquet.flowers, bouquet.description || "", bouquet.price, bouquet.image || "", JSON.stringify(bouquet.tags || []), bouquet.available !== false, bouquet.kind || "bouquet"]
  );
  return mapBouquet(rows[0]);
}

export async function updateBouquet(shopId, id, bouquet) {
  const { rows } = await pool.query(
    `UPDATE bouquets SET name=$3, flowers=$4, description=$5, price=$6, image=$7,
       available=$8, kind=$9, updated_at=now() WHERE shop_id=$1 AND id=$2 RETURNING *`,
    [shopId, id, bouquet.name, bouquet.flowers, bouquet.description || "", bouquet.price, bouquet.image || "", bouquet.available, bouquet.kind || "bouquet"]
  );
  return rows[0] ? mapBouquet(rows[0]) : null;
}

export async function listStaff(shopId) {
  const { rows } = await pool.query(
    `SELECT s.*, count(o.id) FILTER (WHERE o.status='completed')::int AS completed_orders
     FROM shop_staff s LEFT JOIN shop_orders o ON o.florist_id=s.id
     WHERE s.shop_id=$1 GROUP BY s.id ORDER BY s.created_at`,
    [shopId]
  );
  return rows.map((row) => ({ id: row.id, name: row.name, phone: row.phone, role: row.role, active: row.active, connected: Boolean(row.telegram_user_id), completedOrders: row.completed_orders }));
}

export async function createStaff(shopId, staff) {
  const { rows } = await pool.query(
    "INSERT INTO shop_staff (id, shop_id, name, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [randomUUID(), shopId, staff.name, staff.phone, staff.role]
  );
  const row = rows[0];
  return { id: row.id, name: row.name, phone: row.phone, role: row.role, active: row.active, connected: false, completedOrders: 0 };
}

export async function updateStaff(shopId, id, active) {
  const { rows } = await pool.query(
    "UPDATE shop_staff SET active=$3 WHERE shop_id=$1 AND id=$2 RETURNING *",
    [shopId, id, active]
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.name, phone: row.phone, role: row.role, active: row.active, connected: Boolean(row.telegram_user_id), completedOrders: 0 } : null;
}

export async function listOrders(shopId) {
  const { rows } = await pool.query(
    `SELECT o.*, s.name AS florist_name FROM shop_orders o
     LEFT JOIN shop_staff s ON s.id=o.florist_id WHERE o.shop_id=$1 ORDER BY o.created_at DESC`,
    [shopId]
  );
  return rows.map((row) => ({
    id: row.id, customerName: row.customer_name, customerPhone: row.customer_phone,
    total: row.total, status: row.status, floristId: row.florist_id || "", floristName: row.florist_name || "",
    createdAt: row.created_at
  }));
}

export async function updateOrder(shopId, id, input) {
  const floristId = input.floristId
    ? (await pool.query("SELECT id FROM shop_staff WHERE shop_id=$1 AND id=$2 AND active=true", [shopId, input.floristId])).rows[0]?.id || null
    : null;
  const { rows } = await pool.query(
    `UPDATE shop_orders SET status=$3, florist_id=$4, updated_at=now()
     WHERE shop_id=$1 AND id=$2 RETURNING *`,
    [shopId, id, input.status, floristId]
  );
  return rows[0] || null;
}

export async function closeDatabase() {
  await pool?.end();
}
