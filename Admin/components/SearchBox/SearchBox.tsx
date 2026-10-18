import type { ChangeEventHandler } from 'react';
import styles from './SearchBox.module.css';

export type SearchBoxVariant = 'default' | 'admin';

type SearchBoxProps = {
  placeholder: string;
  ariaLabel: string;
  className?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** `admin` — компактное поле как AdminTextField (h-28, hairline). */
  variant?: SearchBoxVariant;
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9.58329 17.5C13.9555 17.5 17.5 13.9556 17.5 9.58333C17.5 5.21108 13.9555 1.66667 9.58329 1.66667C5.21104 1.66667 1.66663 5.21108 1.66663 9.58333C1.66663 13.9556 5.21104 17.5 9.58329 17.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.3333 18.3333L16.6666 16.6667"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchBox({
  placeholder,
  ariaLabel,
  className,
  value,
  onChange,
  variant = 'default',
}: SearchBoxProps) {
  const isAdmin = variant === 'admin';
  const rootClass = isAdmin ? styles.searchBoxAdmin : styles.searchBoxInner;
  const rowClass = isAdmin ? styles.searchRowAdmin : styles.searchRow;
  const iconClass = isAdmin ? styles.searchIconAdmin : styles.searchIcon;
  const inputClass = isAdmin ? styles.searchInputAdmin : styles.searchInput;

  return (
    <div className={`${rootClass} ${className ?? ''}`.trim()}>
      <div className={rowClass}>
        <SearchIcon className={iconClass} />
        <input
          type="search"
          className={inputClass}
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

/** SearchBox в стиле AdminTextField для админ-панели. */
export function AdminSearchBox(props: Omit<SearchBoxProps, 'variant'>) {
  return <SearchBox {...props} variant="admin" />;
}
