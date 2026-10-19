import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Loading.module.scss';

interface LoadingProps {
  /** Centers the spinner in the whole content area (e.g. while a page loads). */
  fullPage?: boolean;
  /** Milliseconds to wait before showing the spinner, so fast loads don't flash it. */
  delay?: number;
}

export function Loading({ fullPage = false, delay = 300 }: LoadingProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;

    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className={fullPage ? styles.fullPage : styles.inline}>
      {/* CircularProgress has role="progressbar"; the label is what screen readers announce */}
      <CircularProgress size={fullPage ? 48 : 24} aria-label={t('loading')} />
    </div>
  );
}
