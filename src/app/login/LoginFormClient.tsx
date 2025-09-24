'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginForm from '../components/login/LoginForm';

export default function LoginFormClient() {
  const sp = useSearchParams();

  // Read plain values and pass them down as props
  const flow = useMemo(() => sp.get('flow'), [sp]);
  const loginChallenge = useMemo(() => sp.get('login_challenge'), [sp]);
  const returnTo = useMemo(() => sp.get('return_to') ?? '/', [sp]);
  const loginHint = useMemo(() => sp.get('login_hint') ?? '', [sp]);

  return (
    <LoginForm
      flow={flow ?? null}
      loginChallenge={loginChallenge ?? null}
      returnTo={returnTo}
      loginHint={loginHint}
    />
  );
}
