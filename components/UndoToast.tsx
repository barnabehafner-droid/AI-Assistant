import React, { useEffect, useState } from 'react';
import { XMarkIcon, ArrowUturnLeftIcon } from './icons';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onClose: () => void;
  duration?: number;
}

const UndoToast: React.FC<UndoToastProps> = ({ message, onUndo, onClose, duration = 5000 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  const handleClose = () => {
    setVisible(false);
    // Allow animation to finish before calling onClose
    setTimeout(onClose, 300);
  };

  const handleUndo = () => {
    onUndo();
    handleClose();
  };

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-4 w-full max-w-md p-4 bg-slate-800 text-white rounded-lg shadow-2xl transition-all duration-300 ease-in-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
      role="alert"
    >
      <span className="flex-grow">{message}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
        >
          <ArrowUturnLeftIcon className="w-4 h-4" />
          Annuler
        </button>
        <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-slate-700 transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default UndoToast;
