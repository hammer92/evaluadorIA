import { SignupForm } from '@/features/auth/components/signup-form';

export default function SignupPage() {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Admin Platform</h1>
        <p className="text-sm text-muted-foreground">Plataforma administrativa</p>
      </div>
      <SignupForm />
    </div>
  );
}
