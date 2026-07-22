// @vitest-environment jsdom
import type { Template } from '@shared/schemas/templates';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReviewQueueTable } from './review-queue-table';

const baseTemplate: Template = {
  templateId: 'tmpl-1',
  organizationId: 'org-1',
  name: 'Algebra 101',
  description: 'Intro algebra',
  niche: 'school',
  timeLimitMinutes: 60,
  maxRetries: 2,
  recipes: [],
  status: 'in_review',
  createdBy: 'jane@example.com',
  createdByRole: 'recruiter',
  createdAt: new Date('2026-07-22T10:00:00Z'),
  updatedAt: new Date('2026-07-22T11:00:00Z'),
  approvedBy: null,
  approvedAt: null,
  deletedAt: null,
};

describe('ReviewQueueTable', () => {
  it('renderiza empty state cuando no hay templates', () => {
    render(<ReviewQueueTable templates={[]} />);
    expect(screen.getByText(/no hay templates esperando revisión/i)).toBeInTheDocument();
  });

  it('renderiza cada template como link al detalle con from=review', () => {
    render(<ReviewQueueTable templates={[baseTemplate]} />);
    const links = screen.getAllByRole('link', { name: /algebra 101/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute(
      'href',
      '/admin/templates/detail?templateId=tmpl-1&from=review',
    );
  });

  it('renderiza columna "Enviado por" con createdBy', () => {
    render(<ReviewQueueTable templates={[baseTemplate]} />);
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('expone region ARIA con label "Cola de templates en revisión"', () => {
    render(<ReviewQueueTable templates={[baseTemplate]} />);
    expect(
      screen.getByRole('region', { name: /cola de templates en revisión/i }),
    ).toBeInTheDocument();
  });

  it('botón Revisar tiene aria-label accesible (renderea como link via asChild)', () => {
    render(<ReviewQueueTable templates={[baseTemplate]} />);
    const link = screen.getByRole('link', { name: /ver detalle de algebra 101/i });
    expect(link).toHaveAttribute('href', '/admin/templates/detail?templateId=tmpl-1&from=review');
  });

  it('renderiza múltiples templates', () => {
    const t2: Template = { ...baseTemplate, templateId: 'tmpl-2', name: 'Cálculo I' };
    render(<ReviewQueueTable templates={[baseTemplate, t2]} />);
    expect(screen.getAllByRole('link', { name: /algebra 101/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /cálculo i/i }).length).toBeGreaterThan(0);
  });
});
