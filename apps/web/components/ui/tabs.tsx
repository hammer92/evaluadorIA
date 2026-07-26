'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex items-center data-[orientation=horizontal]:h-auto data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col',
  {
    variants: {
      variant: {
        default: 'rounded-lg bg-muted p-[3px] text-muted-foreground',
        line: 'gap-stack-lg border-b border-border-standard',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Default variant: pill-style
        "rounded-md border border-transparent px-2 py-1 text-foreground/60 hover:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm dark:text-muted-foreground dark:hover:text-foreground dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",
        // Line variant: clean underline, no border box
        "group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:text-on-surface-variant group-data-[variant=line]/tabs-list:hover:text-on-surface group-data-[variant=line]/tabs-list:data-[state=active]:-mb-px group-data-[variant=line]/tabs-list:data-[state=active]:border-b-2 group-data-[variant=line]/tabs-list:data-[state=active]:border-brand-secondary group-data-[variant=line]/tabs-list:data-[state=active]:font-bold group-data-[variant=line]/tabs-list:data-[state=active]:text-on-surface",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('text-sm outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
