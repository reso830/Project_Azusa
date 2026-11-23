import styles from './shell.module.css';
export function AsanohaBackground({ id = 'asanoha-page' }: { id?: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="asanoha-background"
      className={styles.lattice}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={id}
            width="28"
            height="48.5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0L28 0M0 0L14 24.2M28 0L14 24.2M0 48.5L14 24.2M28 48.5L14 24.2M0 48.5L28 48.5M14 8.1L0 0M14 8.1L28 0M14 8.1L14 24.2M14 40.4L0 48.5M14 40.4L28 48.5M14 40.4L14 24.2M0 16.2L0 0M0 16.2L14 24.2M0 16.2L-14 24.2M28 16.2L28 0M28 16.2L14 24.2M28 16.2L42 24.2M0 32.3L0 48.5M0 32.3L14 24.2M0 32.3L-14 24.2M28 32.3L28 48.5M28 32.3L14 24.2M28 32.3L42 24.2M-14 24.2L14 24.2M14 24.2L42 24.2"
              fill="none"
              stroke="#E2D9CC"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
