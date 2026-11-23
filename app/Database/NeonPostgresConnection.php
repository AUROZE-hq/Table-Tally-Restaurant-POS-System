<?php

namespace App\Database;

use DateTimeInterface;
use Illuminate\Database\PostgresConnection;

class NeonPostgresConnection extends PostgresConnection
{
    /**
     * Keep booleans as PostgreSQL literals.
     *
     * Emulated prepares (required by Neon’s pooler) would otherwise inline true/false as 1/0,
     * and PostgreSQL rejects "boolean = integer".
     */
    public function prepareBindings(array $bindings)
    {
        $grammar = $this->getQueryGrammar();

        foreach ($bindings as $key => $value) {
            if ($value instanceof DateTimeInterface) {
                $bindings[$key] = $value->format($grammar->getDateFormat());
            } elseif (is_bool($value)) {
                $bindings[$key] = $value ? 'true' : 'false';
            }
        }

        return $bindings;
    }
}
