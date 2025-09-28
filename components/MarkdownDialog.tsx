import React, { useEffect, useRef, useState } from 'react';

interface MarkdownDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string | null;
  initialValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  onClose: () => void;
  onConfirm?: (value: string) => boolean | void;
  showCopyButton?: boolean;
  onCopySuccess?: () => void;
}

const MarkdownDialog: React.FC<MarkdownDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  initialValue = '',
  placeholder = '',
  readOnly = false,
  onClose,
  onConfirm,
  showCopyButton = false,
  onCopySuccess,
}) => {
  const [value, setValue] = useState(initialValue);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setCopyStatus(null);
      setTimeout(() => {
        if (!readOnly) {
          textareaRef.current?.focus();
        } else {
          textareaRef.current?.select();
        }
      }, 50);
    }
  }, [initialValue, isOpen, readOnly]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (!onConfirm) {
      onClose();
      return;
    }

    const result = onConfirm(value);
    if (result !== false) {
      onClose();
    }
  };

  const handleCopy = async () => {
    if (typeof navigator === 'undefined') {
      setCopyStatus('Clipboard API is unavailable.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('Copied to clipboard.');
      onCopySuccess?.();
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (error) {
      console.error('Failed to copy markdown', error);
      setCopyStatus('Failed to copy. Try copying manually.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="markdown-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h2 id="markdown-dialog-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="h-64 w-full resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showCopyButton && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Copy to clipboard
              </button>
              {copyStatus && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{copyStatus}</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {cancelText !== null && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {cancelText}
              </button>
            )}
            {onConfirm ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {confirmText}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownDialog;
