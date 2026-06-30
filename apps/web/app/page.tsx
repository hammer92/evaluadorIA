import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-surface-neutral">
      <header className="border-b border-border-standard bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-container-padding">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy">
              <span className="font-hanken text-sm font-bold text-white">KS</span>
            </div>
            <span className="font-hanken text-base font-semibold text-on-surface">
              KnowledgeSync
            </span>
          </div>
          <div className="flex items-center gap-stack-sm">
            <Button asChild variant="ghost">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-container-padding py-stack-lg">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-label-sm text-outline-tv">TECHNICAL VALIDATION SYSTEM</p>
          <h1 className="mt-stack-sm font-hanken text-display-lg text-on-surface">
            Entorno de Evaluación
          </h1>
          <p className="mt-stack-md text-body-lg text-on-surface-variant">
            Plataforma full-stack para validar capacidades técnicas con feedback estructurado,
            trazabilidad y auditoría end-to-end.
          </p>
          <div className="mt-stack-lg flex flex-wrap items-center justify-center gap-stack-sm">
            <Button asChild>
              <Link href="/signup">Empezar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
          <div className="mt-stack-lg grid grid-cols-1 gap-stack-md text-left sm:grid-cols-3">
            {[
              {
                title: 'Auditoría',
                body: 'Cada acción queda registrada en audit logs con trazabilidad completa.',
              },
              {
                title: 'Roles',
                body: 'Admin, Recruiter y Expert con permisos diferenciados y claims verificables.',
              },
              {
                title: 'SSR + Auth',
                body: 'Next.js 15 + Firebase Auth con session cookies HS256 firmadas.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card"
              >
                <p className="text-label-sm text-navy">{feature.title.toUpperCase()}</p>
                <p className="mt-stack-sm text-body-md text-on-surface-variant">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border-standard bg-white px-container-padding py-stack-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-stack-sm text-label-sm text-outline-tv">
          <span>KnowledgeSync · Technical Validation System</span>
          <span>v0.1 · Pilot</span>
        </div>
      </footer>
    </main>
  );
}
