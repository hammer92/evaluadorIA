import * as React from 'react';

import { cn } from '@/lib/utils';

// =============================================================================
// Input — wrapper sobre <input> con `forwardRef` para que react-hook-form's
// `register()` pueda trackear el elemento via `ref`.
// =============================================================================
// En React 18, `ref` es un prop especial que NO se pasa via spread. Sin
// forwardRef, el `ref` que retorna `form.register('email')` se pierde y
// react-hook-form no puede leer/escribir el value del input, dejando el
// form state vacío (lo que produce errores falsos de "campo requerido"
// al submit).
// =============================================================================

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Input(
  { className, type, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
});

export { Input };
