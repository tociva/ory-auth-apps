import "dotenv/config";
import express from "express";
import { getPort } from "./app/config";
import { createPagesRouter } from "./app/pages";

function createServer() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Server-rendered auth pages (login / consent / logout / error). These are
  // same-origin GET navigations plus a full-page form POST to Kratos, so no
  // CORS or JSON body parsing is needed — that was only for the old SPA's XHR
  // proxy under /api/hydra.
  app.use("/", createPagesRouter());

  return app;
}

const port = getPort();
createServer().listen(port, () => {
  console.log(`auth-backend listening on :${port}`);
});
