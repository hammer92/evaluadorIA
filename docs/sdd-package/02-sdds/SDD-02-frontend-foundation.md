# SDD-02: Frontend Foundation (Next.js 14)

> **Estado:** Draft
> **Owner:** Solution Architect
> **Sprint objetivo:** Sprint 1 (semanas 1-2)
> **Depende de:** SDD-01
> **Bloquea a:** SDD-05, SDD-07

---

## 1. Contexto

Necesitamos el shell de Next.js 14 con todas las librerías de UI/data/state ya configuradas y funcionando, de modo que en SDD-04 podamos agregar repositorios sin preocuparnos por plumbing, y en SDD-05/07 la UI esté lista para colgar pantallas de auth y admin.

Este SDD **no** incluye pantallas funcionales (esas vienen en SDD-05/07). Es solo el "esqueleto presentacional + providers + middleware stub".

## 2. Goals y Non-Goals

### Goals

- Next.js 14 con App Router, TS estricto, RSC habilitado.
- Tailwind CSS + shadcn/ui inicializado con tema personalizado.
- Providers globales: TanStack Query, Zustand base, next-themes, Toast (sonner).
- Layout raíz con sidebar colapsable, header, dark mode toggle.
- `middleware.ts` con **stub** de protección de rutas `/admin/**` (la lógica real se completa en SDD-05).
- Aliases `@/` y `@shared/` configurados en tsconfig + vitest.
- Variables de entorno validadas con Zod al arranque.
- ESLint custom rules del monorepo funcionando en este paquete.

### Non-Goals

- Páginas funcionales (login real, dashboard real, users table). Solo stubs.
- Auth completo (SDD-05).
- Integración con Firebase Auth real (SDD-03 provee emuladores, SDD-05 el wiring).
- i18n.
- Storybook.
- E2E tests.

## 3. Decisiones de arquitectura

| #   | Decisión                                               | ADR / Justificación                                           |
| --- | ------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | App Router (no Pages Router)                           | Recomendado por Next.js 14. RSC, layouts anidados, streaming. |
| 2   | `next-themes` para dark mode                           | Estándar de facto, sin flash on load.                         |
| 3   | TanStack Query v5                                      | Data fetching + cache + revalidation declarativos.            |
| 4   | Zustand para estado de UI                              | 1KB, simple, sin providers necesarios.                        |
| 5   | `sonner` para toasts                                   | shadcn/ui lo recomienda.                                      |
| 6   | `zod` para `env.ts`                                    | Validación runtime al boot. Falla rápido si falta una var.    |
| 7   | Path aliases via `tsconfig.json` (no `next.config.js`) | Más estándar y funciona también en Vitest.                    |
| 8   | Server Components por default                          | Solo `'use client'` cuando hay interactividad o estado.       |

## 4. Spec detallada

### 4.1 Estructura de archivos a crear

```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json                    # shadcn config
├── middleware.ts                      # stub
├── vitest.config.ts                   # override del root
├── env.ts                             # Zod-validated env
├── next-env.d.ts                      # generado por Next, no editar a mano
├── public/
│   └── .gitkeep
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── globals.css                    # Tailwind base
│   ├── page.tsx                       # landing pública (placeholder)
│   ├── not-found.tsx                  # 404
│   ├── error.tsx                      # 500 boundary
│   ├── loading.tsx                    # root loading
│   └── admin/
│       ├── layout.tsx                 # Admin layout (sidebar + header)
│       └── page.tsx                   # placeholder dashboard
├── components/
│   ├── ui/                            # shadcn primitives (auto-generated)
│   ├── providers/
│   │   ├── query-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── toast-provider.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── user-menu.tsx
│   │   └── theme-toggle.tsx
│   └── error-boundary.tsx
├── config/
│   └── constants.ts                   # NAV_ITEMS, ROLES, etc.
├── lib/
│   ├── cn.ts                          # className helper
│   └── utils.ts                       # shadcn utils
└── stores/
    └── ui-store.ts                    # Zustand base (sidebar collapsed, etc.)
```

### 4.2 Contenido de archivos clave

#### `apps/web/package.json`

```jsonc
{
  "name": "@platform/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@tanstack/react-query": "^5.56.0",
    "@tanstack/react-table": "^8.20.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.445.0",
    "next": "^14.2.0",
    "next-themes": "^0.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.53.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.0",
    "zustand": "^4.5.0",
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.12.0",
    "eslint-config-next": "^14.2.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
  },
}
```

#### `apps/web/tsconfig.json`

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["../../packages/shared/src/*"],
    },
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "dist"],
}
```

#### `apps/web/next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { typedRoutes: true },
  // Header de seguridad extra (defense in depth)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
export default nextConfig;
```

#### `apps/web/env.ts` (validación runtime)

```ts
import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
});

const serverEnvSchema = clientEnvSchema.extend({
  REPOSITORY_DRIVER: z.enum(['memory', 'firebase']).default('memory'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  // Server-only — no expuestas al cliente
  FIREBASE_ADMIN_PROJECT_ID: z.string().optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional(),
});

const parsedClient = clientEnvSchema.safeParse({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

if (!parsedClient.success) {
  // Falla el build, no la primera request.
  throw new Error(
    'Invalid client env: ' + JSON.stringify(parsedClient.error.flatten().fieldErrors, null, 2),
  );
}

export const clientEnv = parsedClient.data;
export const env =
  typeof window === 'undefined'
    ? serverEnvSchema.parse({ ...parsedClient.data, ...process.env })
    : (clientEnv as unknown as z.infer<typeof serverEnvSchema>);
```

> **Crítico**: el módulo falla al import si las env vars requeridas faltan. Esto bloquea `pnpm dev` con mensaje claro.

#### `apps/web/middleware.ts` (stub)

```ts
import { NextResponse, type NextRequest } from 'next/server';

// STUB — la verificación real del JWT se hace en SDD-05 con firebase-admin.
// Aquí solo aseguramos que /admin/** requiere sesión.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get('__session')?.value;

  if (pathname.startsWith('/admin') && !sessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

#### `apps/web/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Admin Platform', template: '%s · Admin Platform' },
  description: 'Plataforma administrativa',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <ToastProvider />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### Providers (extractos)

```tsx
// components/providers/theme-provider.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

```tsx
// components/providers/query-provider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

```tsx
// components/providers/toast-provider.tsx
'use client';
import { Toaster } from 'sonner';
export function ToastProvider() {
  return <Toaster richColors closeButton position="top-right" />;
}
```

#### `stores/ui-store.ts`

```ts
import { create } from 'zustand';

type UiState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
```

#### `components/layout/sidebar.tsx`

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/config/constants';
import { useUiStore } from '@/stores/ui-store';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background transition-all',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b">
        {!collapsed && <span className="font-semibold">Admin</span>}
        <button onClick={toggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
              )}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

#### `config/constants.ts`

```ts
import { LayoutDashboard, Users, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export const ROLES = ['admin', 'recruiter', 'expert'] as const;
export type Role = (typeof ROLES)[number];
```

#### `app/admin/layout.tsx`

```tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

#### `app/admin/page.tsx` (placeholder)

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Placeholder — contenido real en SDD-07.</p>
    </div>
  );
}
```

#### `app/not-found.tsx`

```tsx
import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">No encontramos esa página.</p>
      <Link href="/" className="underline">
        Volver al inicio
      </Link>
    </div>
  );
}
```

#### `app/error.tsx`

```tsx
'use client';
import { useEffect } from 'react';
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Algo se rompió</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="underline">
        Reintentar
      </button>
    </div>
  );
}
```

### 4.3 shadcn/ui — componentes a inicializar

En SDD-02 se inicializa solo lo necesario para el shell:

```bash
cd apps/web
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input label dropdown-menu avatar sheet tabs sonner separator
```

> NO se instalan: data-table, command, calendar, etc. Esos se agregan on-demand en SDD-07.

### 4.4 Comportamiento esperado

- `pnpm --filter web dev` levanta Next.js en `http://localhost:3000`.
- La landing pública (`/`) renderiza con dark/light mode funcional.
- `/admin` redirige a `/login` (middleware stub).
- `pnpm --filter web build` produce un bundle < 200KB gzip para la landing.
- `pnpm --filter web typecheck` pasa con TS estricto.
- `pnpm --filter web lint` pasa con `--max-warnings 0`.
- Cambiar tema se persiste entre reloads.

### 4.5 Errores y excepciones

| Situación                            | Comportamiento                                                      |
| ------------------------------------ | ------------------------------------------------------------------- |
| Falta `NEXT_PUBLIC_FIREBASE_*`       | `env.ts` tira error al boot con detalle de qué var falta.           |
| Build intenta prerenderizar `/admin` | Marcado como `dynamic = 'force-dynamic'` en `app/admin/layout.tsx`. |
| Hydration mismatch en theme toggle   | `suppressHydrationWarning` en `<html>` (estándar para next-themes). |

### 4.6 Ejemplo de uso

```bash
# Setup
pnpm install

# Dev
pnpm --filter web dev
# → http://localhost:3000

# Build + check
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web lint
```

## 5. Criterios de aceptación

- [ ] `pnpm --filter web dev` levanta sin errores en puerto 3000.
- [ ] Landing pública renderiza con título y subtítulo.
- [ ] Dark mode toggle cambia el tema y persiste tras reload.
- [ ] Sidebar colapsa/expande y persiste en localStorage (vía Zustand persist).
- [ ] `/admin` sin sesión redirige a `/login?next=/admin`.
- [ ] `/admin` con cookie `__session` placeholder carga el layout.
- [ ] 404 custom se muestra en rutas inexistentes.
- [ ] Error boundary custom se muestra si un Server Component tira.
- [ ] `pnpm --filter web build` completa sin warnings ni errores.
- [ ] `pnpm --filter web typecheck` pasa con TS estricto.
- [ ] `pnpm --filter web lint` pasa con `--max-warnings 0`.
- [ ] ESLint rechaza `import { getFirestore } from 'firebase/firestore'` en `app/admin/page.tsx` (verificación manual).
- [ ] Bundle inicial de la landing < 200KB gzip (medible con `pnpm build && du -sh .next` o `@next/bundle-analyzer`).
- [ ] Lighthouse score > 90 en Performance y Accessibility para `/` (verificable con `npx lighthouse http://localhost:3000`).

## 6. Plan de testing

- **Unit**: `lib/cn.test.ts` (test trivial de `cn`).
- **Smoke**: `pnpm build` exit 0.
- **Manual**: checklist de los criterios de aceptación arriba.

Los tests reales (component testing con Testing Library) se agregan en SDD-07 cuando hay componentes con lógica real.

## 7. Riesgos y mitigaciones

| Riesgo                                            | Probabilidad | Impacto | Mitigación                                                               |
| ------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------ |
| Bundle > 200KB en landing                         | M            | M       | Tree-shaking estricto + dynamic import de providers pesados.             |
| shadcn genera código incompatible con TS estricto | B            | M       | Verificar tras `init`. Si rompe, ajustar `components.json` y re-generar. |
| `next-themes` causa flash blanco en dark mode     | M            | B       | `suppressHydrationWarning` + `defaultTheme="system"`.                    |
| Aliases `@shared/*` no resuelven en build         | B            | M       | Verificar en `tsconfig.json` y en el test de `vitest.config.ts`.         |
| Middleware redirect loop si cookie mal seteada    | B            | M       | Solo redirige a `/login` si NO hay cookie. No redirige si hay cookie.    |

## 8. Out of scope

- Tests e2e (Playwright). Se define estrategia en SDD-08.
- Internacionalización (next-intl).
- SSR con Cloud Run — Firebase Hosting puede servir Next.js static + dynamic vía Cloud Run. **Decisión**: usar **Firebase Hosting con SSR via Cloud Run** desde el día 1 para tener SSR en rutas protegidas. Detalles en SDD-08.
- Realtime features (Firestore listeners en UI) — para v2.

## 9. Open Questions

- [ ] ¿Sidebar colapsado persiste en localStorage o en cookie? Decisión sugerida: Zustand `persist` middleware → localStorage.
- [ ] ¿Header muestra avatar real o placeholder en este SDD? Decisión: **placeholder** (no hay auth aún).
- [ ] ¿Activamos `typedRoutes` (experimental) ahora o esperamos? Decisión: **sí**, ayuda a encontrar links rotos.
