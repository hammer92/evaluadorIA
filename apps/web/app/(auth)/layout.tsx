import { ShieldCheck, SquareTerminal } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-neutral text-on-surface font-inter flex min-h-screen flex-col">
      <div aria-hidden className="pointer-events-none fixed top-0 right-0 opacity-10 select-none">
        <div className="border-primary absolute -top-32 -right-32 h-64 w-64 rounded-full border" />
        <div className="border-primary absolute -top-16 -right-16 h-48 w-48 rounded-full border" />
      </div>

      <header className="mx-auto flex w-full max-w-[1024px] items-center justify-center px-container-padding py-4 md:justify-start">
        <div className="flex items-center gap-2">
          <SquareTerminal className="text-primary h-7 w-7" fill="currentColor" strokeWidth={1.5} />
          <span className="text-headline-md text-primary tracking-tight">KnowledgeSync</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-container-padding py-stack-lg">
        {children}
      </main>

      <footer className="bg-surface-neutral border-border-standard mt-auto border-t">
        <div className="mx-auto flex w-full max-w-[1024px] flex-col items-start justify-between gap-2 px-container-padding py-stack-sm md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="text-status-info h-4 w-4"
              fill="currentColor"
              strokeWidth={1.5}
            />
            <span className="text-label-sm text-on-surface-variant">
              Entorno seguro · Technical Validation System
            </span>
          </div>
          <span className="text-label-sm text-on-surface-variant">
            © 2024 KnowledgeSync. Secure Assessment Environment.
          </span>
          <div className="hidden gap-4 md:flex">
            <a
              className="text-label-sm text-on-surface-variant hover:text-brand-secondary transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="text-label-sm text-on-surface-variant hover:text-brand-secondary transition-colors"
              href="#"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
