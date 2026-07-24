import "dotenv/config";
import express from "express";
import { getPort, validateAuthRuntimeConfiguration } from "./app/config";
import { createOrchestratorRouter } from "./app/orchestrator";
import { createPagesRouter } from "./app/pages";
import { startAuthTransactionMaintenance } from "./app/transaction-maintenance";

function createServer() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.set("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: false }));

  // Trusted Hydra/Kratos orchestration and browser-safe context APIs.
  app.use("/", createOrchestratorRouter());

  // Server-rendered auth pages (login / consent / logout / error). These are
  // same-origin navigations plus full-page form POSTs.
  app.use("/", createPagesRouter());

  return app;
}

const port = getPort();
validateAuthRuntimeConfiguration();
startAuthTransactionMaintenance();
createServer().listen(port, () => {
  console.log(`auth-backend listening on :${port}`);
});
