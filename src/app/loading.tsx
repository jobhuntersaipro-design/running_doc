import styles from "./loading.module.css";

/** Shown while any page loads. It waits 250 ms before appearing, so fast loads never flash. */
export default function Loading() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.bar} aria-hidden="true" />
      <span className={styles.runner} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={styles.label}>Loading</span>
    </div>
  );
}
