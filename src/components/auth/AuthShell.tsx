import Link from "next/link";
import { LiveTableShowcase } from "./LiveTableShowcase";

/** Split layout for sign-in/sign-up: a felt panel with a fanned hand, and the form. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[1.05fr_1fr] max-lg:grid-cols-1">
      <aside
        className="relative flex flex-col overflow-hidden p-10 max-lg:hidden"
        style={{
          background:
            "radial-gradient(ellipse at 40% 45%, #247C53 0%, var(--felt) 40%, var(--felt-deep) 75%, var(--felt-deepest) 100%)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-deep text-[16px] text-gold">♠</span>
          <span className="font-display text-[20px] font-semibold tracking-tight text-white">holdemics</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-8">
          <LiveTableShowcase />
        </div>
        <p className="max-w-[46ch] text-[14px] leading-relaxed text-green-light-text">
          A bot table playing down to the last HP. Everyone starts with 100. Finish in the top half and your rating
          climbs.
        </p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-felt text-[15px] text-gold">♠</span>
            <span className="font-display text-[18px] font-semibold tracking-tight">holdemics</span>
          </Link>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-[14px] text-text-secondary">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  hint,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium">{label}</span>
      <input
        {...input}
        className="w-full rounded-lg border border-border bg-surface-deep px-3 py-2.5 text-[14px] text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-gold/70"
      />
      {hint && <span className="mt-1 block text-[12px] text-text-tertiary">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-gold py-3 font-display text-[15px] font-semibold text-surface-primary transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-[13px] ${
        tone === "error" ? "border-red/40 bg-red/10 text-[#EFA3A3]" : "border-felt/50 bg-felt/10 text-felt-light"
      }`}
    >
      {children}
    </p>
  );
}
