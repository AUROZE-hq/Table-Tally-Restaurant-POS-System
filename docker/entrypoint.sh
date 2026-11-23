#!/bin/sh
set -e

cd /var/www/html

echo "Starting Table Tally POS container..."

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add it in Railway → Variables."
    exit 1
fi

php artisan config:clear

# Neon: migrations must use the direct (non-pooler) host. The pooled URL's
# SNI is `ep-…-pooler` while PHP also sends `endpoint=ep-…`, and Neon rejects
# that mismatch. The app keeps using DB_URL (pooled) after migrate.
if [ -n "${DIRECT_URL:-}" ]; then
    echo "Running migrations against DIRECT_URL..."
    if ! DB_URL="$DIRECT_URL" php artisan migrate --force --no-interaction; then
        echo "ERROR: Migrations failed. Check DIRECT_URL (Neon direct connection string, not the -pooler host)."
        exit 1
    fi
else
    echo "Running migrations..."
    if ! php artisan migrate --force --no-interaction; then
        echo "ERROR: Migrations failed. Set DIRECT_URL to the Neon direct URL, and DB_URL to the pooled URL."
        exit 1
    fi
fi

php artisan config:cache
php artisan view:cache

# Do not run route:cache — web.php uses closure routes (Inertia), which breaks route:cache.

PORT="${PORT:-8080}"
echo "Listening on 0.0.0.0:${PORT}..."
exec php artisan serve --host=0.0.0.0 --port="$PORT"