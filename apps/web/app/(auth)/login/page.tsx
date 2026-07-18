'use client';

import { useSearchParams } from 'next/navigation';

import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') ?? undefined;
  const error = searchParams.get('error');

  return (
    <div className="w-full max-w-[440px]">
      <LoginForm {...(nextUrl ? { nextUrl } : {})} />
      {error && (
        <p className="text-label-sm text-status-error mt-stack-md text-center">
          {error === 'no-claims'
            ? 'Tu cuenta no tiene permisos. Contactá al admin.'
            : error === 'server-misconfigured'
              ? 'El servidor no está configurado correctamente. Contactá al admin.'
              : `Error: ${error}`}
        </p>
      )}
    </div>
  );
}
