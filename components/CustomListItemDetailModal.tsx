import React, { useState, useEffect } from 'react';
import { GenericItem, Project, CustomList } from '../types';
import { XMarkIcon, RectangleGroupIcon } from './icons';
import { ListType } from '../hooks/useOrganizerState';
import RichTextEditor from './RichTextEditor';

interface CustomListItemDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: GenericItem;
    list: CustomList;
    listId: string;
    projects: Project[];
    onNavigateToProject: (projectId: string) => void;
    onEditDetails: (listId: string, itemId: string, details: Partial<Pick<GenericItem, 'text' | 'description'>> & { customFields?: Record<string, string> }) => void;
    onLinkItem: (projectId: string, itemType: ListType, itemId: string) => void;
    onUnlinkItem: (itemType: ListType, itemId: string) => void;
}

const CustomListItemDetailModal: React.FC<CustomListItemDetailModalProps> = ({ isOpen, onClose, item, list, listId, projects, onNavigateToProject, onEditDetails, onLinkItem, onUnlinkItem }) => {
    const [localItem, setLocalItem] = useState(item);

    useEffect(() => {
        setLocalItem(item);
    }, [item]);

    const handleSave = () => {
        if (localItem.text.trim() === '') {
            // Prevent saving an empty title
            setLocalItem(prev => ({ ...prev, text: item.text }));
            return;
        }

        onEditDetails(listId, item.id, {
            text: localItem.text,
            description: localItem.description,
            customFields: localItem.customFields
        });
        
        onClose();
    };
    
    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setLocalItem(prev => ({
            ...prev,
            customFields: {
                ...prev.customFields,
                [fieldId]: value
            }
        }));
    };

    const project = item.projectId ? projects.find(p => p.id === item.projectId) : null;
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <header className="flex items-start justify-between p-6 border-b">
                     <input
                        type="text"
                        value={localItem.text}
                        onChange={(e) => setLocalItem(prev => ({ ...prev, text: e.target.value }))}
                        className="text-2xl font-bold text-slate-800 w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded p-1 -m-1"
                    />
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 ml-4">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Projet</label>
                        {project ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => onNavigateToProject(project.id)} className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1 transition-colors">
                                    <RectangleGroupIcon className="w-4 h-4" />
                                    <span className="font-semibold">{project.title}</span>
                                </button>
                                <button onClick={() => onUnlinkItem('custom', item.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onLinkItem(e.target.value, 'custom', item.id);
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
                        <div className="h-48 flex flex-col">
                            <RichTextEditor
                                initialContent={localItem.description ?? ''}
                                onContentChange={(newContent) => setLocalItem(prev => ({ ...prev, description: newContent }))}
                            />
                        </div>
                    </div>
                    
                    {list.fields.length > 0 && (
                        <div className="space-y-4 pt-6 border-t">
                            <h3 className="text-lg font-semibold text-slate-700">Details</h3>
                            {list.fields.map(field => (
                                <div key={field.id}>
                                    <label htmlFor={`custom-field-${field.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                                        {field.name}
                                    </label>
                                    <input
                                        type="text"
                                        id={`custom-field-${field.id}`}
                                        value={localItem.customFields[field.id] || ''}
                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
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

export default CustomListItemDetailModal;