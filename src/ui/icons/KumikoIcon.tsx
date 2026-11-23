import { kumikoIcons, type KumikoIconName } from './kumiko-icons';
import type { CSSProperties } from 'react';
export function KumikoIcon({
  name,
  size = 20,
  color,
  className,
  label,
}: {
  name: KumikoIconName;
  size?: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="miter"
      strokeMiterlimit={10}
      strokeLinecap="butt"
      className={className}
      style={{ color, flexShrink: 0 } as CSSProperties}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: kumikoIcons[name] }}
    />
  );
}
