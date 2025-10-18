import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, SelectionState, Priority, TodoItem, ShoppingItem, NoteItem, CustomList } from '../types';
import { TrashIcon, CheckIcon, LinkIcon, XMarkIcon, SignalIcon, CalendarIcon, BuildingStorefrontIcon, ArrowsPointingInIcon, ClipboardIcon } from './icons';

interface SelectionActionBarProps {
    selection: SelectionState;
    selectedIds: Set<string>;
    projects: Project[];
    todos: TodoItem[];
    shoppingList: ShoppingItem[];
    notes: NoteItem[];
    customLists: CustomList[];
    onDelete: () => void;
    onToggleCompleted: () => void;
    onLinkToProject: (projectId: string) => void;
    onSetPriority: (priority: Priority) => void;
    onSetDueDate: (dueDate: string | null) => void;
    onSetStore: (store: string) => void;
    onMergeNotes: () => void;
    onClose: () => void;
}

const SelectionActionBar: React.FC<SelectionActionBarProps> = ({ 
    selection, selectedIds, projects, todos, shoppingList, notes, customLists,
    onDelete, onToggleCompleted, onLinkToProject, onSetPriority, onSetDueDate, onSetStore, onMergeNotes, onClose 
}) => {
    const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
    const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
    const [isStoreInputOpen, setIsStoreInputOpen] = useState(false);
    const [storeName, setStoreName] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);
    
    const menuRef = useRef<HTMLDivElement>(null);
    const count = selectedIds.size;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsLinkMenuOpen(false);
                setIsPriorityMenuOpen(false);
                setIsStoreInputOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const allStores = useMemo(() => {
        const storeSet = new Set<string>();
        shoppingList.forEach(item => {
            if (item.store) {
                storeSet.add(item.store);
            }
        });
        return Array.from(storeSet).sort();
    }, [shoppingList]);

    const storeSuggestions = useMemo(() => {
        if (!storeName.trim()) {
            return [];
        }
        return allStores.filter(store =>
            store.toLowerCase().startsWith(storeName.toLowerCase())
        );
    }, [storeName, allStores]);


    const handleLinkSelect = (projectId: string) => {
        onLinkToProject(projectId);
        setIsLinkMenuOpen(false);
    };

    const handlePrioritySelect = (priority: Priority) => {
        onSetPriority(priority);
        setIsPriorityMenuOpen(false);
    };
    
    const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSetDueDate(e.target.value || null);
    };

    const handleStoreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSetStore(storeName);
        setIsStoreInputOpen(false);
        setStoreName('');
    };

    const handleStoreSuggestionClick = (store: string) => {
        onSetStore(store);
        setIsStoreInputOpen(false);
        setStoreName('');
    };

    const handleCopyToClipboard = () => {
        let textToCopy = '';
        if (selection.type === 'todos') {
            textToCopy = todos.filter(i => selectedIds.has(i.id)).map(i => i.task).join('\n');
        } else if (selection.type === 'shopping') {
            textToCopy = shoppingList.filter(i => selectedIds.has(i.id)).map(i => i.item).join('\n');
        } else if (selection.type === 'notes') {
            textToCopy = notes.filter(i => selectedIds.has(i.id)).map(i => i.content.replace(/<[^>]+>/g, ' ')).join('\n\n---\n\n');
        } else if (selection.type === 'custom' && selection.listId) {
            const list = customLists.find(l => l.id === selection.listId);
            if (list) {
                textToCopy = list.items.filter(i => selectedIds.has(i.id)).map(i => i.text).join('\n');
            }
        }

        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            });
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-800 text-white shadow-lg animate-fade-in-up">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <span className="font-bold text-lg">{count} élément{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1 sm:gap-2" ref={menuRef}>
                        {/* Generic Actions */}
                        <button onClick={handleCopyToClipboard} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title={copySuccess ? "Copié!" : "Copier le texte"}>
                            {copySuccess ? <CheckIcon className="w-6 h-6 text-green-400" /> : <ClipboardIcon className="w-6 h-6" />}
                        </button>
                        <div className="relative">
                            <button onClick={() => setIsLinkMenuOpen(prev => !prev)} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title="Lier à un projet">
                                <LinkIcon className="w-6 h-6" />
                            </button>
                            {isLinkMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 text-slate-800">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500">Choisir un projet</div>
                                    {projects.length > 0 ? projects.map(p => (
                                        <button key={p.id} onClick={() => handleLinkSelect(p.id)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100">{p.title}</button>
                                    )) : <div className="px-4 py-2 text-sm text-slate-500">Aucun projet créé.</div>}
                                </div>
                            )}
                        </div>
                        {selection.type !== 'notes' && (
                            <button onClick={onToggleCompleted} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title="Cocher / Décocher">
                                <CheckIcon className="w-6 h-6" />
                            </button>
                        )}
                        {/* Type-specific Actions */}
                        {selection.type === 'todos' && (
                            <>
                                <div className="relative">
                                    <button onClick={() => setIsPriorityMenuOpen(p => !p)} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title="Définir la priorité"><SignalIcon className="w-6 h-6" /></button>
                                    {isPriorityMenuOpen && (
                                         <div className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-lg shadow-xl py-1 z-20 text-slate-800">
                                            <button onClick={() => handlePrioritySelect(Priority.High)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100">Haute</button>
                                            <button onClick={() => handlePrioritySelect(Priority.Medium)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100">Moyenne</button>
                                            <button onClick={() => handlePrioritySelect(Priority.Low)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100">Basse</button>
                                         </div>
                                    )}
                                </div>
                                <label className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors cursor-pointer" title="Définir la date limite">
                                    <CalendarIcon className="w-6 h-6" />
                                    <input type="date" onChange={handleDueDateChange} className="absolute opacity-0 w-0 h-0" />
                                </label>
                            </>
                        )}
                        {selection.type === 'shopping' && (
                            <div className="relative">
                                <button onClick={() => setIsStoreInputOpen(p => !p)} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title="Assigner un magasin"><BuildingStorefrontIcon className="w-6 h-6" /></button>
                                {isStoreInputOpen && (
                                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-lg shadow-xl p-2 z-20 text-slate-800">
                                        <form onSubmit={handleStoreSubmit} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={storeName} 
                                                onChange={e => setStoreName(e.target.value)} 
                                                placeholder="Nom du magasin" 
                                                className="w-full p-1 border-b-2 focus:outline-none focus:border-indigo-500" 
                                                autoFocus 
                                            />
                                            <button type="submit" className="px-2 py-1 bg-indigo-600 text-white text-sm rounded">OK</button>
                                        </form>
                                        {storeSuggestions.length > 0 && (
                                            <ul className="mt-2 border-t pt-1 max-h-32 overflow-y-auto">
                                                {storeSuggestions.map(store => (
                                                    <li key={store}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStoreSuggestionClick(store)}
                                                        className="w-full text-left px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded"
                                                    >
                                                        {store}
                                                    </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {selection.type === 'notes' && selectedIds.size > 1 && (
                             <button onClick={onMergeNotes} className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors" title="Fusionner les notes"><ArrowsPointingInIcon className="w-6 h-6" /></button>
                        )}
                        {/* Final Actions */}
                        <button onClick={onDelete} className="flex items-center justify-center w-12 h-12 bg-red-600 rounded-full hover:bg-red-700 transition-colors" title="Supprimer la sélection">
                            <TrashIcon className="w-6 h-6" />
                        </button>
                        <div className="w-px h-8 bg-slate-600 mx-1 sm:mx-2"></div>
                        <button onClick={onClose} className="px-4 py-2 font-semibold bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300">
                            Terminé
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SelectionActionBar;