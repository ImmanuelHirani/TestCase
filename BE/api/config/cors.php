<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
     * Allowlist, not '*'. Only the host shell and the two microfrontends --
     * each of which is served from its own origin -- may call this API.
     */
    'allowed_origins' => [
        'http://localhost:5000',
        'http://localhost:5001',
        'http://localhost:5002',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    /*
     * Required for the JWT cookie to travel at all: without this the browser
     * strips the Cookie header from cross-origin requests (host and each
     * microfrontend are each their own origin) regardless of what the
     * frontend's axios/fetch call asks for. This is also why 'allowed_origins'
     * above must be an explicit list -- the spec forbids '*' together with
     * credentials, and the browser will reject the response if it sees both.
     */
    'supports_credentials' => true,

];
