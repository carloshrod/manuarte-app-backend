import { Router } from "express";
import { sequelize } from "./config/database";

const router = Router();

router.get("/", (_req, res) => {
  res.send("Manuarte App - Backend");
});

router.get("/api/v1/ping", async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).send({
      apiSays: "Server status is OK!",
      PostgreSays: "Database connection is OK!",
    });
  } catch (error) {
    console.error(error);
  }
});

export default router;
