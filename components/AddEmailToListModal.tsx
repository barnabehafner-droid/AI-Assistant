import React from 'react';
import { CustomList } from '../types';
import { XMarkIcon } from './icons';
import { ListType } from '../hooks/useOrganizerState';

interface AddEmailToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (listType: ListType | 'notes', listId?: string) => void;
  customLists: CustomList[];
}

const AddEmailToListModal: React.FC<AddEmailToListModalProps> = ({ isOpen, onClose, onConfirm, customLists }) => {
  if (!isOpen) {
    return null;
  }

  const handleSelect = (listType: ListType | 'notes', listId?: string) => {
    onConfirm(listType, listId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-slate-800">Ajouter à une liste</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto">
          <p className="text-slate-600 mb-4">L'IA extraira les informations pertinentes de l'e-mail pour les ajouter à la liste que vous choisirez.</p>
          <div className="space-y-2">
            <button onClick={() => handleSelect('todos')} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors font-semibold text-slate-700">
              📝 Ajouter comme tâche(s)
            </button>
            <button onClick={() => handleSelect('shopping')} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors font-semibold text-slate-700">
              🛒 Ajouter à la liste de courses
            </button>
            <button onClick={() => handleSelect('notes')} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors font-semibold text-slate-700">
              📄 Créer une note avec l'e-mail
            </button>
            {customLists.length > 0 && <div className="pt-2 border-t mt-4 mb-2"><h3 className="text-sm font-semibold text-slate-500">Listes personnalisées</h3></div>}
            {customLists.map(list => (
              <button key={list.id} onClick={() => handleSelect('custom', list.id)} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors font-semibold text-slate-700">
                {list.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEmailToListModal;