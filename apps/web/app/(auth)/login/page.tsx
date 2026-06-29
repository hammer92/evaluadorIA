import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Admin Platform</h1>
        <p className="text-sm text-muted-foreground">Plataforma administrativa</p>
      </div>
      <LoginForm nextUrl={searchParams.next} />
      {searchParams.error && (
        <p className="text-center text-sm text-destructive">
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
