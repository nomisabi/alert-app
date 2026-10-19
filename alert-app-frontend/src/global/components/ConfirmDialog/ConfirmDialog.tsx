import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Red confirm button, and Cancel gets the focus, so Enter doesn't destroy anything by accident. */
  destructive?: boolean;
  /** Shows a spinner on the confirm button and blocks closing while the action runs. */
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Asks "Are you sure?" before an action.
 *
 * @example
 * <ConfirmDialog open={open} title={t('x.title')} description={t('x.text')}
 *   confirmLabel={t('x.confirm')} destructive onConfirm={remove} onClose={() => setOpen(false)} />
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (!isPending) onClose();
  };

  return (
    <Dialog open={open} onClose={close} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={descriptionId}>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={isPending} autoFocus={destructive}>
          {t('actions.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          loading={isPending}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
