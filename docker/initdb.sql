-- Runs once, on the first start of an empty volume (docker-entrypoint-initdb.d).
-- Tests use their own database so they never touch development data.
CREATE DATABASE enmirumbo_test OWNER enmirumbo;
