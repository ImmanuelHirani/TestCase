<?php

namespace App\Support;

use App\Models\User;

/**
 * Weak ETags derived from the public uuid + updated_at.
 *
 * "Weak" (the `W/` prefix) because this doesn't guarantee byte-for-byte
 * representation equality, only "same version of this row" -- good enough
 * for the optimistic-concurrency check on update, which is all this is
 * used for.
 *
 * Built from `uuid` rather than the numeric primary key on purpose: the ETag
 * travels to the client in a response header, so composing it from the
 * internal id would leak exactly the value UserResource is careful not to
 * serialise.
 */
final class ETag
{
    public static function forUser(User $user): string
    {
        return 'W/"'.$user->uuid.'-'.$user->updated_at->timestamp.'"';
    }
}
