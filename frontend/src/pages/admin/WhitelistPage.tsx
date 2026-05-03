import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  getWhitelistSettings,
  updateWhitelistSettings,
  listWhitelistEntries,
  addWhitelistEntry,
  removeWhitelistEntry,
} from '@/api/whitelist';
import { Button, Input, Toggle, ConfirmDialog, Skeleton } from '@/components/ui';
import { addWhitelistEntrySchema } from '@/utils/validation';
import type { AddWhitelistEntryFormData } from '@/utils/validation';
import type { WhitelistEntry, WhitelistSettings } from '@/types';
import { ApiError } from '@/types';

export default function WhitelistPage() {
  const [settings, setSettings] = useState<WhitelistSettings | null>(null);
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<WhitelistEntry | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm<AddWhitelistEntryFormData>({
    resolver: zodResolver(addWhitelistEntrySchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [settingsResult, entriesResult] = await Promise.all([
          getWhitelistSettings(),
          listWhitelistEntries(),
        ]);
        if (cancelled) return;
        setSettings(settingsResult);
        setEntries(entriesResult);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load whitelist.';
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(nextValue: boolean) {
    setIsToggling(true);
    try {
      const updated = await updateWhitelistSettings({ enabled: nextValue });
      setSettings(updated);
      toast.success(updated.enabled ? 'Whitelist enabled.' : 'Whitelist disabled.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update whitelist setting.';
      toast.error(message);
    } finally {
      setIsToggling(false);
    }
  }

  async function onAddSubmit(data: AddWhitelistEntryFormData) {
    try {
      const created = await addWhitelistEntry({ email: data.email });
      setEntries((prev) => [created, ...prev]);
      toast.success(`${created.email} added to whitelist.`);
      reset({ email: '' });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErr = err.fieldErrors.find((f) => f.field === 'email');
        if (fieldErr) {
          setFormError('email', { type: 'server', message: fieldErr.message });
        } else {
          setFormError('root.serverError', { type: 'server', message: err.message });
          toast.error(err.message);
        }
      } else {
        toast.error('Failed to add email to whitelist.');
      }
    }
  }

  async function handleConfirmRemove() {
    if (!entryToRemove) return;
    setIsRemoving(true);
    try {
      await removeWhitelistEntry(entryToRemove.id);
      setEntries((prev) => prev.filter((e) => e.id !== entryToRemove.id));
      toast.success(`${entryToRemove.email} removed from whitelist.`);
      setEntryToRemove(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to remove email from whitelist.';
      toast.error(message);
    } finally {
      setIsRemoving(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const trimmedSearch = search.trim().toLowerCase();
  const filteredEntries = trimmedSearch
    ? entries.filter((entry) => entry.email.toLowerCase().includes(trimmedSearch))
    : entries;

  const toggleLabel = settings?.enabled
    ? 'Whitelist Enabled — only whitelisted emails may register'
    : 'Whitelist Disabled — anyone may register';

  const removeMessage = entryToRemove
    ? settings?.enabled
      ? `Remove ${entryToRemove.email} from the whitelist? Because the whitelist is currently enabled, removing this email will immediately invalidate any active sessions for that user.`
      : `Remove ${entryToRemove.email} from the whitelist?`
    : '';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Whitelist</h1>
        <p className="mt-1 text-sm text-gray-600">
          Control whether registration is restricted to a list of pre-approved email addresses.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <section
        className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
        aria-labelledby="whitelist-toggle-heading"
      >
        <h2 id="whitelist-toggle-heading" className="sr-only">
          Whitelist toggle
        </h2>
        {isLoading ? (
          <Skeleton variant="text" width="60%" height="1.25rem" />
        ) : settings ? (
          <Toggle
            checked={settings.enabled}
            onChange={handleToggle}
            label={toggleLabel}
            disabled={isToggling}
          />
        ) : null}
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Add email to whitelist</h2>
        <form onSubmit={handleSubmit(onAddSubmit)} noValidate className="space-y-3">
          {errors.root?.serverError && (
            <div className="rounded-md bg-red-50 p-3" role="alert">
              <p className="text-sm text-red-700">{errors.root.serverError.message}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                label="Email"
                type="email"
                autoComplete="off"
                placeholder="user@example.com"
                disabled={isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
            <div className="sm:pt-7">
              <Button type="submit" isLoading={isSubmitting}>
                Add
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Whitelisted emails</h2>
          {!isLoading && entries.length > 0 && (
            <p className="text-sm text-gray-500">
              {filteredEntries.length} of {entries.length}
            </p>
          )}
        </div>

        <div className="mb-4">
          <Input
            label="Search whitelist"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            disabled={isLoading}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton variant="rectangular" height="3rem" />
            <Skeleton variant="rectangular" height="3rem" />
            <Skeleton variant="rectangular" height="3rem" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No emails on the whitelist yet.
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No entries match your search.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{entry.email}</p>
                  <p className="text-xs text-gray-500">Added {formatDate(entry.createdAt)}</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setEntryToRemove(entry)}
                  disabled={isRemoving && entryToRemove?.id === entry.id}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={entryToRemove !== null}
        onClose={() => {
          if (!isRemoving) setEntryToRemove(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove from Whitelist"
        message={removeMessage}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
