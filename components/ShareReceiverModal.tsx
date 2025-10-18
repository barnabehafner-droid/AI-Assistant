import React from 'react';
import { XMarkIcon, SparklesIcon, LoaderIcon } from './icons';

interface ShareReceiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedData: {
    title?: string;
    text?: string;
    url?: string;
  };
  aiSuggestion: string;
  isLoadingSuggestion: boolean;
  onConfirm: () => void;
  onAddToInput: () => void;
}

const ShareReceiverModal: React.FC<ShareReceiverModalProps> = ({
  isOpen,
  onClose,
  sharedData,
  aiSuggestion,
  isLoadingSuggestion,
  onConfirm,
  onAddToInput,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 flex flex-col max-h-[90vh] animate-fade-in">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Contenu Partagé</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto space-y-4">
          {sharedData.title && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Titre</label>
              <p className="p-2 bg-slate-100 rounded-md mt-1">{sharedData.title}</p>
            </div>
          )}
          {sharedData.url && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">URL</label>
              <p className="p-2 bg-slate-100 rounded-md mt-1 truncate">
                <a href={sharedData.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{sharedData.url}</a>
              </p>
            </div>
          )}
          {sharedData.text && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Texte</label>
              <p className="p-2 bg-slate-100 rounded-md mt-1 max-h-32 overflow-y-auto">{sharedData.text}</p>
            </div>
          )}
        </div>
        <footer className="p-4 bg-slate-50 border-t space-y-3">
          <button
            onClick={onConfirm}
            disabled={isLoadingSuggestion}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {isLoadingSuggestion ? (
              <LoaderIcon className="w-5 h-5" />
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                <span>{aiSuggestion}</span>
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            <hr className="flex-grow border-slate-200" />
            <span className="text-slate-500 text-xs font-semibold">OU</span>
            <hr className="flex-grow border-slate-200" />
          </div>
          <button
            onClick={onAddToInput}
            className="w-full px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
          >
            Ajouter à la barre de saisie
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ShareReceiverModal;