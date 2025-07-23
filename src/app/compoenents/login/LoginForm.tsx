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
  console.log('KRATOS_URL', KRATOS_URL);
  console.log('RETURN_TO', RETURN_TO);
  const searchParams = useSearchParams();
  const [, setError] = useState("");

  // Always ensure flow exists, or redirect to create a new one
  useEffect(() => {
    const flow = searchParams.get("flow");
    const loginChallenge = searchParams.get("login_challenge");
    if (!loginChallenge) {
      setError("Missing login_challenge! You must start this flow from Hydra.");
      return;
    }
    if (!flow) {
      const returnUrl = `${RETURN_TO}?login_challenge=${encodeURIComponent(loginChallenge)}`;
      window.location.replace(`${KRATOS_URL}/self-service/login/browser?return_to=${encodeURIComponent(returnUrl)}`);
    }
  }, [searchParams]);

  // OIDC provider login (submits form to Kratos)
  const handleOidcLogin = (provider: string) => {
    const flow = searchParams.get("flow");
    if (!flow) {
      setError("No flow found. Please refresh the page.");
      return;
    }
    // Submit a form POST so that cookies are included and Kratos handles the OIDC redirect
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${KRATOS_URL}/self-service/login?flow=${flow}`;

    // Provider input
    const providerInput = document.createElement("input");
    providerInput.type = "hidden";
    providerInput.name = "provider";
    providerInput.value = provider.toLowerCase();
    form.appendChild(providerInput);

    document.body.appendChild(form);
    form.submit();
  };

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
              {/* Left Spacer */}
              <div className="basis-[20%] flex-shrink-0"></div>
              {/* Centered, left-aligned icon+text */}
              <div className="basis-[60%] flex items-center justify-start">
                <span className="flex items-center justify-center w-8 h-6">{p.icon}</span>
                <span className="ml-2">{`Sign in with ${p.provider}`}</span>
              </div>
              {/* Right Spacer */}
              <div className="basis-[20%] flex-shrink-0"></div>
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
