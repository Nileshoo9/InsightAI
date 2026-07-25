import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BarChart3, Sparkles, TrendingUp } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Left branding panel — hidden on mobile */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-purple-800 lg:flex">
        {/* Floating orbs */}
        <div className="absolute left-12 top-20 h-32 w-32 rounded-full bg-white/10 blur-xl animate-float" />
        <div className="absolute bottom-24 right-16 h-24 w-24 rounded-full bg-white/10 blur-lg animate-float animate-delay-300" />
        <div className="absolute right-1/3 top-1/3 h-16 w-16 rounded-full bg-cyan-400/20 blur-md animate-bounce-subtle" />

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
            Turn raw data into
            <br />
            <span className="text-cyan-300">actionable insights</span>
          </h2>
          <p className="text-base text-white/70 leading-relaxed">
            Upload any dataset and let AI analyze trends, uncover risks, and recommend next steps — all in seconds.
          </p>

          <div className="space-y-4 pt-4">
            {[
              { icon: BarChart3, text: "Instant visual dashboards" },
              { icon: Sparkles, text: "AI-powered recommendations" },
              { icon: TrendingUp, text: "Trend & anomaly detection" }
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
          <AuthForm mode="login" />
          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
