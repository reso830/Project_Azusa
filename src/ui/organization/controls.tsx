'use client';

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { KumikoIcon } from '../icons/KumikoIcon';
import styles from './organization.module.css';

export type PanelProps = { onMutated: () => Promise<void> };
export type RecordState = {
  id: string;
  name: string;
  recordStatus: 'active' | 'archived';
};

async function api<T>(
  path: string,
  signal?: AbortSignal,
  method = 'GET',
  data?: object,
): Promise<T> {
  const response = await fetch(`/api/organization/${path}`, {
    signal,
    method,
    cache: 'no-store',
    ...(data && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = payload?.error;
    const details = (error?.details ?? []) as { message?: string }[];
    const fieldMessages = details.flatMap(({ message }) =>
      message ? [message] : [],
    );
    throw new Error(
      fieldMessages.length
        ? fieldMessages.join('. ')
        : (error?.message ?? 'Organization data is unavailable.'),
    );
  }
  return response.json() as Promise<T>;
}

export function useRows<T>(path: string | null, revision: number) {
  const [result, setResult] = useState<{
    path: string;
    rows: T[];
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T[]>(path, controller.signal).then(
      (rows) => {
        if (!controller.signal.aborted) setResult({ path, rows });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({ path, rows: [], error: error.message });
      },
    );
    return () => controller.abort();
  }, [path, revision, retry]);
  const current = result?.path === path ? result : undefined;
  return {
    rows: current?.rows ?? [],
    loading: Boolean(path && !current),
    error: current?.error,
    retry: () => {
      setResult(undefined);
      setRetry((value) => value + 1);
    },
  };
}

export function useWrites(onMutated: PanelProps['onMutated']) {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; target?: string }>();
  async function write(
    path: string,
    method: string,
    data?: object,
    target?: string,
  ) {
    setBusy(true);
    setError(undefined);
    try {
      await api(path, undefined, method, data);
      setRevision((value) => value + 1);
      void onMutated();
      return true;
    } catch (cause) {
      setError({
        target,
        message:
          cause instanceof Error
            ? cause.message
            : 'The change could not be saved.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    revision,
    busy,
    write,
    errorFor: (target?: string) =>
      error?.target === target ? error?.message : undefined,
    clearError: () => setError(undefined),
  };
}

export type Writes = ReturnType<typeof useWrites>;

export function RowsState({
  data,
  empty,
}: {
  data: { loading: boolean; error?: string; retry: () => void };
  empty?: string;
}) {
  if (data.loading)
    return (
      <p role="status" className={styles.muted}>
        Loading…
      </p>
    );
  if (data.error)
    return (
      <div role="alert" className={styles.error}>
        {data.error}{' '}
        <button type="button" onClick={data.retry}>
          Retry
        </button>
      </div>
    );
  return empty ? <p className={styles.muted}>{empty}</p> : null;
}

export function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.add}
      onClick={onClick}
      disabled={disabled}
    >
      <KumikoIcon name="add" size={16} />
      {label}
    </button>
  );
}

export function ArchiveToggle({
  checked,
  change,
  label = 'Show archived',
}: {
  checked: boolean;
  change: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => change(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function Picker({
  label,
  name,
  value,
  defaultValue,
  change,
  options,
  placeholder,
  required,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  change?: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.picker}>
        <select
          id={id}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={change ? (event) => change(event.target.value) : undefined}
          required={required}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <KumikoIcon name="chevron" size={13} />
      </span>
    </div>
  );
}

export function optionsFor(records: readonly { id: string; name: string }[]) {
  return records.map(({ id, name }) => ({ value: id, label: name }));
}

export function Field({
  label,
  name,
  value,
  type = 'text',
  required,
  readOnly,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        readOnly={readOnly}
        step={step}
        min={min}
        max={max}
      />
    </label>
  );
}

export function Editor({
  title,
  busy,
  error,
  submit,
  close,
  children,
}: {
  title: string;
  busy: boolean;
  error?: string;
  submit: (data: FormData) => Promise<boolean>;
  close: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await submit(new FormData(event.currentTarget))) close();
  }
  return (
    <form className={styles.editor} aria-labelledby={titleId} onSubmit={save}>
      <h3 id={titleId}>{title}</h3>
      <fieldset disabled={busy}>
        <div className={styles.fields}>{children}</div>
        <WriteError error={error} />
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function RecordActions({
  record,
  resource,
  writes,
  edit,
  inspect,
}: {
  record: RecordState | { id: string; name: string };
  resource: string;
  writes: Writes;
  edit: () => void;
  inspect?: () => void;
}) {
  const archived =
    'recordStatus' in record && record.recordStatus === 'archived';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const target = `${resource}/${record.id}`;
  return (
    <div className={styles.actions}>
      {inspect && (
        <button type="button" onClick={inspect}>
          View holidays
        </button>
      )}
      <button type="button" onClick={edit} disabled={writes.busy}>
        Edit
      </button>
      {'recordStatus' in record && (
        <button
          type="button"
          disabled={writes.busy}
          onClick={() => {
            void writes.write(
              target,
              'PATCH',
              {
                recordStatus: archived ? 'active' : 'archived',
              },
              target,
            );
          }}
        >
          {archived ? 'Reactivate' : 'Archive'}
        </button>
      )}
      {confirmDelete ? (
        <>
          <button
            type="button"
            disabled={writes.busy}
            onClick={async () => {
              if (await writes.write(target, 'DELETE', undefined, target))
                setConfirmDelete(false);
            }}
          >
            Confirm delete
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            Cancel delete
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={writes.busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      )}
      <WriteError error={writes.errorFor(target)} />
    </div>
  );
}

function WriteError({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className={styles.error}>
      {error}
    </p>
  ) : null;
}

export function displayStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}
