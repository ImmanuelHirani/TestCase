import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  Button,
  Dialog,
  Icon,
  SelectField,
  TextField,
  UserPayloadSchema,
  UserUpdatePayloadSchema,
} from '@jasindo/shared';
import type { User, UserPayload } from '@jasindo/shared';

interface UserFormModalProps {
  user: User | null;
  submitting: boolean;
  error: ApiError | null;
  onSubmit: (payload: UserPayload) => void;
  onCancel: () => void;
}

/**
 * Live validation: mode 'onChange' re-runs the Zod schema on every keystroke,
 * so an error clears the moment the field becomes valid rather than waiting
 * for the next submit attempt. The schema is the exact one usersApi.ts sends
 * as the request body -- see dto/user.ts -- so there is no separate list of
 * "form rules" that could drift from what the server actually requires.
 */
export function UserFormModal({ user, submitting, error, onSubmit, onCancel }: UserFormModalProps) {
  const isEdit = user !== null;
  const formId = 'user-form';
  const schema = isEdit ? UserUpdatePayloadSchema : UserPayloadSchema;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UserPayload>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'user',
      department: user?.department ?? '',
      phone: user?.phone ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    // The server is still the authority on uniqueness (email taken) and
    // anything else that needs a database round trip to know -- client
    // validation only catches shape, so per-field 422s still have to be
    // mapped in after the fact.
    onSubmit(values);
  });

  // Server-side per-field errors (422) surface through the same error prop
  // components already read for client errors. This runs as an effect, not
  // during render: calling RHF's setError while rendering is a side effect
  // outside React's model and misbehaves under Strict Mode's double-invoke.
  useEffect(() => {
    if (!error?.isValidation) return;

    for (const field of ['name', 'email', 'password', 'role', 'department', 'phone'] as const) {
      const message = error.fieldError(field);
      if (message) {
        setError(field, { type: 'server', message });
      }
    }
  }, [error, setError]);

  return (
    <Dialog
      headline={isEdit ? 'Edit user' : 'Add user'}
      onClose={onCancel}
      actions={
        <>
          <Button variant="text" onClick={onCancel}>
            Cancel
          </Button>
          {/* M3 dialog actions are text buttons -- the dialog itself already has
              the user's full attention, so a filled button adds emphasis that
              competes with the primary action on the page behind it. */}
          <Button type="submit" form={formId} variant="text" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        {error && !error.isValidation && (
          <div role="alert" className="flex items-start gap-3 rounded-xs bg-error-container px-4 py-3">
            <Icon name="error" size={20} className="mt-0.5 shrink-0 text-on-error-container" />
            <p className="md-body-medium text-on-error-container">{error.message}</p>
          </div>
        )}

        <TextField label="Name" type="text" error={errors.name?.message} {...register('name')} />

        <TextField label="Email" type="email" error={errors.email?.message} {...register('email')} />

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          supportingText={isEdit ? 'Leave blank to keep the current password' : 'At least 8 characters'}
          {...register('password')}
        />

        <SelectField label="Role" error={errors.role?.message} {...register('role')}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </SelectField>

        <TextField label="Department" type="text" error={errors.department?.message} {...register('department')} />

        <TextField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      </form>
    </Dialog>
  );
}
