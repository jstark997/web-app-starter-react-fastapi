import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dialog } from '@/components/ui/Dialog';

// jsdom doesn't implement showModal/close on <dialog>
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('Dialog', () => {
  it('calls showModal when isOpen is true', () => {
    render(
      <Dialog isOpen onClose={vi.fn()} title="Test">
        Content
      </Dialog>,
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it('does not call showModal when isOpen is false', () => {
    render(
      <Dialog isOpen={false} onClose={vi.fn()} title="Test">
        Content
      </Dialog>,
    );
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it('renders title and children when open', () => {
    render(
      <Dialog isOpen onClose={vi.fn()} title="My Dialog">
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed (cancel event)', () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen onClose={onClose} title="Test">
        Content
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    dialog.dispatchEvent(new Event('cancel', { bubbles: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog isOpen onClose={onClose} title="Test">
        Content
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    await user.click(dialog);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner content is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog isOpen onClose={onClose} title="Test">
        <p>Inner content</p>
      </Dialog>,
    );

    await user.click(screen.getByText('Inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
