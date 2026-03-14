import { execSync } from "node:child_process";

const commands = [
  "npm run clean:assets",
  "npm run generate:drink-index",
  "npm run generate:pet-food-index",
  "npm run build:client",
  "npm run build:server",
];

for (const command of commands) {
  console.log(`\n▶ Running: ${command}`);
  execSync(command, { stdio: "inherit" });
}
