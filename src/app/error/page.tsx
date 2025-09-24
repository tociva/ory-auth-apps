export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Suspense } from 'react';
import ErrorClient from './ErrorClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading error details…</div>}>
      <ErrorClient />
    </Suspense>
  );
}
