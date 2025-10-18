import React from 'react';
import { XMarkIcon, ArrowUturnLeftIcon } from './icons';
import { HistoryEntry } from '../hooks/useOrganizerState';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryEntry[];
    onRevert: (historyId: number) => void;
}

const timeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    let interval = seconds / 60;
    if (interval < 1) return "à l'instant";
    if (interval < 60) return `il y a ${Math.floor(interval)} min`;
    interval = seconds / 3600;
    if (interval < 24) return `il y a ${Math.floor(interval)} h`;
    interval = seconds / 86400;
    return `il y a ${Math.floor(interval)} j`;
};

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onRevert }) => {
    if (!isOpen) return null;

    const handleRevertClick = (id: number) => {
        if (window.confirm("Êtes-vous sûr de vouloir revenir à cet état ? Toutes les actions ultérieures seront annulées.")) {
            onRevert(id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 flex flex-col max-h-[80vh]">
                <header className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold text-slate-800">Historique des Actions</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 overflow-y-auto">
                    {history.length > 0 ? (
                        <ul className="space-y-3">
                            {[...history].reverse().map(entry => (
                                <li key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group">
                                    <div>
                                        <p className="font-medium text-slate-800">{entry.message}</p>
                                        <p className="text-xs text-slate-500">{timeAgo(entry.id)}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleRevertClick(entry.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                        title="Revenir à cet état"
                                    >
                                        <ArrowUturnLeftIcon className="w-4 h-4" />
                                        Annuler
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-slate-500 py-10">Aucun historique d'actions disponible.</p>
                    )}
                </div>
                <footer className="p-4 bg-slate-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                        Fermer
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default HistoryModal;