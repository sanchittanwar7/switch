import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dns from "node:dns/promises";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const url = new URL(DATABASE_URL);
const ipv4 = await dns.resolve4(url.hostname).then((r) => r[0]);
url.hostname = ipv4;

const pool = new pg.Pool({
  connectionString: url.toString(),
});

export const db = drizzle(pool, { schema });
export { schema };
