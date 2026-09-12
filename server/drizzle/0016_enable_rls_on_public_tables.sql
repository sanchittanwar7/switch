-- Enable Row Level Security on every table in the public schema.
-- The application accesses data exclusively through the backend server (direct
-- Postgres connection), never through PostgREST / the Data API. So no policies
-- are created: `anon` and `authenticated` get zero row access via the API.

ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "__drizzle_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_experiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_payments" ENABLE ROW LEVEL SECURITY;
