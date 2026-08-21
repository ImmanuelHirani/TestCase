<?php

namespace App\Exceptions;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Thrown when a client's `If-Match` header does not match the resource's
 * current ETag -- someone else changed the record between when this client
 * read it and when it tried to write, so the write is refused rather than
 * silently overwriting a change it never saw (a "lost update").
 */
class PreconditionFailedException extends HttpException
{
    public function __construct(string $currentETag)
    {
        parent::__construct(
            Response::HTTP_PRECONDITION_FAILED,
            'This record was changed by someone else since you loaded it. Reload and try again.',
            headers: ['ETag' => $currentETag],
        );
    }
}
