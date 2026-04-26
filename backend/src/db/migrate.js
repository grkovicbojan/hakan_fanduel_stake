import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const schemaPath = path.resolve(__dirname, "./schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);
  logger.info("Migration completed.");
  await pool.end();
}

run().catch(async (error) => {
  logger.error("Migration failed.", { error: error.message });
  await pool.end();
  process.exit(1);
});
