import React, { useState, useEffect } from 'react';
import { Project, TodoItem, ShoppingItem, NoteItem, CustomList } from '../types';
import { XMarkIcon } from './icons';

interface LinkItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onUpdateLinks: (projectId: string, linkedItemIds: Project['linkedItemIds']) => void;
  todos: TodoItem[];
  shoppingList: ShoppingItem[];
  notes: NoteItem[];
  customLists: CustomList[];
}

const LinkItemsModal: React.FC<LinkItemsModalProps> = ({ 
    isOpen, onClose, project, onUpdateLinks, 
    todos, shoppingList, notes, customLists 
}) => {
  
  const [linkedItems, setLinkedItems] = useState<Project['linkedItemIds']>({
    todoIds: [], shoppingItemIds: [], noteIds: [], customListItemIds: {}
  });

  useEffect(() => {
    if (project) {
      setLinkedItems(project.linkedItemIds);
    } else {
      // Reset when no project is selected
      setLinkedItems({ todoIds: [], shoppingItemIds: [], noteIds: [], customListItemIds: {} });
    }
  }, [project]);

  const handleToggle = (type: 'todo' | 'shopping' | 'note' | 'custom', itemId: string, listId?: string) => {
    setLinkedItems(prev => {
        const newLinked = { ...prev };
        switch (type) {
            case 'todo':
                newLinked.todoIds = newLinked.todoIds.includes(itemId) ? newLinked.todoIds.filter(id => id !== itemId) : [...newLinked.todoIds, itemId];
                break;
            case 'shopping':
                newLinked.shoppingItemIds = newLinked.shoppingItemIds.includes(itemId) ? newLinked.shoppingItemIds.filter(id => id !== itemId) : [...newLinked.shoppingItemIds, itemId];
                break;
            case 'note':
                 newLinked.noteIds = newLinked.noteIds.includes(itemId) ? newLinked.noteIds.filter(id => id !== itemId) : [...newLinked.noteIds, itemId];
                break;
            case 'custom':
                 const newCustomIds = { ...newLinked.customListItemIds };
                 if (newCustomIds[itemId]) {
                     delete newCustomIds[itemId];
                 } else if (listId) {
                     newCustomIds[itemId] = listId;
                 }
                 newLinked.customListItemIds = newCustomIds;
                break;
        }
        return newLinked;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (project) {
        onUpdateLinks(project.id, linkedItems);
    }
    onClose();
  };
  
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col h-[90vh]">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800 truncate">Lier des éléments à "{project.title}"</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            
            <section>
              <h3 className="font-bold text-slate-700 mb-2">Tâches</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-slate-50">
                {todos.map(item => (
                    <div key={item.id} className="flex items-center">
                        <input id={`link-t-${item.id}`} type="checkbox" checked={linkedItems.todoIds.includes(item.id)} onChange={() => handleToggle('todo', item.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <label htmlFor={`link-t-${item.id}`} className="ml-2 block text-sm text-slate-900 truncate">{item.task}</label>
                    </div>
                ))}
              </div>
            </section>
            
            <section>
              <h3 className="font-bold text-slate-700 mb-2">Articles de courses</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-slate-50">
                {shoppingList.map(item => (
                    <div key={item.id} className="flex items-center">
                        <input id={`link-s-${item.id}`} type="checkbox" checked={linkedItems.shoppingItemIds.includes(item.id)} onChange={() => handleToggle('shopping', item.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <label htmlFor={`link-s-${item.id}`} className="ml-2 block text-sm text-slate-900 truncate">{item.item}</label>
                    </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-bold text-slate-700 mb-2">Notes</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-slate-50">
                {notes.map(item => (
                    <div key={item.id} className="flex items-center">
                        <input id={`link-n-${item.id}`} type="checkbox" checked={linkedItems.noteIds.includes(item.id)} onChange={() => handleToggle('note', item.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <label htmlFor={`link-n-${item.id}`} className="ml-2 block text-sm text-slate-900 truncate">{item.content}</label>
                    </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-bold text-slate-700 mb-2">Éléments de listes personnalisées</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-slate-50">
                {customLists.map(list => list.items.map(item => (
                    <div key={item.id} className="flex items-center">
                        <input id={`link-c-${item.id}`} type="checkbox" checked={!!linkedItems.customListItemIds[item.id]} onChange={() => handleToggle('custom', item.id, list.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                        <label htmlFor={`link-c-${item.id}`} className="ml-2 block text-sm text-slate-900 truncate"><span className="font-semibold">{list.title}:</span> {item.text}</label>
                    </div>
                )))}
              </div>
            </section>

          </div>
          <footer className="p-4 bg-slate-50 border-t flex justify-end">
            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
              Enregistrer les liens
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default LinkItemsModal;
