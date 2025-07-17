
export default function LinkedInIcon({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
    return (
      <svg width={22} height={22} viewBox="0 0 32 32" fill="#0077b5" className={className} {...props}>
        <path d="M27 0h-22c-2.8 0-5 2.2-5 5v22c0 2.8 2.2 5 5 5h22c2.8 0 5-2.2 5-5v-22c0-2.8-2.2-5-5-5zm-15.7 27h-4v-11h4v11zm-2-12.3c-1.3 0-2.3-1.1-2.3-2.3 0-1.3 1.1-2.3 2.3-2.3s2.3 1.1 2.3 2.3c0 1.2-1 2.3-2.3 2.3zm18.7 12.3h-4v-5.6c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8v5.7h-4v-11h3.8v1.5h.1c0.5-0.9 1.7-1.8 3.4-1.8 3.7 0 4.3 2.4 4.3 5.6v5.7z"/>
      </svg>
    );
  }
  