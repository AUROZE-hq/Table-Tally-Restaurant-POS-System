# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js tsconfig.json ./
COPY resources ./resources
COPY public ./public

ARG VITE_APP_NAME="Table Tally POS"
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build

FROM php:8.3-cli-bookworm AS app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip git \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader

COPY . .
COPY --from=frontend /app/public/build ./public/build

ENV APP_KEY=base64:QnVpbGRUaW1lS2V5T25seS1Vc2VSZWFsS2V5T25Sb2sAAAAAAAAAAAA=

RUN composer dump-autoload --optimize --no-interaction \
    && php artisan package:discover --ansi \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV APP_ENV=production \
    LOG_CHANNEL=stderr

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]