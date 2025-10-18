import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ArrowUturnLeftIcon, RectangleGroupIcon, ArchiveBoxIcon, ChevronDownIcon } from './icons';
import { FullEmail, Project, GmailLabel } from '../types';
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
  gmailLabels: GmailLabel[];
  onMoveEmail: (emailId: string, newLabelId: string) => void;
}

const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ isOpen, onClose, email, onReply, projects, onLinkItem, onUnlinkItem, gmailLabels, onMoveEmail }) => {
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(event.target as Node)) {
        setIsMoveMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen || !email) {
    return null;
  }

  const project = projects.find(p => p.linkedItemIds.linkedEmailIds?.includes(email.id));

  const userLabels = gmailLabels.filter(label => label.type === 'user');
  const trashLabel = gmailLabels.find(label => label.id === 'TRASH');

  const handleMove = (labelId: string) => {
    onMoveEmail(email.id, labelId);
    setIsMoveMenuOpen(false);
  };
  
  const handleArchive = () => {
    // Archiving means removing the INBOX label. No label is added.
    onMoveEmail(email.id, '');
  };

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
            {/* FIX: Use `bodyHtml` instead of `body` which does not exist on FullEmail type. `dangerouslySetInnerHTML` requires an HTML string. */}
            <div className="text-slate-800" dangerouslySetInnerHTML={{ __html: email.bodyHtml }}>
            </div>
        </div>
        <footer className="p-4 bg-slate-50 border-t flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="relative" ref={moveMenuRef}>
                    <button
                        onClick={() => setIsMoveMenuOpen(prev => !prev)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors text-sm"
                    >
                        <span>Déplacer vers</span>
                        <ChevronDownIcon className="w-4 h-4"/>
                    </button>
                    {isMoveMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 border max-h-60 overflow-y-auto">
                            {trashLabel && (
                                <button onClick={() => handleMove(trashLabel.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                    Corbeille
                                </button>
                            )}
                            {userLabels.length > 0 && <div className="my-1 h-px bg-slate-200"></div>}
                            {userLabels.map(label => (
                                <button key={label.id} onClick={() => handleMove(label.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 truncate">
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleArchive}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors text-sm"
                >
                    <ArchiveBoxIcon className="w-5 h-5"/>
                    <span>Archiver</span>
                </button>
            </div>

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