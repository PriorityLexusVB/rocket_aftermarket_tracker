-- Ensure pgcrypto is available before running data migrations that rely on
-- crypt()/gen_salt()/gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;
