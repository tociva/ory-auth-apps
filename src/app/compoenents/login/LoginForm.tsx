'use client';

import GoogleIcon from "../icons/GoogleIcon";
import LinkedInIcon from "./LinkedInIcon";
import TwitterIcon from "./TwitterIcon";
import FacebookIcon from "./FacebookIcon";
import GitHubIcon from "./GitHubIcon";
import AppleIcon from "./AppleIcon";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const PROVIDERS = [
  {
    provider: 'Google',
    icon: <GoogleIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
  {
    provider: 'Apple',
    icon: <AppleIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
  {
    provider: 'Facebook',
    icon: <FacebookIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
  {
    provider: 'Twitter',
    icon: <TwitterIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
  {
    provider: 'LinkedIn',
    icon: <LinkedInIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
  {
    provider: 'GitHub',
    icon: <GitHubIcon className="h-6 w-6" />,
    text: 'text-primary',
  },
];

const KRATOS_URL = process.env.KRATOS_URL ?? "http://localhost:4433";


export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

 
  const [error, setError] = useState("");

  useEffect(() => {
    const flow = searchParams.get("flow");
    const returnUrl = searchParams.get("return_url") || window.location.origin;

    if (!flow) {
      // Use Kratos API endpoint for custom UI
      fetch(`${KRATOS_URL}/self-service/login/api`, {
        method: "GET",
        credentials: "include"
      })
        .then(async res => {
          // If CORS fails, this block will NOT run! See catch() below.
          if (!res.ok) {
            let errMsg = `Failed to create login flow. Status: ${res.status}`;
            try {
              const data = await res.json();
              if (data.error && data.error.reason) {
                errMsg = data.error.reason;
              }
            } catch (e) {}
            setError(errMsg);
            return;
          }
          const data = await res.json();
          if (data.id) {
            router.replace(`/login?flow=${data.id}&return_url=${encodeURIComponent(returnUrl)}`);
          } else {
            setError("No flow id returned from Kratos API.");
          }
        })
        .catch((e) => {
          // Most likely a CORS/network error if you land here
          setError(
            "Failed to connect to Ory Kratos API. " +
            "This is likely a CORS or network issue. " +
            "Please check Kratos config for allowed origins (CORS settings) " +
            "and make sure your Kratos instance is running and accessible. " +
            `\n\nError details: ${e && e.message ? e.message : e.toString()}`
          );
        });
    }
  }, [searchParams, router]);

  const handleOidcLogin = (provider: string) => {
    const flow = searchParams.get("flow");
    if (!flow) {
      setError("No flow found. Please refresh the page.");
      return;
    }
  
    // Prepare the form data string
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${KRATOS_URL}/self-service/login?flow=${flow}`;
  
    // Provider field
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
