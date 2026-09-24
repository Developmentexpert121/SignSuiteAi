import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DO_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DO_DATABASE_URL must be set. Please add the DigitalOcean PostgreSQL connection string as a secret.",
  );
}

// Parse the connection URL so we can strip sslmode and pass ssl options
// separately — newer pg treats sslmode=require as verify-full which rejects
// the DO self-signed cert, even when ssl.rejectUnauthorized is false.
function buildPoolConfig(url: string): pg.PoolConfig {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    return {
      connectionString: u.toString(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 5,
    };
  } catch {
    // Fallback: use as-is with NODE_TLS_REJECT_UNAUTHORIZED=0 workaround
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 5,
    };
  }
}

// For libraries that take a connection string and build their own pg pool
// internally (e.g. stripe-replit-sync.runMigrations), we can't pass a
// pg.PoolConfig with ssl options. Instead, rewrite the URL so that pg's
// connection-string parser recognises `sslmode=no-verify`, which means
// "use TLS but accept self-signed certs". This is the URL-based equivalent
// of `ssl: { rejectUnauthorized: false }` and is required for DO managed
// Postgres which uses a self-signed cert chain.
function buildSafeConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("sslmode", "no-verify");
    u.searchParams.delete("uselibpqcompat");
    return u.toString();
  } catch {
    return url;
  }
}

export const pool = new Pool(buildPoolConfig(connectionString));
export const db = drizzle(pool, { schema });

/**
 * Build a standalone pg Pool for an arbitrary connection string, using the same
 * DO-friendly SSL handling as the primary pool. Used for cross-app reads (e.g.
 * verifying login credentials against the InstalliQ database).
 */
export function createPool(url: string): pg.Pool {
  return new Pool(buildPoolConfig(url));
}

export type { Pool } from "pg";

export * from "./schema";
export * from "./bootstrap";
export { buildPoolConfig, buildSafeConnectionString };
