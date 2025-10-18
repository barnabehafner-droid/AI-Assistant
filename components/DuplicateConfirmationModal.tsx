import React from 'react';

interface DuplicateConfirmationModalProps {
  isOpen: boolean;
  newItemText: string;
  existingItemText: string;
  onConfirmAdd: () => void;
  onSkipAndContinue: () => void;
  onCancel: () => void;
}

const DuplicateConfirmationModal: React.FC<DuplicateConfirmationModalProps> = ({
  isOpen,
  newItemText,
  existingItemText,
  onConfirmAdd,
  onSkipAndContinue,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 p-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Duplicate Item?</h2>
        <p className="text-slate-600 mb-2">
          It looks like you already have an item similar to <strong className="text-indigo-600">"{newItemText}"</strong>:
        </p>
        <p className="text-slate-800 font-semibold bg-slate-100 p-3 rounded-md mb-6">
          "{existingItemText}"
        </p>
        <p className="text-slate-600 mb-6">What would you like to do?</p>
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 order-3 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={onSkipAndContinue}
            className="px-4 py-2 rounded-lg text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 order-2 sm:order-2"
          >
            Skip Duplicate
          </button>
          <button
            onClick={onConfirmAdd}
            className="px-4 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 order-1 sm:order-3"
          >
            Add Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateConfirmationModal;