import '../index.css';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ApiError,
  apiClient,
  AuthResponseSchema,
  Button,
  Card,
  Icon,
  LoginPayloadSchema,
  parseApiResponse,
  TextField,
  useSetSession,
} from '@jasindo/shared';
import type { AuthUser, LoginPayload } from '@jasindo/shared';

interface LoginPageProps {
  /** Called after a successful login. The host uses it to navigate. */
  onSuccess?: (user: AuthUser) => void;
}

async function login(payload: LoginPayload): Promise<AuthUser> {
  const { data } = await apiClient.post('/login', payload);
  return parseApiResponse(AuthResponseSchema, data).user;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const setSession = useSetSession();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginPayload>({
    resolver: zodResolver(LoginPayloadSchema),
    // 'onChange': every keystroke re-validates, so a field's error clears the
    // moment it becomes valid rather than waiting for the next submit.
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      setSession(user);
      onSuccess?.(user);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        // The server's 422 is the authority on "these credentials are
        // wrong" -- mapped onto the same field react-hook-form already
        // tracks, so it renders through the identical error UI as a client
        // rule would.
        setError('email', { type: 'server', message: err.fieldError('email') ?? err.message });
        return;
      }
    },
  });

  const topLevelError =
    mutation.error instanceof ApiError && !mutation.error.isValidation ? mutation.error : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-lowest px-4 py-10">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.05, 0.7, 0.1, 1] }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary-container">
            <Icon name="shield_person" size={40} className="text-on-primary-container" filled />
          </div>
          <h1 className="md-headline-medium text-on-surface">Sign in</h1>
          <p className="md-body-medium mt-1 text-on-surface-variant">Jasindo user management</p>
        </motion.div>

        <Card variant="elevated" className="p-6">
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-5">
            <AnimatePresence initial={false}>
              {topLevelError && (
                <motion.div
                  key="login-error"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div role="alert" className="flex items-start gap-3 rounded-xs bg-error-container px-4 py-3">
                    <Icon name="error" size={20} className="mt-0.5 shrink-0 text-on-error-container" />
                    <p className="md-body-medium text-on-error-container">{topLevelError.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              leadingIcon="mail"
              error={errors.email?.message}
              {...register('email')}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              leadingIcon="lock"
              error={errors.password?.message}
              {...register('password')}
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="md-state-layer -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant [--md-state-color:var(--md-sys-color-on-surface-variant)]"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              }
            />

            <Button type="submit" variant="filled" fullWidth disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <Card variant="filled" className="mt-4 px-4 py-3">
          <p className="md-label-medium text-on-surface-variant">Demo accounts</p>
          <p className="md-body-small mt-1 text-on-surface-variant">
            admin@jasindo.test · user@jasindo.test — password: <code>password</code>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
