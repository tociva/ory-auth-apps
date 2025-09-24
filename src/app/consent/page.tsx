export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Suspense } from 'react';
import ConsentClient from './ConsentClient';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <div className="flex justify-center mb-4">
          <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Processing consent…</h1>
        <p className="text-sm text-gray-500">Please wait.</p>
      </div>
    }>
      <ConsentClient />
    </Suspense>
  );
}
