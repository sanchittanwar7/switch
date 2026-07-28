import { db } from "./index";
import { columns } from "./schema";

const DEFAULT_COLUMNS = [
  { id: "wishlist", title: "Wishlist", position: 0 },
  { id: "applied", title: "Applied", position: 1 },
  { id: "interview", title: "Interview", position: 2 },
  { id: "offer", title: "Offer", position: 3 },
  { id: "accepted", title: "Accepted", position: 4 },
  { id: "rejected", title: "Rejected", position: 5 },
];

export async function seedColumns(): Promise<void> {
  for (const col of DEFAULT_COLUMNS) {
    await db
      .insert(columns)
      .values(col)
      .onConflictDoNothing({ target: columns.id });
  }
}
