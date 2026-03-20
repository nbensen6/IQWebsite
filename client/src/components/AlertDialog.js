import React, { useEffect, useRef } from 'react';

function AlertDialog({ open, title, message, buttonText = 'OK', variant = 'error', onClose }) {
  const dialogRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      btnRef.current?.focus();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) onClose();
  };

  const iconMap = {
    error: '⚠️',
    info: 'ℹ️',
    success: '✅'
  };

  return (
    <dialog ref={dialogRef} className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-dialog">
        <h3 className="confirm-dialog-title">
          {iconMap[variant] || ''} {title || (variant === 'error' ? 'Error' : 'Notice')}
        </h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button ref={btnRef} className="confirm-dialog-btn confirm-dialog-btn-primary" onClick={onClose}>
            {buttonText}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default AlertDialog;
