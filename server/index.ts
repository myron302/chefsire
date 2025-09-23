// server/index.ts
import { app } from "./app";

const envPort = process.env.PORT;
const port = parseInt(envPort || "3000", 10);

app.listen(port, "0.0.0.0", () => {
  if (envPort) {
    console.log(`✅ Server running on port ${port} (from process.env.PORT)`);
  } else {
    console.log(`✅ Server running on fallback port ${port} (no process.env.PORT set)`);
  }
});
