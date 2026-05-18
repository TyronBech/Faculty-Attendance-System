<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'flss_backend' => [
        'key' => env('FLSS_KEY'),
        'base_url' => env('FLSS_BASE_URL'),
        'faculty_schedules_url' => env(
            'FLSS_FACULTY_SCHEDULES_URL',
            'https://flss-backend-api-d9eecxcnhpccdpdk.southeastasia-01.azurewebsites.net/api/v1/faculty-schedules'
        ),
        'temporary_schedules_url' => env(
            'FLSS_TEMPORARY_SCHEDULES_URL',
            rtrim((string) env('FLSS_BASE_URL', 'https://flss-backend-api-d9eecxcnhpccdpdk.southeastasia-01.azurewebsites.net'), '/').'/api/v1/faculty-schedules/temporary'
        ),
        'rooms_url' => env(
            'FLSS_FACULTY_ROOMS_URL',
            'https://flss-backend-api-d9eecxcnhpccdpdk.southeastasia-01.azurewebsites.net/api/v1/rooms'
        ),
        'ca_bundle' => env('FLSS_CA_BUNDLE', env('SSL_CERT_FILE')),
        'skip_ssl_verification' => env('FLSS_SKIP_SSL_VERIFICATION', false),
    ],

];
