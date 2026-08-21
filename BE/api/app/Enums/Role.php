<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    case User = 'user';

    /** Values accepted by the `in:` validation rule. */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
