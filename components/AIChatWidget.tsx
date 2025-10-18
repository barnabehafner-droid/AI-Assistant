import React, { useState, useRef, useEffect } from 'react';
import { useOrganizerState } from '../hooks/useOrganizerState';
import { streamChat, interpretChatQuery, ChatMessage as GeminiChatMessage } from '../services/geminiService';
import * as googleMailService from '../services/googleMailService';
import * as googleDriveService from '../services/googleDriveService';
import { formatTodosForAI, formatShoppingForAI, formatNotesForAI, formatCustomListsForAI, formatCalendarEventsForAI, formatContactsForAI } from '../services/aiConfig';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, LoaderIcon } from './icons';
import { UserProfile, CalendarEvent, Contact, VoiceSettings, FullEmail, GoogleDriveFile } from '../types';
import * as weatherService from '../services/weatherService';
import * as googleFitService from '../services/googleFitService';

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  organizerState: ReturnType<typeof useOrganizerState>;
  isOnline: boolean;
  userProfile: UserProfile | null;
  calendarEvents: CalendarEvent[];
  contacts: Contact[];
  voiceSettings: VoiceSettings;
  currentLocation: string | null;
  currentUserCoordinates: { latitude: number; longitude: number } | null;
  unreadEmails: FullEmail[];
  accessToken: string | null;
  handleTokenError: (error: unknown) => boolean;
}

type UIMessage = {
    id: number;
    speaker: 'user' | 'ai';
    text: string;
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts[0]) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return 'U';
};

const AIChatWidget: React.FC<AIChatWidgetProps> = ({
    isOpen,
    onClose,
    organizerState,
    isOnline,
    userProfile,
    calendarEvents,
    contacts,
    voiceSettings,
    currentLocation,
    currentUserCoordinates,
    unreadEmails,
    accessToken,
    handleTokenError
}) => {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                { id: Date.now(), speaker: 'ai', text: "Bonjour ! Comment puis-je vous aider à analyser vos listes et projets aujourd'hui ?" }
            ]);
        }
    }, [isOpen, messages.length]);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isLoading]);

    const formatContextForAI = async (
        emailResults?: FullEmail[],
        driveResults?: GoogleDriveFile[]
    ): Promise<string> => {
        const { todos, shoppingList, notes, customLists, projects } = organizerState;
        
        const contextParts = [
            `### Projets:\n${projects.length > 0 ? projects.map(p => `- ${p.title}`).join('\n') : 'Aucun projet.'}`,
            `### Tâches à faire:\n${formatTodosForAI(todos)}`,
            `### Liste de courses:\n${formatShoppingForAI(shoppingList)}`,
            `### Notes:\n${formatNotesForAI(notes)}`,
            customLists.length > 0 ? `### Listes personnalisées:\n${formatCustomListsForAI(customLists)}` : '',
            `### Agenda des 30 prochains jours:\n${formatCalendarEventsForAI(calendarEvents)}`,
            `### Contacts:\n${formatContactsForAI(contacts)}`
        ];

        if (currentLocation) {
            try {
                const weather = await weatherService.getTodaysWeather(currentLocation);
                contextParts.push(`### Météo actuelle (${weather.location}):\n- Température: ${weather.temperature}°C, Condition: ${weather.condition}`);
            } catch (e) { console.warn("Could not fetch weather for AI chat context", e); }
        }
        
        if (currentUserCoordinates) {
            contextParts.push(`### Position Actuelle (GPS):\n- Latitude: ${currentUserCoordinates.latitude}, Longitude: ${currentUserCoordinates.longitude}`);
        }

        if (accessToken) {
            try {
                const fitData = await googleFitService.getTodaysFitData(accessToken);
                if (fitData) {
                    contextParts.push(`### Données d'activité (Google Fit):\n- Pas: ${fitData.steps}, Minutes actives: ${fitData.activeMinutes}`);
                }
            } catch(e) { 
                if (!handleTokenError(e)) {
                    console.warn("Could not fetch fit data for AI chat context", e); 
                }
            }
        }
        
        if (emailResults) {
            contextParts.push(`### Résultats de recherche d'e-mails:\n${emailResults.length > 0 ? emailResults.map(e => `- De: ${e.from}, Sujet: ${e.subject}`).join('\n') : 'Aucun e-mail trouvé.'}`);
        }

        if (driveResults) {
            contextParts.push(`### Résultats de recherche Google Drive:\n${driveResults.length > 0 ? driveResults.map(f => `- ${f.name}`).join('\n') : 'Aucun fichier trouvé.'}`);
        }

        return contextParts.filter(Boolean).join('\n\n');
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const userText = inputValue.trim();
        if (!userText || isLoading || !isOnline) return;

        setInputValue('');

        const userMessage: UIMessage = { id: Date.now(), speaker: 'user', text: userText };
        setMessages(prev => [...prev, userMessage]);
        
        setIsLoading(true);

        const aiMessageId = Date.now() + 1;
        setMessages(prev => [...prev, { id: aiMessageId, speaker: 'ai', text: '' }]);

        const history: GeminiChatMessage[] = messages.map(msg => ({
            role: msg.speaker === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));
        
        let emailResults: FullEmail[] | undefined;
        let driveResults: GoogleDriveFile[] | undefined;

        try {
            if (accessToken) {
                const interpretation = await interpretChatQuery(userText);
                if (interpretation.gmailQuery) {
                    emailResults = await googleMailService.searchEmails(accessToken, interpretation.gmailQuery);
                }
                if (interpretation.driveQuery) {
                    driveResults = await googleDriveService.searchFiles(accessToken, interpretation.driveQuery);
                }
            }
        } catch(e) {
            if (!handleTokenError(e)) {
                console.error("Error during pre-chat search:", e);
            }
        }

        const context = await formatContextForAI(emailResults, driveResults);

        try {
            const stream = streamChat(history, context, userText, voiceSettings);
            for await (const chunk of stream) {
                setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId ? { ...msg, text: msg.text + chunk } : msg
                ));
            }
        } catch (error) {
            console.error("Chat stream error:", error);
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId ? { ...msg, text: "Désolé, une erreur est survenue." } : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInputValue(suggestion);
        const input = document.querySelector('form input[type="text"]') as HTMLInputElement;
        input?.focus();
    };

    const suggestions = [
        "Résume mes tâches urgentes",
        "Quels sont les articles de la liste 'Courses' ?",
        "Y a-t-il des notes sur le projet 'Refonte' ?"
    ];

    return (
        <div className={`fixed z-40 transition-all duration-300 ease-in-out origin-bottom-right
            ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}
            md:bottom-24 md:right-6 md:w-96 md:h-[70vh] md:max-w-md
            bottom-0 right-0 w-full h-full md:rounded-2xl
            bg-white shadow-2xl flex flex-col`}
        >
            <header className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <SparklesIcon className="w-6 h-6 text-white"/>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">Assistant IA</h3>
                </div>
                 <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><XMarkIcon className="w-6 h-6"/></button>
            </header>

            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.speaker === 'ai' && <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-slate-500"/></div>}
                        
                        <div className={`max-w-xs px-4 py-3 rounded-2xl text-sm ${msg.speaker === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {msg.speaker === 'user' && (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-200">
                                {userProfile?.picture ? (
                                    <img src={userProfile.picture} alt="User" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                                        {getInitials(userProfile?.name || '')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-end gap-2 justify-start">
                        <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-slate-500"/></div>
                        <div className="max-w-xs px-4 py-3 rounded-2xl bg-slate-100 text-slate-800 rounded-bl-none">
                            <LoaderIcon className="w-5 h-5 text-slate-400" />
                        </div>
                    </div>
                )}
                {!isLoading && messages.length <= 1 && (
                    <div className="pt-4 space-y-2">
                         <p className="text-xs font-semibold text-slate-400 text-center">Suggestions</p>
                        {suggestions.map((s, i) => (
                            <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full text-left text-sm p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">{s}</button>
                        ))}
                    </div>
                )}
            </div>

            <footer className="p-3 border-t border-slate-200 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={isOnline ? "Posez une question..." : "Chat indisponible hors ligne"}
                        disabled={isLoading || !isOnline}
                        className="flex-grow w-full px-4 py-2 text-sm bg-slate-100 border border-transparent rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition disabled:bg-slate-200"
                        aria-label="Message pour l'assistant IA"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim() || !isOnline}
                        className="p-2 w-10 h-10 flex-shrink-0 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors disabled:bg-indigo-400"
                        aria-label="Envoyer"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default AIChatWidget;