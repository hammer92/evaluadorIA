'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function StatsCard({
  label,
  value,
  icon,
  trend,
  tone = 'info',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  trend?: { value: number; label: string };
  tone?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
}): React.JSX.Element {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    info: 'bg-status-info/10 text-status-info',
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-status-warning/10 text-status-warning',
    error: 'bg-status-error/10 text-status-error',
    neutral: 'bg-navy/5 text-navy',
  };

  return (
    <div className="rounded-tv border border-border-standard bg-white p-stack-md shadow-tv-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-label-sm text-outline-tv">{label.toUpperCase()}</p>
          <p className="mt-stack-sm font-hanken text-display-lg text-on-surface">{value}</p>
          {trend && (
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1 text-body-md',
                trend.value > 0 ? 'text-status-success' : 'text-status-error',
              )}
            >
              <span aria-hidden>{trend.value > 0 ? '↑' : '↓'}</span>
              {trend.value > 0 ? '+' : ''}
              {trend.value} {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md [&_svg]:h-5 [&_svg]:w-5',
            toneClasses[tone],
          )}
          aria-hidden
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
