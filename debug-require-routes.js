// Quick diagnostic: attempt to require the routes module and print any error stack.
// Run: node debug-require-routes.js (from project root)
try {
  console.log("cwd:", process.cwd());
  console.log("node version:", process.version);
  const mod = require("./server/routes");
  console.log("routes loaded OK. export keys:", Object.keys(mod || {}));
  if (mod && mod.default) {
    console.log("default export type:", typeof mod.default);
  }
  process.exit(0);
} catch (err) {
  console.error("REQUIRE FAILED:");
  if (err && err.stack) console.error(err.stack);
  else console.error(String(err));
  process.exit(1);
}
