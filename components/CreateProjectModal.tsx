import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (title: string, description: string) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onAddProject }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
    }
  }, [isOpen]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
        alert('Le titre du projet est requis.');
        return;
    }
    onAddProject(title, description);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Créer un nouveau projet</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <label htmlFor="project-title" className="block text-sm font-medium text-slate-700 mb-1">Titre du Projet</label>
              <input
                id="project-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Vacances au Japon"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                id="project-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Un voyage de 2 semaines pour explorer Tokyo et Kyoto."
                rows={4}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              />
            </div>
          </div>
          <footer className="p-4 bg-slate-50 border-t flex justify-end">
            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
              Créer le Projet
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
