import { useEffect, useRef, type ComponentProps } from 'react';

export function SavedNumberInput({
  savedValue,
  ...props
}: Omit<ComponentProps<'input'>, 'defaultValue' | 'type' | 'value' | 'ref'> & {
  savedValue: number | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const value = savedValue === null ? '' : String(savedValue);

  useEffect(() => {
    if (input.current) input.current.value = value;
  }, [value]);

  return <input {...props} ref={input} type="number" defaultValue={value} />;
}
