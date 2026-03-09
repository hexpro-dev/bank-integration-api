import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./dist/schema/schema.js",
	out: "./migrations",
	dialect: "postgresql",
	...(process.env.DATABASE_URL && {
		dbCredentials: { url: process.env.DATABASE_URL },
	}),
});
