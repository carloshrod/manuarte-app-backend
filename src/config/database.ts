import { Sequelize } from "sequelize";
import { env } from "./env";

const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST } = env;

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: "postgres",
});
