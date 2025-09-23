// server/index.ts
import { app } from "./app";

const envPort = process.env.PORT;
const port = Number.isInteger(Number(envPort)) ? Number(envPort) : 3000;

app.listen(port, "0.0.0.0", () => {
  const env = process.env.NODE_ENV || "development";
  if (envPort) {
    console.log(`✅ Server running on port ${port} (from process.env.PORT) — NODE_ENV=${env}`);
  } else {
    console.log(`✅ Server running on fallback port ${port} (no process.env.PORT set) — NODE_ENV=${env}`);
  }
});
