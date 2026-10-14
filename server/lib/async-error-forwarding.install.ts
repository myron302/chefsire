// Side-effect entry: `import "./lib/async-error-forwarding.install"` BEFORE anything that registers routes (server/index.ts, server/app.ts).
import { installAsyncErrorForwarding } from "./async-error-forwarding";

installAsyncErrorForwarding();
