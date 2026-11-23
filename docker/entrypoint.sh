#!/bin/sh
set -e

cd /var/www/html

echo "Starting Table Tally POS container..."

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add it in Railway → Variables."
    exit 1
fi

php artisan config:clear

echo "Running migrations..."
if ! php artisan migrate --force --no-interaction; then
    echo "ERROR: Migrations failed. Check DB_* variables and Neon connectivity."
    exit 1
fi

php artisan config:cache
php artisan view:cache

# Do not run route:cache — web.php uses closure routes (Inertia), which breaks route:cache.

PORT="${PORT:-8080}"
echo "Listening on 0.0.0.0:${PORT}..."
exec php artisan serve --host=0.0.0.0 --port="$PORT"