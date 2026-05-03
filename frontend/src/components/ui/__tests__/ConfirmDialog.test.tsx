import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Delete user?',
    message: 'This action cannot be undone.',
  };

  it('renders title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete user?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses custom confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Go Back"
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  describe('with confirmationText', () => {
    it('disables confirm button until text matches', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmationText="user@example.com"
        />,
      );
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('enables confirm button when text matches exactly', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmationText="user@example.com"
        />,
      );

      const input = screen.getByLabelText(/Type .* to confirm/);
      await user.type(input, 'user@example.com');

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('keeps confirm disabled with partial match', async () => {
      const user = userEvent.setup();
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmationText="user@example.com"
        />,
      );

      const input = screen.getByLabelText(/Type .* to confirm/);
      await user.type(input, 'user@example');

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });

    it('resets input when dialog closes and reopens', () => {
      const { rerender } = render(
        <ConfirmDialog
          {...defaultProps}
          confirmationText="user@example.com"
        />,
      );

      rerender(
        <ConfirmDialog
          {...defaultProps}
          isOpen={false}
          confirmationText="user@example.com"
        />,
      );

      rerender(
        <ConfirmDialog
          {...defaultProps}
          isOpen={true}
          confirmationText="user@example.com"
        />,
      );

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });
  });
});
