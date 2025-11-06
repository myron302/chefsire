import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const require2 = createRequire(import.meta.url);
const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

let routesMounted = false;

try {
  const mod = require2("./routes");
  // support either CommonJS export or ESM default
  const routes = (mod as any).default ?? mod;
  app.use("/api", routes);
  routesMounted = true;
  console.log("[ChefSire] API routes mounted");
} catch (err) {
  console.error("[ChefSire] Failed to load API routes:", err);
  // DEBUG: write full stack to a tmp file so you can read it via SSH/Plesk
  try {
    const body = err && (err as Error).stack ? (err as Error).stack : String(err);
    fs.writeFileSync("/tmp/chefsire-route-error.log", body);
  } catch (writeErr) {
    /* ignore write errors */
  }
  app.all("/api/*", (_req, res) => {
    res.status(503).json({
      error: "API routes failed to load",
      hint:
        process.env.NODE_ENV === "production"
          ? "Check server logs for the exact router that failed to initialize."
          : String(err),
    });
  });
}

app.get("/api", (_req, res) => {
  res.json({
    name: "ChefSire API",
    status: routesMounted ? "running" : "degraded",
    timestamp: new Date().toISOString(),
  });
});

const clientDir = path.resolve(process.cwd(), "../dist/public");
const hasClient = fs.existsSync(clientDir);

if (hasClient) {
  app.use(
    express.static(clientDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
}

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!hasClient) {
    return res
      .status(200)
      .send("Client bundle not found. Build UI with `npm run build` to populate /httpdocs/dist/public.");
  }
  res.sendFile(path.join(clientDir, "index.html"));
});

if (routesMounted) {
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });
}

app.use((err: unknown, _req: any, res: any, _next: any) => {
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  if (!isProd) console.error("[ERROR]", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: isProd ? "An unexpected error occurred." : message,
    ...(isProd ? {} : { stack }),
  });
});

export default app;
