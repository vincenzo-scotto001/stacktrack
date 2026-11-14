import React from 'react';
import { AlertCircle } from 'lucide-react';

export function Loader({ label = 'Loading' }) {
  return (
    <div className="loader" role="status">
      <span className="loader-chip" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Loader />
    </div>
  );
}

export function Skeleton({ rows = 3, height = 56 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <p>{error?.message || String(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRetry()}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
