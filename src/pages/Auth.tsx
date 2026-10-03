import { useState, type FormEvent } from 'react';
import { Compass, Mail } from 'lucide-react';
import { Button, Card, Field, Input, useToast } from '@/components/ui';
import { useAuth } from '@/services/AuthProvider';
import {
  resendConfirmation,
  sendPasswordReset,
  signIn,
  signUp,
  updatePassword,
} from '@/services/auth';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sign in / sign up / forgot / reset.
//
// The palette is the app's own: ivory surface, warm border, ink brand button.
// No blue, no gradient, no third-party "SaaS" look.
// ---------------------------------------------------------------------------

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const COPY: Record<Mode, { title: string; blurb: string; cta: string }> = {
  signin: {
    title: 'Welcome back',
    blurb: 'Sign in to pick up your preparation where you left off.',
    cta: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    blurb: 'Your subjects, DSA problems and applications stay private to you.',
    cta: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    blurb: 'We will email you a link to choose a new one.',
    cta: 'Send reset link',
  },
  reset: {
    title: 'Choose a new password',
    blurb: 'Pick something you have not used here before.',
    cta: 'Update password',
  },
};

export default function Auth() {
  const { recoveryMode, exitRecoveryMode } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(recoveryMode ? 'reset' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const effectiveMode: Mode = recoveryMode ? 'reset' : mode;
  const copy = COPY[effectiveMode];

  const switchMode = (next: Mode) => {
    if (recoveryMode) return;
    setMode(next);
    setSent(false);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (effectiveMode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) toast.push(error.message, { tone: 'error' });
      } else if (effectiveMode === 'signup') {
        if (password.length < 8) {
          toast.push('Use at least 8 characters for your password.', { tone: 'error' });
          return;
        }
        const { error, needsEmailConfirmation } = await signUp(email, password);
        if (error) toast.push(error.message, { tone: 'error' });
        else if (needsEmailConfirmation) {
          setSent(true);
          toast.push('Check your inbox to confirm your email.', { tone: 'success' });
        }
      } else if (effectiveMode === 'forgot') {
        const error = await sendPasswordReset(email);
        if (error) toast.push(error.message, { tone: 'error' });
        else {
          setSent(true);
          toast.push('Reset link sent. Check your inbox.', { tone: 'success' });
        }
      } else {
        if (password.length < 8) {
          toast.push('Use at least 8 characters for your password.', { tone: 'error' });
          return;
        }
        const error = await updatePassword(password);
        if (error) toast.push(error.message, { tone: 'error' });
        else {
          exitRecoveryMode();
          toast.push('Password updated.', { tone: 'success' });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const needsEmail = effectiveMode !== 'reset';

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface-raised shadow-card">
            <Compass size={19} className="text-brand" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-content">Dayflow</h1>
          <p className="mt-1 text-sm text-content-muted">{copy.blurb}</p>
        </div>

        <Card className="p-5">
          {effectiveMode !== 'reset' && (
            <div className="mb-5 flex rounded-xl border border-border bg-surface-muted p-0.5" role="tablist">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'flex-1 rounded-[10px] px-3 py-1.5 text-xs font-medium transition',
                    mode === m ? 'bg-surface-raised text-content shadow-card' : 'text-content-muted hover:text-content',
                  )}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
            <h2 className="sr-only">{copy.title}</h2>

            {needsEmail && (
              <Field label="Email">
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
            )}

            {effectiveMode !== 'forgot' && (
              <Field
                label={effectiveMode === 'signup' ? 'Password' : 'Your password'}
                hint={effectiveMode === 'signup' ? 'At least 8 characters' : undefined}
              >
                <Input
                  type="password"
                  name="password"
                  autoComplete={effectiveMode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            )}

            <Button
              type="submit"
              variant="primary"
              className="mt-1 w-full justify-center"
              disabled={busy || (needsEmail && !email.trim())}
            >
              {busy ? 'Working…' : copy.cta}
            </Button>
          </form>

          {sent && effectiveMode === 'signup' && (
            <p className="mt-4 rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-content-muted">
              We sent a confirmation link to <span className="text-content">{email}</span>. Confirm your address, then
              sign in.
              <button
                type="button"
                onClick={async () => {
                  const error = await resendConfirmation(email);
                  if (error) toast.push(error.message, { tone: 'error' });
                  else toast.push('Confirmation email sent again.', { tone: 'success' });
                }}
                className="ml-1 font-medium text-content underline underline-offset-2"
              >
                Resend
              </button>
            </p>
          )}
        </Card>

        {!recoveryMode && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-content-muted">
            {effectiveMode !== 'forgot' && (
              <button type="button" onClick={() => switchMode('forgot')} className="hover:text-content">
                Forgot password?
              </button>
            )}
            {effectiveMode === 'forgot' && (
              <button type="button" onClick={() => switchMode('signin')} className="hover:text-content">
                Back to sign in
              </button>
            )}
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-content-faint">
          <Mail size={13} aria-hidden />
          Your data is private to your account.
        </p>
      </div>
    </div>
  );
}
