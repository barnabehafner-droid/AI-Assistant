import React from 'react';
import { XMarkIcon, CameraIcon, VideoCameraIcon } from './icons';

interface CameraChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzePhoto: () => void;
  onVideoChat: () => void;
}

const CameraChoiceModal: React.FC<CameraChoiceModalProps> = ({ isOpen, onClose, onAnalyzePhoto, onVideoChat }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4 p-6 relative animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 text-center mb-6">Que voulez-vous faire ?</h2>
        <div className="flex flex-col gap-4">
          <button
            onClick={onAnalyzePhoto}
            className="flex items-center gap-4 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-left"
          >
            <CameraIcon className="w-8 h-8 text-indigo-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-slate-800">Analyser une photo</h3>
              <p className="text-sm text-slate-600">Extraire du texte d'une image pour créer des listes.</p>
            </div>
          </button>
          <button
            onClick={onVideoChat}
            className="flex items-center gap-4 p-4 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-left"
          >
            <VideoCameraIcon className="w-8 h-8 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-slate-800">Chat Vidéo</h3>
              <p className="text-sm text-slate-600">Discuter avec l'assistant en utilisant votre caméra.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraChoiceModal;