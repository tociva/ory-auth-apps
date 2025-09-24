export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Suspense } from 'react';
import LogoutClient from './LogoutClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Logging out…</div>}>
      <LogoutClient />
    </Suspense>
  );
}
