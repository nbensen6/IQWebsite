import { useState, useCallback } from 'react';

export function useConfirm() {
  const [state, setState] = useState({ open: false, title: '', message: '', variant: 'danger', resolve: null });

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message,
        title: options.title || 'Confirm',
        variant: options.variant || 'danger',
        confirmText: options.confirmText || 'Delete',
        cancelText: options.cancelText || 'Cancel',
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  }, [state.resolve]);

  return {
    confirm,
    confirmDialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      variant: state.variant,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      onConfirm: handleConfirm,
      onCancel: handleCancel
    }
  };
}

export function useAlert() {
  const [state, setState] = useState({ open: false, title: '', message: '', variant: 'error', resolve: null });

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        message,
        title: options.title || '',
        variant: options.variant || 'error',
        resolve
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    state.resolve?.();
    setState(s => ({ ...s, open: false }));
  }, [state.resolve]);

  return {
    showAlert,
    alertDialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      variant: state.variant,
      onClose: handleClose
    }
  };
}
