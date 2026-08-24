import Link from 'next/link';
import { Stamp } from 'lucide-react';

/** Centered narrow layout for login/onboarding screens. */
export function AuthShell({
  children,
  footer,
  wide = false,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-strong">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Stamp className="size-4" />
          </span>
          Stamposa
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-6">
        <div
          className={`w-full ${wide ? 'max-w-lg' : 'max-w-sm'} rounded-2xl border border-line/80 bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-8`}
        >
          {children}
        </div>
      </main>
      {footer && <footer className="pb-8 text-center text-sm text-muted">{footer}</footer>}
    </div>
  );
}
