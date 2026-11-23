<?php

namespace App\Providers;

use App\Database\Connectors\NeonPostgresConnector;
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
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
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
