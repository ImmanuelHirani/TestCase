<?php

return [
    /*
     * A dedicated secret rather than APP_KEY: token signing and session
     * encryption are different concerns and should be able to rotate
     * independently without invalidating each other.
     */
    'secret' => env('JWT_SECRET'),

    'ttl_minutes' => (int) env('JWT_TTL_MINUTES', 240),

    'cookie_name' => env('JWT_COOKIE_NAME', 'jasindo_token'),

    'algo' => 'HS256',
];
