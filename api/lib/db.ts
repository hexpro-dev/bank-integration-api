import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@hex-pro/bank-integration-database/schema";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

process.on("SIGTERM", () => pool.end());

export const orm = drizzle(pool, { schema });
