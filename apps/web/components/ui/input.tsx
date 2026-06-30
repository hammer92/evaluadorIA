import * as React from 'react';

import { cn } from '@/lib/utils';

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
        'h-9 w-full min-w-0 rounded-md border border-border-standard bg-white px-3 py-1 text-base text-on-surface transition-colors outline-none placeholder:text-outline-tv focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 aria-invalid:border-status-error aria-invalid:ring-2 aria-invalid:ring-status-error/20 md:text-sm',
        className,
      )}
      {...props}
    />
  );
});

export { Input };
