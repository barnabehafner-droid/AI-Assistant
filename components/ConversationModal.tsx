import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FullEmail, GmailContactConversation, Contact } from '../types';
import { LoaderIcon, PencilIcon, ArrowPathIcon, XMarkIcon, ArrowLeftIcon, EllipsisVerticalIcon, TrashIcon } from './icons';
import * as googleMailService from '../services/googleMailService';
import { ConversationView } from './ConversationView';
import FullEmailViewerModal from './FullEmailViewerModal';

interface ConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialContactEmail: string | null;
    auth: ReturnType<typeof useAuth>;
    onCompose: () => void;
    contacts: Contact[];
    onReplyToEmail: (email: FullEmail) => void;
    onForwardEmail: (email: FullEmail) => void;
    onUnsubscribeRequest: (conversation: GmailContactConversation) => void;
    onTrashThread: (threadId: string) => void;
    onMarkAllAsRead: () => void;
    onEditDraft: (email: FullEmail) => void;
    onAddToList: (email: FullEmail) => void;
}

const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
};

const ContactListItem: React.FC<{
    conversation: GmailContactConversation;
    isSelected: boolean;
    onClick: () => void;
    onUnsubscribe: () => void;
    onDelete: () => void;
}> = ({ conversation, isSelected, onClick, onUnsubscribe, onDelete }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleUnsubscribeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUnsubscribe();
        setIsMenuOpen(false);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setIsMenuOpen(false);
    };

    return (
        <div
            onClick={onClick}
            title={`${conversation.name} <${conversation.email}>`}
            className={`relative group w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${isSelected ? 'bg-indigo-100' : 'hover:bg-slate-100'} cursor-pointer`}
            role="button" 
            tabIndex={0}
        >
            {conversation.picture ? (
                <img src={conversation.picture} alt={conversation.name} className="mt-1 flex-shrink-0 w-10 h-10 rounded-full object-cover" />
            ) : (
                <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${conversation.isUnread ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {getInitials(conversation.name)}
                </div>
            )}
            <div className="flex-grow min-w-0">
                <p className={`text-sm truncate ${conversation.isUnread ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                    {conversation.name}
                </p>
                <p className="text-xs text-slate-500 truncate mt-1">{conversation.snippet}</p>
            </div>
            <div className="flex items-center self-center pl-2">
                {conversation.isUnread && <div className="flex-shrink-0 w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
                <div className="relative flex-shrink-0 ml-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
                        className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-200"
                        aria-label="Plus d'options"
                    >
                        <EllipsisVerticalIcon className="w-5 h-5 text-slate-500" />
                    </button>
                    {isMenuOpen && (
                        <div ref={menuRef} className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl py-1 z-20 border">
                            {conversation.isUnsubscribable && (
                                <button
                                    onClick={handleUnsubscribeClick}
                                    className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                    Se désabonner
                                </button>
                            )}
                             <button
                                onClick={handleDeleteClick}
                                className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Supprimer
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ConversationModal: React.FC<ConversationModalProps> = ({ isOpen, onClose, initialContactEmail, auth, onCompose, contacts, onReplyToEmail, onForwardEmail, onUnsubscribeRequest, onTrashThread, onMarkAllAsRead, onEditDraft, onAddToList }) => {
    const [conversations, setConversations] = useState<GmailContactConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedContactEmail, setSelectedContactEmail] = useState<string | null>(null);
    const [selectedConversationMessages, setSelectedConversationMessages] = useState<FullEmail[] | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [viewingEmail, setViewingEmail] = useState<FullEmail | null>(null);


    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSelectedContactEmail(initialContactEmail);
        }
    }, [isOpen, initialContactEmail]);
    

    const fetchContactList = useCallback(async () => {
        if (!auth.accessToken) {
            setConversations(googleMailService.createMockContactConversations());
            setIsLoading(false);
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
    }, [auth.accessToken, auth.profile?.email, contacts]);

    useEffect(() => {
        if (isOpen) {
            fetchContactList();
        }
    }, [isOpen, fetchContactList]);

    const fetchMessagesForContact = useCallback(async (contactEmail: string) => {
        if (!auth.accessToken) {
            setSelectedConversationMessages(googleMailService.createMockMessagesForContact(contactEmail));
            setIsLoadingDetails(false);
            return;
        }
        setIsLoadingDetails(true);
        try {
            const messages = await googleMailService.getMessagesForContact(auth.accessToken, contactEmail, 50);
            setSelectedConversationMessages(messages);
            const unreadMessage = messages.find(m => !m.isRead);
            if (unreadMessage) {
                await googleMailService.markAsRead(auth.accessToken, unreadMessage.id);
            }
        } catch (err) {
            console.error("Failed to fetch messages for contact:", err);
        } finally {
            setIsLoadingDetails(false);
        }
    }, [auth.accessToken]);

    useEffect(() => {
        if (!selectedContactEmail) {
            setSelectedConversationMessages(null);
            return;
        }
        fetchMessagesForContact(selectedContactEmail);
    }, [selectedContactEmail, fetchMessagesForContact]);

    const handleTrashEmail = async (messageId: string) => {
        if (!auth.accessToken) {
            alert("Action non autorisée hors ligne.");
            return;
        }
        try {
            await googleMailService.trashEmail(auth.accessToken, messageId);
            if (selectedContactEmail) {
                // Optimistically remove from state before refetching
                setSelectedConversationMessages(prev => prev ? prev.filter(m => m.id !== messageId) : null);
                // Then refetch to be sure
                await fetchMessagesForContact(selectedContactEmail);
            }
        } catch (error) {
            console.error("Failed to delete email:", error);
            alert("La suppression de l'e-mail a échoué.");
            // Re-fetch on error to revert optimistic update
            if (selectedContactEmail) await fetchMessagesForContact(selectedContactEmail);
        }
    };

    const handleDownloadAttachment = async (messageId: string, attachmentId: string, filename: string, mimeType: string) => {
        if (!auth.accessToken) {
            alert(`Simulation du téléchargement de : ${filename}`);
            return;
        }
        try {
            const data = await googleMailService.getAttachment(auth.accessToken, messageId, attachmentId);
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: mimeType});

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Le téléchargement de la pièce jointe a échoué.');
        }
    };

    const handleSendReply = async (body: string) => {
        if (!auth.accessToken) {
            return;
        }
        if (!selectedContactEmail || !selectedConversationMessages || selectedConversationMessages.length === 0) {
            throw new Error("Cannot send reply: missing context.");
        }
        const lastMessage = selectedConversationMessages[0];
        
        const to = selectedContactEmail;
        const subject = lastMessage.subject.startsWith('Re: ') ? lastMessage.subject : `Re: ${lastMessage.subject}`;
        const inReplyTo = lastMessage.messageId;
        const references = lastMessage.references ? `${lastMessage.references} ${lastMessage.messageId}` : lastMessage.messageId;
        const threadId = lastMessage.threadId;

        await googleMailService.sendEmail(auth.accessToken, to, subject, body, undefined, undefined, threadId, inReplyTo, references);
        await fetchMessagesForContact(selectedContactEmail);
    };

    const handleDeleteThread = async (threadId: string) => {
        onTrashThread(threadId);
        // Optimistically remove from view
        setConversations(prev => prev.filter(c => c.threadId !== threadId));
        if (selectedContactEmail && conversations.find(c => c.threadId === threadId)?.email === selectedContactEmail) {
            setSelectedContactEmail(null);
        }
    };

    const handleMarkAllReadClick = async () => {
        onMarkAllAsRead();
        // Optimistically update UI
        setConversations(prev => prev.map(c => ({ ...c, isUnread: false })));
    };

    if (!isOpen) {
        return null;
    }

    const contactListPanel = (
        <div className="w-full h-full md:w-1/3 lg:w-1/4 flex-shrink-0 border-r border-slate-200 flex flex-col">
            <div className="flex-grow overflow-y-auto p-2 min-h-0">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full"><LoaderIcon className="w-8 h-8 text-indigo-500" /></div>
                ) : error ? (
                    <div className="p-4 text-center text-red-600">{error}</div>
                ) : conversations.length > 0 ? (
                    <ul className="space-y-1">
                        {conversations.map(convo => (
                            <li key={convo.email}>
                                <ContactListItem
                                    conversation={convo}
                                    isSelected={selectedContactEmail === convo.email}
                                    onClick={() => setSelectedContactEmail(convo.email)}
                                    onUnsubscribe={() => onUnsubscribeRequest(convo)}
                                    onDelete={() => handleDeleteThread(convo.threadId)}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-10 text-center text-slate-500">Votre boîte de réception est vide.</div>
                )}
            </div>
        </div>
    );
    
    const conversationPanel = (
         <div className="min-w-0 flex-grow flex flex-col h-full">
            <ConversationView
                threadId={null} // threadId is not needed in contact-centric view
                messages={selectedConversationMessages}
                isLoading={isLoadingDetails}
                onSendReply={handleSendReply}
                userProfile={auth.profile}
                onEmailSelect={setViewingEmail}
                onDownloadAttachment={handleDownloadAttachment}
                contacts={contacts}
                onDeleteEmail={handleTrashEmail}
                onReplyToEmail={onReplyToEmail}
                onForwardEmail={onForwardEmail}
                onEditDraft={onEditDraft}
                onAddToList={onAddToList}
            />
        </div>
    );


    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl m-4 h-[90vh] flex flex-col">
                    <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                            {isMobile && selectedContactEmail && (
                                <button onClick={() => setSelectedContactEmail(null)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                </button>
                            )}
                            <h2 className="text-xl font-bold text-slate-800">Boîte de réception</h2>
                            <button onClick={fetchContactList} disabled={isLoading} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full disabled:opacity-50">
                                {isLoading ? <LoaderIcon className="w-5 h-5"/> : <ArrowPathIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isMobile && (
                                <button onClick={handleMarkAllReadClick} className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                                    Marquer tout comme lu
                                </button>
                            )}
                            <button onClick={onCompose} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700">
                                <PencilIcon className="w-4 h-4" />
                                Nouveau
                            </button>
                            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </header>
                    <div className="flex-grow flex min-h-0">
                        {isMobile ? (
                            selectedContactEmail ? conversationPanel : contactListPanel
                        ) : (
                            <>
                                {contactListPanel}
                                {conversationPanel}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <FullEmailViewerModal 
                isOpen={!!viewingEmail}
                onClose={() => setViewingEmail(null)}
                email={viewingEmail}
                onDownloadAttachment={handleDownloadAttachment}
            />
        </>
    );
};

export default ConversationModal;