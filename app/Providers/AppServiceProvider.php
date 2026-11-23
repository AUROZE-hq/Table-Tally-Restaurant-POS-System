<?php

namespace App\Providers;

use App\Database\Connectors\NeonPostgresConnector;
use App\Database\NeonPostgresConnection;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind('db.connector.pgsql', NeonPostgresConnector::class);

        Connection::resolverFor('pgsql', function ($connection, $database, $prefix, $config) {
            return new NeonPostgresConnection($connection, $database, $prefix, $config);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        DB::beforeExecuting(function ($query, &$bindings) {
            foreach ($bindings as $key => $value) {
                if (is_bool($value)) {
                    $bindings[$key] = $value ? 'true' : 'false';
                }
            }
        });

        $appUrl = (string) config('app.url');

        if (
            $this->app->environment('production')
            || str_starts_with($appUrl, 'https://')
            || filter_var(env('FORCE_HTTPS', false), FILTER_VALIDATE_BOOL)
        ) {
            URL::forceScheme('https');

            if ($appUrl !== '') {
                URL::forceRootUrl($appUrl);
            }
        }
    }
}
