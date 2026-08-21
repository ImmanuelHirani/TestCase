-- Run once as the postgres superuser:
--   psql -U postgres -f docs/setup-database.sql
--
-- Creates a dedicated application role instead of letting the app connect as
-- a superuser. If the app is ever compromised it cannot touch anything outside
-- its own database.

CREATE ROLE jasindo WITH LOGIN PASSWORD 'jasindo_local_dev';

CREATE DATABASE jasindo_test OWNER jasindo;

-- Separate database for `php artisan test`, so running the suite never wipes
-- the data being used for the demo.
CREATE DATABASE jasindo_test_testing OWNER jasindo;

-- Laravel's migrations create every table, so ownership of the schema is enough.
\connect jasindo_test
GRANT ALL ON SCHEMA public TO jasindo;
ALTER SCHEMA public OWNER TO jasindo;

\connect jasindo_test_testing
GRANT ALL ON SCHEMA public TO jasindo;
ALTER SCHEMA public OWNER TO jasindo;
