import React from 'react';
import { TrashIcon } from './icons';

interface TrashDropZoneProps {
    isVisible: boolean;
    isActive: boolean;
    onDrop: () => void;
    onDragEnter: () => void;
    onDragLeave: () => void;
}

const TrashDropZone: React.FC<TrashDropZoneProps> = ({ isVisible, isActive, onDrop, onDragEnter, onDragLeave }) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Empêche d'autres gestionnaires de drop de s'activer
        onDrop();
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            className={`fixed bottom-8 right-8 z-20 flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ease-in-out
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
                ${isActive ? 'bg-red-600 scale-110 shadow-lg' : 'bg-red-500 shadow-md'}
            `}
            aria-label="Zone de suppression"
        >
            <TrashIcon className="w-12 h-12 text-white" />
        </div>
    );
};

export default TrashDropZone;