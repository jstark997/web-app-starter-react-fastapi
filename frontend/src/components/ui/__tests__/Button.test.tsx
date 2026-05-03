import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled and shows spinner when isLoading is true', () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    // Spinner is aria-hidden inside button so it doesn't pollute the button's accessible name
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show spinner when isLoading is false', () => {
    render(<Button>Save</Button>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not fire onClick when loading', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button isLoading onClick={handleClick}>Save</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('supports disabled prop independent of loading', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
