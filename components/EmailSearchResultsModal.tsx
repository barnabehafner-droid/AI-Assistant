import React from 'react';
import { XMarkIcon } from './icons';
import { FullEmail } from '../types';

interface EmailSearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: FullEmail[];
  onSelectEmail: (emailId: string) => void;
}

const EmailSearchResultsModal: React.FC<EmailSearchResultsModalProps> = ({ isOpen, onClose, emails, onSelectEmail }) => {
  if (!isOpen) {
    return null;
  }

  const handleSelect = (emailId: string) => {
    onSelectEmail(emailId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl m-4 p-6 flex flex-col max-h-[80vh] animate-fade-in">
        <header className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Résultats de la recherche</h2>
             <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                <XMarkIcon className="w-6 h-6" />
            </button>
        </header>
        <div className="flex-grow overflow-y-auto pr-2 -mr-4">
            {emails.length > 0 ? (
                <ul className="space-y-3">
                    {emails.map(email => (
                        <li key={email.id}>
                            <button onClick={() => handleSelect(email.id)} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                                <div className="font-semibold text-slate-800 truncate">{email.from}</div>
                                <div className="font-bold text-indigo-700 truncate">{email.subject}</div>
                                <p className="text-sm text-slate-600 truncate mt-1">{email.snippet}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-center text-slate-500 py-10">Aucun e-mail trouvé.</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default EmailSearchResultsModal;