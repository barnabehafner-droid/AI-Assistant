import React, { useState } from 'react';
import { SparklesIcon, ChatBubbleBottomCenterTextIcon, ChatBubbleLeftRightIcon, CameraIcon, XMarkIcon } from './icons';

interface ConsolidatedAIChatFABProps {
    isMobile: boolean;
    onOpenTextChat: () => void;
    onToggleVoiceChat: () => void;
    onOpenVideoOptions: () => void;
    isVoiceChatActive: boolean;
    disabled: boolean;
}

const ConsolidatedAIChatFAB: React.FC<ConsolidatedAIChatFABProps> = ({ isMobile, onOpenTextChat, onToggleVoiceChat, onOpenVideoOptions, isVoiceChatActive, disabled }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleMainClick = () => {
        if (isVoiceChatActive) {
            onToggleVoiceChat(); // This is the "stop" action
            return;
        }
        if (isMobile) {
            setIsMenuOpen(prev => !prev);
        }
    };

    const handleActionClick = (action: () => void) => {
        action();
        if (isMobile) {
            setIsMenuOpen(false);
        }
    };

    const containerProps = isMobile || isVoiceChatActive ? {} : {
        onMouseEnter: () => setIsMenuOpen(true),
        onMouseLeave: () => setIsMenuOpen(false)
    };

    const actionButtons = [
        { icon: <CameraIcon className="w-6 h-6" />, action: onOpenVideoOptions, title: "Analyse Visuelle", style: { transform: isMenuOpen ? 'translateY(-65px)' : 'translateY(0)', transitionDelay: '0.1s' } },
        { icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />, action: onToggleVoiceChat, title: "Chat Vocal", style: { transform: isMenuOpen ? 'translateY(-46px) translateX(-46px)' : 'translate(0,0)', transitionDelay: '0.05s' } },
        { icon: <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />, action: onOpenTextChat, title: "Chat Texte", style: { transform: isMenuOpen ? 'translateX(-65px)' : 'translateX(0)', transitionDelay: '0s' } }
    ];

    return (
        <div className="fixed bottom-6 right-6 z-50 w-40 h-40 flex items-end justify-end" {...containerProps}>
            <div className="relative flex items-center justify-center">
                
                {!isVoiceChatActive && actionButtons.map((btn, index) => (
                    <button
                        key={index}
                        onClick={() => handleActionClick(btn.action)}
                        disabled={disabled}
                        title={btn.title}
                        className={`absolute w-12 h-12 bg-white text-slate-700 rounded-full shadow-md flex items-center justify-center transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-200 disabled:cursor-not-allowed ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        style={btn.style}
                        aria-label={btn.title}
                    >
                        {btn.icon}
                    </button>
                ))}

                <button
                    onClick={handleMainClick}
                    disabled={disabled && !isVoiceChatActive}
                    className={`relative w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ease-in-out transform focus:outline-none focus:ring-4 focus:ring-offset-2 ${
                        isVoiceChatActive
                        ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-300'
                        : `bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-300 ${isMenuOpen && !isMobile ? 'scale-110' : 'hover:scale-110'} disabled:bg-indigo-400 disabled:hover:scale-100`
                    }`}
                    aria-label={isVoiceChatActive ? "Arrêter le chat vocal" : "Ouvrir les options de chat IA"}
                >
                    <div className={`transition-transform duration-300 ${isMenuOpen && isMobile && !isVoiceChatActive ? 'rotate-45' : 'rotate-0'}`}>
                        {isVoiceChatActive ? <XMarkIcon className="w-8 h-8"/> : <SparklesIcon className="w-8 h-8"/>}
                    </div>
                </button>
            </div>
        </div>
    );
};

export default ConsolidatedAIChatFAB;