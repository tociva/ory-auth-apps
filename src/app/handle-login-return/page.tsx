export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Suspense } from 'react';
import HandleLoginReturnClient from './HandleLoginReturnClient';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Authenticating…</h1>
          <p className="text-sm text-gray-500">Preparing your session…</p>
        </div>
      </div>
    }>
      <HandleLoginReturnClient />
    </Suspense>
  );
}
