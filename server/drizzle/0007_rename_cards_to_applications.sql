ALTER TABLE cards RENAME TO applications;
ALTER TABLE comments RENAME COLUMN card_id TO application_id;
