import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!.includes("?")
    ? process.env.DATABASE_URL! + "&family=4"
    : process.env.DATABASE_URL! + "?family=4",
});

export const db = drizzle(pool, { schema });
export { schema };
