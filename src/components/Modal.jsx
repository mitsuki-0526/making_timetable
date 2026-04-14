import { useEffect } from "react";
import styles from "./Modal.module.css";

export default function Modal({
  title,
  onClose,
  children,
  footer,
  className = "",
  bodyClassName = "",
  disableOverlayClose = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="閉じる"
        className={styles.overlayButton}
        onClick={(e) => {
          if (e.target === e.currentTarget && !disableOverlayClose && onClose) {
            onClose();
          }
        }}
      />
      <div
        className={`${styles.dialog} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "20px", verticalAlign: "middle" }}
            >
              close
            </span>
          </button>
        </div>
        <div className={`${styles.body} ${bodyClassName}`.trim()}>
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

export function ModalTabs({ tabs, activeTab, onChange, className = "" }) {
  return (
    <div className={`${styles.tabList} ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`${styles.tabButton} ${
            activeTab === tab.id ? styles.tabButtonActive : ""
          }`.trim()}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
