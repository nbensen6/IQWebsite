import React, { useEffect, useRef } from 'react';

function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      confirmBtnRef.current?.focus();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e) => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) onCancel();
  };

  const btnClass = variant === 'danger' ? 'confirm-dialog-btn-danger' : 'confirm-dialog-btn-primary';

  return (
    <dialog ref={dialogRef} className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-dialog">
        <h3 className="confirm-dialog-title">{title || 'Confirm'}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-btn confirm-dialog-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button ref={confirmBtnRef} className={`confirm-dialog-btn ${btnClass}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default ConfirmDialog;
