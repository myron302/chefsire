// server/app.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import routes from "./routes";

const app = express();

// ---- App-level settings ----
app.set("trust proxy", true);

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Log verbosely only in dev
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ---- Health & Root ----
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "development" });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "ChefSire API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// ---- API ----
app.use("/api", routes);

// ---- 404 for unknown API paths ----
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// ---- Global error handler ----
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isProd = process.env.NODE_ENV === "production";
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;

  if (!isProd) {
    console.error("[ERROR]", err);
  }

  res.status(500).json({
    error: "Internal Server Error",
    message: isProd ? "An unexpected error occurred." : message,
    ...(isProd ? {} : { stack }),
  });
});

export default app;
