UPDATE "cards" SET "column_id" = 'applied' WHERE "column_id" = 'screening';
DELETE FROM "columns" WHERE "id" = 'screening';
