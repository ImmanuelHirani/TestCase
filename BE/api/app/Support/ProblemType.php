<?php

namespace App\Support;

/**
 * RFC 9457 (Problem Details for HTTP APIs) "type" URIs.
 *
 * RFC 9457 only requires these to be a stable identifier for the problem
 * category -- it does not require them to resolve to a fetchable document.
 * They are namespaced under one base so every error this API produces is
 * traceable to one place, the way Zalando's and Microsoft's guidelines both
 * expect a documented, closed set of error types rather than ad hoc strings.
 */
final class ProblemType
{
    private const BASE = 'https://api.jasindo.test/problems/';

    public const VALIDATION_ERROR = self::BASE.'validation-error';
    public const UNAUTHENTICATED = self::BASE.'unauthenticated';
    public const FORBIDDEN = self::BASE.'forbidden';
    public const NOT_FOUND = self::BASE.'not-found';
    public const METHOD_NOT_ALLOWED = self::BASE.'method-not-allowed';
    public const TOO_MANY_REQUESTS = self::BASE.'too-many-requests';
    public const UNSUPPORTED_PARAMETER = self::BASE.'unsupported-parameter';
    public const PRECONDITION_FAILED = self::BASE.'precondition-failed';
    public const DATABASE_ERROR = self::BASE.'database-error';
    public const SERVER_ERROR = self::BASE.'server-error';
}
