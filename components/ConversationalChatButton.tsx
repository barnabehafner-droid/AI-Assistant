import React, { useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon, LoaderIcon } from './icons';
import AudioVisualizer from './AudioVisualizer';

type ChatStatus = 'idle' | 'connecting' | 'listening' | 'error';

interface ConversationalChatButtonProps {
    status: ChatStatus;
    onClick: () => void;
    onLongPress?: () => void;
    audioContext: AudioContext | null;
    mediaStream: MediaStream | null;
    isAiSpeaking: boolean;
    disabled?: boolean;
}

const ConversationalChatButton: React.FC<ConversationalChatButtonProps> = ({ status, onClick, onLongPress, audioContext, mediaStream, isAiSpeaking, disabled = false }) => {
    const longPressTimer = useRef<number | null>(null);
    const longPressOccurred = useRef(false);
    const [isPressing, setIsPressing] = useState(false);

    const handlePressStart = () => {
        if (disabled || (status !== 'idle' && status !== 'error')) {
            return;
        }
        setIsPressing(true);
        longPressOccurred.current = false; // Reset on new press
        longPressTimer.current = window.setTimeout(() => {
            longPressOccurred.current = true; // Flag that a long press happened
            if (onLongPress) {
                onLongPress();
            }
        }, 500);
    };

    const handlePressEnd = () => {
        setIsPressing(false);
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };
    
    const handleClick = () => {
        // If a session is already active (connecting, listening), any click is a 'stop' action.
        if (status !== 'idle' && status !== 'error') {
            onClick();
            return;
        }

        // If the button is idle, we check if a long press just happened.
        if (!longPressOccurred.current) {
            // If no long press, it's a short press. Perform the default click action (start listening).
            onClick();
        }
        // If a long press did occur, the onLongPress handler has already been fired by the timer.
        // We do nothing here to prevent starting a second session.
        // The longPressOccurred flag will be reset on the next press start.
    };


    const isSessionActive = status !== 'idle';
    const showVisualizer = status === 'listening';

    return (
        <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onClick={handleClick} // Use the new consolidated click handler
            disabled={disabled}
            className={`relative w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 overflow-hidden ${
                isSessionActive
                ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400' 
                : 'bg-white text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500'
            } ${isPressing ? 'scale-110' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isSessionActive ? "Arrêter le chat" : "Démarrer le chat (appui long pour le résumé)"}
        >
            <AudioVisualizer
                status={status}
                isAiSpeaking={isAiSpeaking}
                audioContext={audioContext}
                mediaStream={mediaStream}
                className="absolute inset-0 w-full h-full"
            />
            
            <div className={`flex items-center justify-center transition-opacity duration-300 ${showVisualizer ? 'opacity-0' : 'opacity-100'}`}>
                 {isSessionActive ? (
                    <XMarkIcon className="w-6 h-6" />
                ) : (
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                )}
            </div>
             {status === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <LoaderIcon className="w-6 h-6 text-indigo-600" />
                </div>
            )}
        </button>
    );
};

export default ConversationalChatButton;
