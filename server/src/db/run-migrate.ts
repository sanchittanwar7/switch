import { runMigrations } from "./migrate.js";
import { seedColumns } from "./seed.js";

async function main() {
  await runMigrations();
  await seedColumns();
  console.log("Migrations complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
