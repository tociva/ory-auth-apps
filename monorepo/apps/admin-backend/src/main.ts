import "dotenv/config";
import { isAllowedOrigin } from "@idnest/shared-types";
import cors from "cors";
import express from "express";
import { getAdminCorsOrigins, getPort } from "./app/config";
import { createAdminRouter } from "./app/routes";

function createServer() {
  const app = express();
  const allowedOrigins = getAdminCorsOrigins();

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, origin === undefined || isAllowedOrigin(origin, allowedOrigins));
      },
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
