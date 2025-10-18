import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../hooks/useNoteDraftingChat';
import { LoaderIcon, ArrowDownTrayIcon } from './icons';

interface NoteAIChatPanelProps {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    onSendMessage: (message: string) => void;
    onInsertText: (text: string) => void;
}

const NoteAIChatPanel: React.FC<NoteAIChatPanelProps> = ({ messages, isLoading, error, onSendMessage, onInsertText }) => {
    const [inputValue, setInputValue] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSendMessage(inputValue);
        setInputValue('');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="p-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 text-center">Assistant de Rédaction</h3>
            </header>

            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex flex-col gap-1 ${msg.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-xs px-4 py-2 rounded-2xl ${msg.speaker === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                            <p className="text-sm">{msg.text}</p>
                        </div>
                        {msg.speaker === 'ai' && !isLoading && (
                             <button 
                                onClick={() => onInsertText(msg.text)}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                                title="Remplacer le contenu de la note avec ce texte"
                             >
                                <ArrowDownTrayIcon className="w-3 h-3" />
                                Insérer
                             </button>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-end gap-2 justify-start">
                        <div className="max-w-xs px-4 py-2 rounded-2xl bg-white text-slate-800 border border-slate-200 rounded-bl-none">
                             <LoaderIcon className="w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                )}
            </div>

            <footer className="p-3 border-t border-slate-200">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Demandez quelque chose..."
                        disabled={isLoading}
                        className="flex-grow w-full px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition disabled:bg-slate-100"
                        aria-label="Message pour l'assistant IA"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors disabled:bg-indigo-400"
                    >
                        Envoyer
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default NoteAIChatPanel;
