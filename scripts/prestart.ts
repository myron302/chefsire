import { execSync } from "node:child_process";

const commands = [
  "npm run generate:drink-index",
  "npm run generate:pet-food-index",
];

for (const command of commands) {
  console.log(`\n▶ Running: ${command}`);
  execSync(command, { stdio: "inherit" });
}
