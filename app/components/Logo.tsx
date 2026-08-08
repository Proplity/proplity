export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="40" height="40" rx="8" className="fill-blue-600" />
        <path d="M12 28V16L20 10L28 16V28H24V20H16V28H12Z" className="fill-white" />
        <circle cx="30" cy="12" r="6" className="fill-green-500" />
        <path
          d="M28 12L29.5 13.5L32 11"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight">Proplity</span>
        <span className="text-xs text-gray-500">AI-Powered Property Management</span>
      </div>
    </div>
  );
}

export function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" className="fill-blue-600" />
      <path d="M12 28V16L20 10L28 16V28H24V20H16V28H12Z" className="fill-white" />
      <circle cx="30" cy="12" r="6" className="fill-green-500" />
      <path
        d="M28 12L29.5 13.5L32 11"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
