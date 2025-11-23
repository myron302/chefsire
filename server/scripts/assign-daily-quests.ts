// server/scripts/assign-daily-quests.ts
import { assignDailyQuestsToAllUsers } from "../services/quests.service";

(async () => {
  try {
    const count = await assignDailyQuestsToAllUsers();
    console.log(`✅ Assigned daily quests to ${count} users`);
  } catch (err) {
    console.error("❌ Failed assigning daily quests:", err);
    process.exitCode = 1;
  }
})();
