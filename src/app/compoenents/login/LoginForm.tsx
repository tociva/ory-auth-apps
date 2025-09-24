'use client';

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import GoogleIcon from "../icons/GoogleIcon";
import AppleIcon from "./AppleIcon";
import FacebookIcon from "./FacebookIcon";
import GitHubIcon from "./GitHubIcon";
import LinkedInIcon from "./LinkedInIcon";
import TwitterIcon from "./TwitterIcon";

const PROVIDERS = [
  { provider: 'Google', icon: <GoogleIcon className="h-6 w-6" />, text: 'text-primary' },
  { provider: 'Apple', icon: <AppleIcon className="h-6 w-6" />, text: 'text-primary' },
  { provider: 'Facebook', icon: <FacebookIcon className="h-6 w-6" />, text: 'text-primary' },
  { provider: 'Twitter', icon: <TwitterIcon className="h-6 w-6" />, text: 'text-primary' },
  { provider: 'LinkedIn', icon: <LinkedInIcon className="h-6 w-6" />, text: 'text-primary' },
  { provider: 'GitHub', icon: <GitHubIcon className="h-6 w-6" />, text: 'text-primary' },
];

const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL;
const RETURN_TO = process.env.NEXT_PUBLIC_KRATOS_RETURN_TO;

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [flowReady, setFlowReady] = useState(false);

  useEffect(() => {
    const flow = searchParams.get("flow");
    const loginChallenge = searchParams.get("login_challenge");

    if (!flow) {
      const returnTo = loginChallenge
        ? `${RETURN_TO}?login_challenge=${encodeURIComponent(loginChallenge)}`
        : RETURN_TO;

      window.location.replace(`${KRATOS_URL}/self-service/login/browser?return_to=${encodeURIComponent(returnTo ?? '')}`);
    } else {
      setFlowReady(true);
      setLoading(false);
    }
  }, [searchParams]);

  const handleOidcLogin = (provider: string) => {
    const flow = searchParams.get("flow");
    if (!flow) {
      setError("No flow found. Please refresh the page.");
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${KRATOS_URL}/self-service/login?flow=${flow}`;

    const providerInput = document.createElement("input");
    providerInput.type = "hidden";
    providerInput.name = "provider";
    providerInput.value = provider.toLowerCase();
    form.appendChild(providerInput);

    document.body.appendChild(form);
    form.submit();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="flex justify-center mb-4">
          <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Checking session...</h1>
        <p className="text-sm text-gray-500">Preparing secure login flow, please wait.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl mb-4">
          {error}
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Home
        </button>
      </div>
    );
  }

  if (!flowReady) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-white">
      <div className="w-full max-w-md rounded-2xl shadow-xl bg-white p-8">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-[#367588] mb-1">Daybook.Cloud</h1>
        </div>
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.provider}
              className={`
                w-full py-3 rounded-xl
                bg-white ${p.text}
                border-[#367588] hover:bg-[#367588]
                hover:text-white
                font-medium shadow-sm transition cursor-pointer border
                flex items-center
                transition-all duration-200
              `}
              style={{ borderWidth: 2 }}
              onClick={() => handleOidcLogin(p.provider)}
              type="button"
            >
              <div className="basis-[20%] flex-shrink-0" />
              <div className="basis-[60%] flex items-center justify-start">
                <span className="flex items-center justify-center w-8 h-6">{p.icon}</span>
                <span className="ml-2">{`Sign in with ${p.provider}`}</span>
              </div>
              <div className="basis-[20%] flex-shrink-0" />
            </button>
          ))}
        </div>
        <div className="text-center text-sm text-gray-400 mt-6">
          By signing in, you agree to our
          <a href="/terms" className="text-primary underline mx-1 hover:text-primary/70">Terms &amp; Conditions</a>
          and
          <a href="/privacy" className="text-primary underline mx-1 hover:text-primary/70">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
