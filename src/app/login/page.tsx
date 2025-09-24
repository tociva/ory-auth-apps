export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Suspense } from 'react';
import LoginFormClient from './LoginFormClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading login…</div>}>
      <LoginFormClient />
    </Suspense>
  );
}
