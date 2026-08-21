<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Thrown when a request supplies a parameter the endpoint does not recognise,
 * whether it arrived in the JSON body or the query string.
 *
 * Microsoft's Azure API guidelines (MUST): "DO return an error if the client
 * specifies any parameter not supported." Silently ignoring an unknown
 * parameter means a typo like `{"sort": "name", "drection": "desc"}` fails
 * quietly -- the client believes it asked for descending order and gets
 * ascending, with nothing in the response to say why.
 */
class UnsupportedQueryParameterException extends BadRequestHttpException
{
    /**
     * @param  string[]  $parameters  The unrecognised parameter names.
     */
    public function __construct(array $parameters)
    {
        $list = implode(', ', $parameters);
        $plural = count($parameters) > 1 ? 's' : '';

        parent::__construct("Unsupported parameter{$plural}: {$list}.");
    }
}
