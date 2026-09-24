import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// All public endpoints serve live DB data — never cache them so admin changes
// are immediately visible on the public site.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ─── GET /api/public/products ─────────────────────────────────────────────────
// Returns only ACTIVE products (admin uses is_active to hide rows from the
// public site). The `coming_soon` flag is included so the frontend can hide
// the price and swap the CTA without filtering the row out.
router.get("/public/products", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT product_key, display_name, category, description, logo_url, redirect_url,
              monthly_price, discount_price, coming_soon, under_maintenance, sort_order, page_content
       FROM products_config WHERE is_active = true ORDER BY sort_order`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /public/products error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/public/plans ────────────────────────────────────────────────────
router.get("/public/plans", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT plan_key, display_name, category, monthly_price, annual_price, description,
              features, products, coming_soon, sort_order
       FROM plans_config WHERE is_active = true ORDER BY sort_order`
    );
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /public/plans error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/public/products/:key ───────────────────────────────────────────
// Returns a single active product including page_content for the dynamic page.
router.get("/public/products/:key", async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      `SELECT product_key, display_name, category, description, logo_url, redirect_url,
              monthly_price, discount_price, coming_soon, under_maintenance, sort_order, page_content
       FROM products_config WHERE product_key=$1 AND is_active = true LIMIT 1`,
      [key]
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /public/products/:key error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/public/content ──────────────────────────────────────────────────
router.get("/public/content", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT key, value FROM site_content ORDER BY key`);
    const obj: Record<string, string> = {};
    for (const row of result.rows) obj[row.key] = row.value;
    res.json(obj);
  } catch (err) {
    logger.error({ err }, "GET /public/content error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
