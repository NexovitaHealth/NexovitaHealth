export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#028090] flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4v4m0 8v4M4 12h4m8 0h4"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="3" fill="white" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Nexovita
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
            Clinical Management Platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
