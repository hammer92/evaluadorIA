import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="w-full max-w-[440px]">
      <LoginForm {...(searchParams.next ? { nextUrl: searchParams.next } : {})} />
      {searchParams.error && (
        <p className="text-label-sm text-status-error mt-stack-md text-center">
          {searchParams.error === 'no-claims'
            ? 'Tu cuenta no tiene permisos. Contactá al admin.'
            : searchParams.error === 'server-misconfigured'
              ? 'El servidor no está configurado correctamente. Contactá al admin.'
              : `Error: ${searchParams.error}`}
        </p>
      )}
    </div>
  );
}
