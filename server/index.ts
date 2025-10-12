// server/index.ts
import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(
    `[ChefSire] API listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`
  );
});
