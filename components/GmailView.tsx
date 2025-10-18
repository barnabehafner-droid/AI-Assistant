import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GmailContactConversation, Contact } from '../types';
import { LoaderIcon, PencilIcon, ArrowPathIcon, GripVerticalIcon, EllipsisVerticalIcon } from './icons';
import * as googleMailService from '../services/googleMailService';

interface GmailViewProps {
    auth: ReturnType<typeof useAuth>;
    onCompose: () => void;
    onRefresh: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isReordering?: boolean;
    isOnline: boolean;
    onConversationSelect: (contactEmail: string) => void;
    contacts: Contact[];
}

const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length-1][0]}` : name.slice(0, 2);
};

const ContactConversationListItem: React.FC<{
    conversation: GmailContactConversation;
    onClick: () => void;
}> = ({ conversation, onClick }) => {

    return (
        <div 
            className="relative group w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 hover:bg-slate-100 cursor-pointer" 
            onClick={onClick} 
            role="button" 
            tabIndex={0}
            title={`${conversation.name} <${conversation.email}>`}
        >
            {/* Avatar */}
            {conversation.picture ? (
                <img src={conversation.picture} alt={conversation.name} className="mt-1 flex-shrink-0 w-10 h-10 rounded-full object-cover" />
            ) : (
                <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${conversation.isUnread ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {getInitials(conversation.name)}
                </div>
            )}
            {/* Text Content */}
            <div className="flex-grow min-w-0">
                <p className={`text-sm truncate ${conversation.isUnread ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                    {conversation.name}
                </p>
                <p className="text-xs text-slate-500 truncate mt-1">{conversation.snippet}</p>
            </div>
            {/* Unread Dot */}
            <div className="flex items-center self-center pl-2">
                {conversation.isUnread && <div className="flex-shrink-0 w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
            </div>
        </div>
    );
};


const GmailView: React.FC<GmailViewProps> = ({ auth, onCompose, onRefresh, isCollapsed, onToggleCollapse, isReordering, isOnline, onConversationSelect, contacts }) => {
    const [conversations, setConversations] = useState<GmailContactConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConversations = useCallback(async () => {
        if (!auth.accessToken) {
            setIsLoading(false);
            setConversations(googleMailService.createMockContactConversations());
            return;
        }
        if (!isOnline) {
            setIsLoading(false);
            setError("Vous êtes hors ligne. Impossible de charger les e-mails.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const fetchedConversations = await googleMailService.listContactConversations(auth.accessToken, 50, auth.profile?.email, contacts);
            setConversations(fetchedConversations);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load conversations.');
        } finally {
            setIsLoading(false);
        }
    }, [auth.accessToken, isOnline, auth.profile?.email, contacts]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    const handleRefresh = () => {
        fetchConversations();
        onRefresh();
    }

    const conversationListContent = (
        <div className="flex-grow overflow-y-auto p-2 min-h-0 max-h-[450px]">
            {isLoading ? (
                <div className="flex justify-center items-center h-full py-10"><LoaderIcon className="w-8 h-8 text-indigo-500" /></div>
            ) : error ? (
                <div className="p-4 text-center text-red-600">{error}</div>
            ) : conversations.length > 0 ? (
                <ul className="space-y-1">
                    {conversations.slice(0, 5).map(convo => (
                        <li key={convo.email}>
                             <ContactConversationListItem 
                                conversation={convo} 
                                onClick={() => onConversationSelect(convo.email)}
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="p-10 text-center text-slate-500">Votre boîte de réception est vide.</div>
            )}
        </div>
    );

    return (
        <div className={`bg-white rounded-xl shadow-md overflow-hidden flex flex-col ${isReordering ? 'widget-reordering-active' : ''}`}>
            <header
                onClick={onToggleCollapse}
                className={`flex-shrink-0 flex justify-between items-center p-6 cursor-pointer ${!isCollapsed ? 'border-b' : ''} border-slate-200`}
            >
                <div className="flex items-center gap-2">
                    {isReordering && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
                    <h2 className="text-2xl font-bold text-slate-800">Boîte de réception</h2>
                </div>
                {!isCollapsed && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleRefresh} disabled={isLoading || !isOnline} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full disabled:opacity-50">
                            {isLoading ? <LoaderIcon className="w-5 h-5"/> : <ArrowPathIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={onCompose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                            <PencilIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </header>

            {!isCollapsed ? (
                <div className="flex flex-col">
                    {conversationListContent}
                </div>
            ) : (
                <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
                    <span>{conversations.filter(c => c.isUnread).length} conversation(s) non lue(s)</span>
                </div>
            )}
        </div>
    );
};

export default GmailView;