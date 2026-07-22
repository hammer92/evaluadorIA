// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TemplateStatusBadge } from './template-status-badge';

describe('TemplateStatusBadge', () => {
  it('renders draft status with neutral style', () => {
    render(<TemplateStatusBadge status="draft" />);
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('renders in_review with info color', () => {
    render(<TemplateStatusBadge status="in_review" />);
    expect(screen.getByText('En revisión')).toBeInTheDocument();
  });

  it('renders changes_requested with warning color', () => {
    render(<TemplateStatusBadge status="changes_requested" />);
    expect(screen.getByText('Cambios solicitados')).toBeInTheDocument();
  });

  it('renders approved with success color', () => {
    render(<TemplateStatusBadge status="approved" />);
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
  });

  it('renders rejected with error color', () => {
    render(<TemplateStatusBadge status="rejected" />);
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<TemplateStatusBadge status="approved" />);
    expect(screen.getByLabelText('Estado: Aprobado')).toBeInTheDocument();
  });
});
