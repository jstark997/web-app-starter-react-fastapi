import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  confirmationText?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  confirmationText,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setInputValue('');
    }
  }

  const isConfirmDisabled = confirmationText
    ? inputValue !== confirmationText
    : false;

  const confirmVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600">{message}</p>
      {confirmationText && (
        <div className="mt-4">
          <label htmlFor="confirm-input" className="block text-sm font-medium text-gray-700">
            Type <span className="font-semibold">{confirmationText}</span> to confirm
          </label>
          <input
            id="confirm-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          disabled={isConfirmDisabled}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export type { ConfirmDialogProps };
