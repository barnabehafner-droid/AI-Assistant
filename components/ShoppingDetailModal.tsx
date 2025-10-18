import React, { useState, useEffect, useRef } from 'react';
import { ShoppingItem, ShoppingUnit, Project } from '../types';
import { XMarkIcon, RectangleGroupIcon } from './icons';
import { ListType } from '../hooks/useOrganizerState';
import RichTextEditor from './RichTextEditor';

interface ShoppingDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: ShoppingItem;
    projects: Project[];
    onNavigateToProject: (projectId: string) => void;
    onEditItem: (id: string, newItemName: string) => void;
    onEditDetails: (id: string, details: Partial<Pick<ShoppingItem, 'quantity' | 'unit' | 'store' | 'description'>>) => void;
    onLinkItem: (projectId: string, itemType: ListType, itemId: string) => void;
    onUnlinkItem: (itemType: ListType, itemId: string) => void;
    mapsApiLoaded: boolean;
}

const ShoppingDetailModal: React.FC<ShoppingDetailModalProps> = ({ isOpen, onClose, item, projects, onNavigateToProject, onEditItem, onEditDetails, onLinkItem, onUnlinkItem, mapsApiLoaded }) => {
    const [localItem, setLocalItem] = useState(item);
    const storeInputRef = useRef<HTMLInputElement>(null);
    // FIX: Replace google.maps.places.Autocomplete with 'any' to avoid type errors when @types/google.maps is not found.
    const autocompleteRef = useRef<any | null>(null);

    useEffect(() => {
        setLocalItem(item);
    }, [item]);

    useEffect(() => {
        if (isOpen && mapsApiLoaded && storeInputRef.current && !autocompleteRef.current) {
            // FIX: Cast window to any to access google.maps, which may not be on the window type.
            const autocomplete = new (window as any).google.maps.places.Autocomplete(storeInputRef.current, {
                fields: ["name"],
                types: ["establishment"],
            });
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (place.name) {
                    setLocalItem(prev => ({ ...prev, store: place.name }));
                }
            });
            autocompleteRef.current = autocomplete;
        }
    }, [isOpen, mapsApiLoaded]);

    const handleSave = () => {
        // Only call update functions if there are actual changes
        if (localItem.item !== item.item) {
            onEditItem(item.id, localItem.item);
        }
        if (
            localItem.quantity !== item.quantity ||
            localItem.unit !== item.unit ||
            localItem.store !== item.store ||
            localItem.description !== item.description
        ) {
            onEditDetails(item.id, {
                quantity: localItem.quantity,
                unit: localItem.unit,
                store: localItem.store,
                description: localItem.description,
            });
        }
        onClose();
    };

    const project = item.projectId ? projects.find(p => p.id === item.projectId) : null;
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <header className="flex items-start justify-between p-6 border-b">
                     <input
                        type="text"
                        value={localItem.item}
                        onChange={(e) => setLocalItem(prev => ({ ...prev, item: e.target.value }))}
                        className="text-2xl font-bold text-slate-800 w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded p-1 -m-1"
                    />
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 ml-4">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-slate-500 mb-1">Quantité</label>
                            <div className="flex">
                                <input
                                    type="number"
                                    id="quantity"
                                    value={localItem.quantity ?? ''}
                                    onChange={(e) => setLocalItem(prev => ({ ...prev, quantity: e.target.value ? parseFloat(e.target.value) : null }))}
                                    placeholder="Ex: 2"
                                    className="w-2/3 p-2 border border-slate-200 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                />
                                <select 
                                    value={localItem.unit ?? ''}
                                    onChange={(e) => setLocalItem(prev => ({ ...prev, unit: e.target.value as ShoppingUnit || null }))}
                                    className="w-1/3 p-2 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                >
                                    <option value="">(unité)</option>
                                    <option value={ShoppingUnit.Unit}>unité(s)</option>
                                    <option value={ShoppingUnit.Kg}>kg</option>
                                    <option value={ShoppingUnit.L}>L</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="store" className="block text-sm font-medium text-slate-500 mb-1">Magasin</label>
                            <input
                                ref={storeInputRef}
                                type="text"
                                id="store"
                                value={localItem.store ?? ''}
                                onChange={(e) => setLocalItem(prev => ({ ...prev, store: e.target.value }))}
                                placeholder="Ex: Super U"
                                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Projet</label>
                        {project ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => onNavigateToProject(project.id)} className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1 transition-colors">
                                    <RectangleGroupIcon className="w-4 h-4" />
                                    <span className="font-semibold">{project.title}</span>
                                </button>
                                <button onClick={() => onUnlinkItem('shopping', item.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onLinkItem(e.target.value, 'shopping', item.id);
                                    }
                                }}
                                className="max-w-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            >
                                <option value="" disabled>Lier à un projet...</option>
                                {projects.filter(p => p.id !== item.projectId).map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <div className="h-40 flex flex-col">
                             <RichTextEditor
                                initialContent={localItem.description ?? ''}
                                onContentChange={(newContent) => setLocalItem(prev => ({ ...prev, description: newContent }))}
                            />
                        </div>
                    </div>
                </div>

                <footer className="p-4 bg-slate-50 border-t flex justify-end">
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                        Enregistrer et Fermer
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ShoppingDetailModal;