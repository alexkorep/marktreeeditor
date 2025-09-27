import React, { useState, useEffect, useRef } from 'react';

interface TextInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue: string) => void;
  title: string;
  confirmText?: string;
  initialValue?: string;
  placeholder?: string;
}

const TextInputDialog: React.FC<TextInputDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmText = 'Confirm',
  initialValue = '',
  placeholder = '',
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || 'New Document.md');
      // Auto-focus the input when the dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <h2 id="dialog-title" className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">{title}</h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="File name"
        />
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextInputDialog;
