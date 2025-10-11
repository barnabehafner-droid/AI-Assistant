import React from 'react';
import { XMarkIcon, ArrowUturnLeftIcon, RectangleGroupIcon } from './icons';
import { FullEmail, Project } from '../types';
// FIX: Import AllItemTypes from types.ts where it is exported, not from useOrganizerState.ts.
import { AllItemTypes } from '../types';

interface EmailDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: FullEmail | null;
  onReply: (email: FullEmail) => void;
  projects: Project[];
  onLinkItem: (projectId: string, itemType: AllItemTypes, itemId: string) => void;
  onUnlinkItem: (itemType: AllItemTypes, itemId: string) => void;
}

const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ isOpen, onClose, email, onReply, projects, onLinkItem, onUnlinkItem }) => {
  if (!isOpen || !email) {
    return null;
  }

  const project = projects.find(p => p.linkedItemIds.linkedEmailIds?.includes(email.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl m-4 flex flex-col max-h-[80vh] animate-fade-in">
        <header className="flex-shrink-0 p-6 border-b">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{email.subject}</h2>
                    <p className="text-sm text-slate-600 mt-1">
                        <strong>De :</strong> {email.from}
                    </p>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800 ml-4">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
        </header>
        <div className="flex-grow overflow-y-auto p-6">
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-500 mb-1">Projet</label>
                {project ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-full px-3 py-1">
                            <RectangleGroupIcon className="w-4 h-4" />
                            <span className="font-semibold">{project.title}</span>
                        </div>
                        <button onClick={() => onUnlinkItem('email', email.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <select
                        value=""
                        onChange={(e) => { if (e.target.value) { onLinkItem(e.target.value, 'email', email.id); } }}
                        className="max-w-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    >
                        <option value="" disabled>Lier à un projet...</option>
                        {projects.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
                    </select>
                )}
            </div>
            {email.aiSummary && (
                <div className="mb-6 pb-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Résumé IA</h3>
                    <p className="text-slate-700 italic">{email.aiSummary}</p>
                </div>
            )}
            <div className="text-slate-800" dangerouslySetInnerHTML={{ __html: email.body }}>
            </div>
        </div>
        <footer className="p-4 bg-slate-50 border-t flex justify-end">
            <button 
                onClick={() => onReply(email)}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
            >
                <ArrowUturnLeftIcon className="w-5 h-5"/>
                Répondre
            </button>
        </footer>
      </div>
    </div>
  );
};

export default EmailDetailModal;
