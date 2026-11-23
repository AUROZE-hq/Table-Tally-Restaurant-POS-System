#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ]; then
    echo "ERROR: APP_KEY is not set. Add it in Railway Variables."
    exit 1
fi

php artisan config:clear
php artisan migrate --force --no-interaction
php artisan config:cache
php artisan route:cache
php artisan view:cache

PORT="${PORT:-8080}"
exec php artisan serve --host=0.0.0.0 --port="$PORT"