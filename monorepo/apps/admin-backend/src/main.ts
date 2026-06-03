import "dotenv/config";
import express from "express";
import cors from "cors";
import { getAdminCorsOrigins, getPort } from "./app/config";
import { createAdminRouter } from "./app/routes";

function createServer() {
  const app = express();
  const allowedOrigins = getAdminCorsOrigins();

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/admin", createAdminRouter());

  return app;
}

const port = getPort();
createServer().listen(port, () => {
  console.log(`admin-backend listening on :${port}`);
});
