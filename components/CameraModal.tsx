import React from 'react';
import { XMarkIcon, ArrowPathIcon } from './icons';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  onSwitchCamera: () => void;
  canSwitchCamera: boolean;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, videoRef, onSwitchCamera, canSwitchCamera }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-4 right-4 z-50 w-80 h-60 bg-black rounded-xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col" 
            aria-modal="true" 
            role="dialog"
        >
            <div className="relative w-full h-full group">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onClose} className="text-white bg-black/50 rounded-full p-2 hover:bg-black/75 transition" aria-label="Close camera">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                    {canSwitchCamera && (
                        <button onClick={onSwitchCamera} className="text-white bg-black/50 rounded-full p-2 hover:bg-black/75 transition" aria-label="Changer de caméra">
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
                 <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                    <p className="text-white text-center text-xs">
                        Live Capture Active
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CameraModal;