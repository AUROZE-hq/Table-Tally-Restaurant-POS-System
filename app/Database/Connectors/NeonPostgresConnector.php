<?php

namespace App\Database\Connectors;

use Illuminate\Database\Connectors\PostgresConnector;

class NeonPostgresConnector extends PostgresConnector
{
    protected function addSslOptions($dsn, array $config)
    {
        $dsn = parent::addSslOptions($dsn, $config);

        $endpoint = $config['neon_endpoint'] ?? $this->resolveNeonEndpoint($config);

        if (! empty($endpoint)) {
            $dsn .= ';options=endpoint='.$endpoint;
        }

        // channel_binding in Neon URLs is not supported by PHP PDO/libpq on all platforms.
        return $dsn;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    protected function resolveNeonEndpoint(array $config): ?string
    {
        $host = $config['host'] ?? null;

        if (! is_string($host) || $host === '') {
            return null;
        }

        if (preg_match('/^(ep-.+?)-pooler\./', $host, $matches)) {
            return $matches[1];
        }

        if (preg_match('/^(ep-[^.]+)\./', $host, $matches)) {
            return str_replace('-pooler', '', $matches[1]);
        }

        return null;
    }
}