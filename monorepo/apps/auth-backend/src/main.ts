import "dotenv/config";
import express from "express";
import { getPort } from "./app/config";
import { createPagesRouter } from "./app/pages";

function createServer() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.urlencoded({ extended: false }));

  // Server-rendered auth pages (login / consent / logout / error). These are
  // same-origin navigations plus full-page form POSTs.
  app.use("/", createPagesRouter());

  return app;
}

const port = getPort();
createServer().listen(port, () => {
  console.log(`auth-backend listening on :${port}`);
});
