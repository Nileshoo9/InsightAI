import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Shield, Zap, Globe } from "lucide-react";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen">
      {/* Left branding panel — hidden on mobile */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-purple-700 via-brand-700 to-brand-600 lg:flex">
        {/* Floating orbs */}
        <div className="absolute right-12 top-16 h-28 w-28 rounded-full bg-white/10 blur-xl animate-float" />
        <div className="absolute bottom-20 left-20 h-20 w-20 rounded-full bg-white/10 blur-lg animate-float animate-delay-200" />
        <div className="absolute left-1/3 top-2/3 h-12 w-12 rounded-full bg-cyan-400/20 blur-md animate-bounce-subtle animate-delay-400" />

        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "30px 30px"
        }} />

        {/* Content */}
        <div className="relative z-10 max-w-md space-y-8 px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">AI Analyst</span>
          </div>

          <h2 className="text-4xl font-extrabold leading-tight text-white">
            Start your
            <br />
            <span className="text-cyan-300">data journey</span>
          </h2>
          <p className="text-base text-white/70 leading-relaxed">
            Join thousands of analysts who transform messy spreadsheets into clear, actionable business intelligence.
          </p>

          <div className="space-y-4 pt-4">
            {[
              { icon: Zap, text: "Set up in under 60 seconds" },
              { icon: Shield, text: "Enterprise-grade security" },
              { icon: Globe, text: "Works with any dataset format" }
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/80">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={16} />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-5">
          <AuthForm mode="signup" />
          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
