'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutCurrent } from '@/features/auth/api/auth-api';
import { cn } from '@/lib/utils';

// =============================================================================
// UserMenu — avatar + dropdown con signOut.
// =============================================================================
// `signOutCurrent` limpia Firebase Auth client + cookie httpOnly (vía CF).
// Después del signOut, redirect a /login.
// =============================================================================

function getInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return (parts[0] ?? 'U').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutCurrent();
      toast.success('Sesión cerrada');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('No se pudo cerrar la sesión');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Abrir menú de cuenta (${email})`}
        title="Abrir menú de cuenta"
        className={cn(
          'flex items-center gap-1 rounded-full p-0.5 outline-none',
          'focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2',
          'hover:bg-navy/5 transition-colors',
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src="" alt="" />
          <AvatarFallback>{getInitials(email)}</AvatarFallback>
        </Avatar>
        <ChevronDown size={14} className="text-on-surface-variant" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Perfil</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-label="Cerrar sesión"
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
          disabled={signingOut}
        >
          {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
