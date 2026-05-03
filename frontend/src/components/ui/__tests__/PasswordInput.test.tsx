import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PasswordInput } from '@/components/ui/PasswordInput';

describe('PasswordInput', () => {
  it('renders with type="password" by default', () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('toggles to type="text" when show button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);

    await user.click(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('toggles back to type="password" on second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);

    const toggle = screen.getByLabelText('Show password');
    await user.click(toggle);
    await user.click(screen.getByLabelText('Hide password'));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('updates aria-label between "Show password" and "Hide password"', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);

    expect(screen.getByLabelText('Show password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hide password')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Show password'));

    expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show password')).not.toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<PasswordInput label="Password" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('renders label text', () => {
    render(<PasswordInput label="Enter password" />);
    expect(screen.getByText('Enter password')).toBeInTheDocument();
  });
});
