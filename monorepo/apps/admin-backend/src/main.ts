import "dotenv/config";
import express from "express";
import cors from "cors";
import { getCorsOrigins, getPort } from "./app/config";
import { createAdminRouter } from "./app/routes";

function createServer() {
  const app = express();
  const allowedOrigins = getCorsOrigins();

  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : true,
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
