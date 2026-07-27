import { db } from "./index.js";
import { columns } from "./schema.js";

const DEFAULT_COLUMNS = [
  { id: "wishlist", title: "Wishlist", position: 0 },
  { id: "applied", title: "Applied", position: 1 },
  { id: "screening", title: "Screening", position: 2 },
  { id: "interview", title: "Interview", position: 3 },
  { id: "offer", title: "Offer", position: 4 },
  { id: "accepted", title: "Accepted", position: 5 },
  { id: "rejected", title: "Rejected", position: 6 },
];

export async function seedColumns(): Promise<void> {
  for (const col of DEFAULT_COLUMNS) {
    await db
      .insert(columns)
      .values(col)
      .onConflictDoNothing({ target: columns.id });
  }
}
