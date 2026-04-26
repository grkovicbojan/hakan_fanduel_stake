import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  max: 30
});

export const query = (text, params) => pool.query(text, params);
