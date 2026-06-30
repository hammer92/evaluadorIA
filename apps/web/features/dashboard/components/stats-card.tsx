import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

export function StatsCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  trend?: { value: number; label: string };
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-1">{value}</p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-1">
              {trend.value > 0 ? '+' : ''}
              {trend.value} {trend.label}
            </p>
          )}
        </div>
        <div className="h-8 w-8 text-muted-foreground [&_svg]:h-8 [&_svg]:w-8">{icon}</div>
      </CardContent>
    </Card>
  );
}
