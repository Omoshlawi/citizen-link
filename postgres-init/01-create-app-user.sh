#!/bin/bash
# Runs once on first volume initialization (empty data dir).
# Subsequent credential changes are handled by the db-setup service.
set -e

psql -v ON_ERROR_STOP=1 --username "postgres" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
      CREATE USER "${APP_DB_USER}" WITH PASSWORD '${APP_DB_PASSWORD}';
    ELSE
      ALTER USER "${APP_DB_USER}" WITH PASSWORD '${APP_DB_PASSWORD}';
    END IF;
  END
  \$\$;

  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB}" TO "${APP_DB_USER}";
  GRANT ALL ON SCHEMA public TO "${APP_DB_USER}";
  ALTER DATABASE "${POSTGRES_DB}" OWNER TO "${APP_DB_USER}";
EOSQL

echo "App user '${APP_DB_USER}' configured on database '${POSTGRES_DB}'."
