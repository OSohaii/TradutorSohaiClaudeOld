import React from 'react';

/**
 * Small read-only badge displaying the running app version.
 *
 * The version string comes from `__APP_VERSION__`, a build-time constant
 * that Vite substitutes from package.json (see vite.config.ts +
 * vite-env.d.ts). Keeping this in a single component lets us restyle or
 * relocate the badge across the UI without hunting down call sites.
 *
 * Two visual variants:
 * - default: pill-style badge with subtle indigo accent (sidebar)
 * - subtle: tiny grey caption that hugs another element (mobile top bar)
 */
export type VersionBadgeVariant = 'default' | 'subtle';

interface VersionBadgeProps {
  /** Visual variant. Defaults to 'default' (pill). */
  variant?: VersionBadgeVariant;
  /** Optional extra classes appended to the badge. */
  className?: string;
}

const VersionBadge: React.FC<VersionBadgeProps> = ({ variant = 'default', className = '' }) => {
  const text = `v${__APP_VERSION__}`;
  if (variant === 'subtle') {
    return (
      <span
        className={`text-[10px] font-mono text-slate-500 ${className}`}
        title={`Versao ${text}`}
      >
        {text}
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] font-mono font-semibold text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 leading-none ${className}`}
      title={`Versao ${text}`}
    >
      {text}
    </span>
  );
};

export default VersionBadge;
