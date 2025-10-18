import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FullEmail, UserProfile, Attachment, Contact } from '../types';
import { LoaderIcon, ClockIcon, PaperClipIcon, ArrowDownTrayIcon, TrashIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ClipboardDocumentListIcon } from './icons';
import { ConversationComposer } from './ConversationComposer';

interface OptimisticEmail extends Omit<FullEmail, 'body'> {
    status: 'sending';
    bodyHtml: string;
    bodyText: string;
}

const getReplyText = (fullBody: string): string => {
    if (!fullBody) return '';

    // Gmail's "On [date], [sender] wrote:" pattern (English)
    const gmailQuoteRegexEn = /\n\s*On\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}, \d{4}\s+at\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?,\s*.+?\s*wrote:/s;
    // Gmail's "Le [date], [sender] a écrit :" pattern (French)
    const gmailQuoteRegexFr = /\n\s*Le\s+(lun\.|mar\.|mer\.|jeu\.|ven\.|sam\.|dim\.)\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv\.|févr\.|avr\.|juil\.|sept\.|oct\.|nov\.|déc\.)\s+\d{4}\s+à\s+\d{2}:\d{2},\s*.+?\s*a écrit\s?:/s;
    // Outlook's "From: ... Sent: ... To: ... Subject: ..." pattern
    const outlookQuoteRegex = /\n\s*_{2,}\s*\n\s*(De\s?:|From\s?:)/si;

    let match = fullBody.match(gmailQuoteRegexEn);
    if (!match) {
        match = fullBody.match(gmailQuoteRegexFr);
    }
    if (!match) {
        match = fullBody.match(outlookQuoteRegex);
    }

    if (match && typeof match.index === 'number') {
        return fullBody.substring(0, match.index).trim();
    }

    // Fallback for ">" quoted lines, which is a very common standard
    const lines = fullBody.split('\n');
    const firstQuoteLineIndex = lines.findIndex(line => line.trim().startsWith('>'));

    if (firstQuoteLineIndex !== -1) {
        // Find the last non-empty line before the quote starts
        let lastContentLineIndex = firstQuoteLineIndex - 1;
        while (lastContentLineIndex >= 0 && lines[lastContentLineIndex].trim() === '') {
            lastContentLineIndex--;
        }
        if (lastContentLineIndex >= 0) {
            return lines.slice(0, lastContentLineIndex + 1).join('\n').trim();
        }
        // If there is no content before the quote, return an empty string
        return '';
    }

    return fullBody.trim();
};


const getInitials = (name: string) => {
    if (!name) return '?';
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const AttachmentChip: React.FC<{ attachment: Attachment; onDownload: () => void }> = ({ attachment, onDownload }) => {
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="mt-2 flex items-center gap-2 p-2 border border-slate-200/60 bg-white/50 rounded-lg">
            <PaperClipIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div className="flex-grow min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{attachment.filename}</p>
                <p className="text-xs text-slate-500">{formatSize(attachment.size)}</p>
            </div>
            <button onClick={onDownload} className="p-1 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title="Télécharger">
                <ArrowDownTrayIcon className="w-4 h-4" />
            </button>
        </div>
    );
};


const MessageBubble: React.FC<{ 
    message: FullEmail | OptimisticEmail; 
    isSentByMe: boolean;
    senderContact?: Contact;
    onSelect: () => void;
    onDownloadAttachment: (attachment: Attachment) => void;
    onDelete: (messageId: string) => void;
    onReply: (email: FullEmail) => void;
    onForward: (email: FullEmail) => void;
    onEditDraft: (email: FullEmail) => void;
    onAddToList: (email: FullEmail) => void;
}> = ({ message, isSentByMe, senderContact, onSelect, onDownloadAttachment, onDelete, onReply, onForward, onEditDraft, onAddToList }) => {
    const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
    const senderName = message.from.split('<')[0].replace(/"/g, '').trim();
    const isOptimistic = 'status' in message && message.status === 'sending';
    const isDraft = !isOptimistic && 'labelIds' in message && message.labelIds?.includes('DRAFT');
    const replyText = getReplyText(message.bodyText);
    
    const [translateX, setTranslateX] = useState(0);
    const dragStartX = useRef(0);
    const isDragging = useRef(false);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const didSwipe = useRef(false);
    
    const [isExpanded, setIsExpanded] = useState(false);
    const isLongText = replyText.length > 500;

    const handleDragStart = (e: React.TouchEvent) => {
        if (isOptimistic || isDraft) return;
        isDragging.current = true;
        didSwipe.current = false;
        dragStartX.current = e.touches[0].clientX;
        if (bubbleRef.current) {
            bubbleRef.current.style.transition = 'none';
        }
    };

    const handleDragMove = (e: React.TouchEvent) => {
        if (!isDragging.current || isOptimistic || isDraft) return;
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - dragStartX.current;
        if (Math.abs(deltaX) > 10) { // Threshold to consider it a swipe, not a scroll
             didSwipe.current = true;
        }
        setTranslateX(deltaX);
    };

    const handleDragEnd = () => {
        if (!isDragging.current || isOptimistic || isDraft) return;
        isDragging.current = false;

        const SWIPE_ACTION_DELETE = 80;
        const SWIPE_ACTION_REPLY = -80;
        const SWIPE_ACTION_FORWARD = -160;
        const SWIPE_ACTION_ADD_TO_LIST = -240;

        if (bubbleRef.current) {
            bubbleRef.current.style.transition = 'transform 0.3s ease-out';
            if (translateX > SWIPE_ACTION_DELETE) {
                onDelete(message.id);
            } else if (translateX < SWIPE_ACTION_ADD_TO_LIST) {
                onAddToList(message as FullEmail);
            } else if (translateX < SWIPE_ACTION_FORWARD) {
                onForward(message as FullEmail);
            } else if (translateX < SWIPE_ACTION_REPLY) {
                onReply(message as FullEmail);
            }
        }

        // Snap back animation
        setTranslateX(0);
        setTimeout(() => { didSwipe.current = false; }, 300);
    };

    const handleBubbleClick = () => {
        if (didSwipe.current) {
            return;
        }
        if (isDraft) {
            onEditDraft(message as FullEmail);
            return;
        }
        if (isLongText && !isExpanded) {
            setIsExpanded(true);
        } else {
            onSelect();
        }
    };

    const formattedDate = new Date(message.date).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const textToShow = useMemo(() => {
        if (isLongText && !isExpanded) {
            const truncated = replyText.substring(0, 500);
            // Replace two or more consecutive newlines with a single space to compact the preview
            const compacted = truncated.replace(/(\r\n|\n|\r){2,}/g, ' ');
            return compacted + '...';
        }
        return replyText;
    }, [replyText, isLongText, isExpanded]);

    const opacityClass = isOptimistic ? 'opacity-60' : isDraft ? 'opacity-70' : 'opacity-100';

    const bubbleContent = (
      <div className={`max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl transition-opacity ${opacityClass} ${isSentByMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
        <div onClick={handleBubbleClick} className="w-full text-left px-4 py-3 cursor-pointer">
            <p className="text-sm whitespace-pre-wrap break-all">{textToShow}</p>
            {isLongText && !isExpanded && (
                 <span className={`text-xs font-bold block mt-2 ${isSentByMe ? 'text-indigo-200' : 'text-indigo-600'}`}>
                    Afficher plus
                </span>
            )}
            <div className={`mt-2 pt-2 border-t text-xs space-y-0.5 ${isSentByMe ? 'border-indigo-500/50 text-indigo-200' : 'border-slate-200/60 text-slate-500'}`}>
                {!isSentByMe && <p className="truncate font-semibold text-slate-600">De : {senderName}</p>}
                <p className="truncate font-medium">Objet: {message.subject}</p>
                <p>{isDraft ? "Brouillon" : formattedDate}</p>
            </div>
            {isOptimistic && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-300">
                    <ClockIcon className="w-3 h-3"/>
                    <span>Envoi...</span>
                </div>
            )}
        </div>
        {'attachments' in message && message.attachments && message.attachments.length > 0 && (
             <div className="px-4 pb-3 pt-1">
                <div className="space-y-2">
                    {message.attachments.map(att => (
                        <AttachmentChip 
                            key={att.attachmentId} 
                            attachment={att} 
                            onDownload={() => onDownloadAttachment(att)}
                        />
                    ))}
                </div>
            </div>
        )}
      </div>
    );
    
    return (
        <div className="w-full flex" ref={containerRef}>
             {/* Background swipe actions for touch devices */}
            {isTouchDevice && (
                <div className="absolute inset-0 flex items-center justify-between rounded-2xl pointer-events-none">
                    <div className="flex items-center justify-start bg-red-500 h-full rounded-l-2xl" style={{ width: `${Math.max(0, translateX)}px`, opacity: Math.max(0, Math.min(1, translateX / 80))}}>
                         <div className="flex items-center gap-2 text-white pl-6">
                            <TrashIcon className="w-5 h-5"/>
                            <span className="font-bold">Supprimer</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-end bg-blue-500 h-full rounded-r-2xl" style={{ width: `${Math.max(0, -translateX)}px`, opacity: Math.max(0, Math.min(1, -translateX / 80)) }}>
                         <div className="flex items-center gap-2 text-white pr-4">
                            <span className="font-bold flex items-center gap-1"><ArrowUturnLeftIcon className="w-5 h-5"/> Répondre</span>
                            <span className="font-bold flex items-center gap-1" style={{ opacity: Math.max(0, Math.min(1, (-translateX - 80) / 80)) }}><ArrowUturnRightIcon className="w-5 h-5"/> Transférer</span>
                            <span className="font-bold flex items-center gap-1" style={{ opacity: Math.max(0, Math.min(1, (-translateX - 160) / 80)) }}><ClipboardDocumentListIcon className="w-5 h-5"/> Ajouter</span>
                        </div>
                    </div>
                </div>
            )}
            <div
                ref={bubbleRef}
                style={{ transform: `translateX(${translateX}px)` }}
                className={`relative z-10 group w-full flex items-end ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                {...(isTouchDevice ? { onTouchStart: handleDragStart, onTouchMove: handleDragMove, onTouchEnd: handleDragEnd } : {})}
            >
                {/* Desktop Hover Actions */}
                {!isTouchDevice && !isOptimistic && !isDraft && !isSentByMe && (
                    <div className="flex items-center self-center transition-opacity opacity-0 group-hover:opacity-100 mr-2">
                        <button onClick={() => onReply(message as FullEmail)} title="Répondre" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full"><ArrowUturnLeftIcon className="w-4 h-4"/></button>
                        <button onClick={() => onForward(message as FullEmail)} title="Transférer" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full"><ArrowUturnRightIcon className="w-4 h-4"/></button>
                        <button onClick={() => onAddToList(message as FullEmail)} title="Ajouter à une liste" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full"><ClipboardDocumentListIcon className="w-4 h-4"/></button>
                        <button onClick={() => onDelete(message.id)} title="Supprimer" className="p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                )}

                {/* Avatar */}
                {!isSentByMe && !isTouchDevice && (
                     senderContact?.picture ? 
                        <img src={senderContact.picture} alt={senderName} className="w-8 h-8 rounded-full self-end mb-1 mr-2 flex-shrink-0" /> :
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs self-end mb-1 mr-2 flex-shrink-0">{getInitials(senderName)}</div>
                )}
                
                {bubbleContent}

                {isDraft && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(message.id); }} 
                        title="Supprimer le brouillon" 
                        className="ml-2 flex-shrink-0 self-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                    >
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                )}

                 {/* Desktop Hover Actions for Sent Messages */}
                {!isTouchDevice && !isOptimistic && !isDraft && isSentByMe && (
                    <div className="flex items-center self-center transition-opacity opacity-0 group-hover:opacity-100 ml-2">
                        <button onClick={() => onDelete(message.id)} title="Supprimer" className="p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full"><TrashIcon className="w-4 h-4"/></button>
                        <button onClick={() => onAddToList(message as FullEmail)} title="Ajouter à une liste" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full"><ClipboardDocumentListIcon className="w-4 h-4"/></button>
                        <button onClick={() => onForward(message as FullEmail)} title="Transférer" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full"><ArrowUturnRightIcon className="w-4 h-4"/></button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ConversationViewProps {
    threadId: string | null;
    messages: FullEmail[] | null;
    isLoading: boolean;
    onSendReply: (body: string) => Promise<void>;
    userProfile: UserProfile | null;
    onEmailSelect: (email: FullEmail) => void;
    onDownloadAttachment: (messageId: string, attachmentId: string, filename: string, mimeType: string) => Promise<void>;
    contacts: Contact[];
    onDeleteEmail: (messageId: string) => void;
    onReplyToEmail: (email: FullEmail) => void;
    onForwardEmail: (email: FullEmail) => void;
    onEditDraft: (email: FullEmail) => void;
    onAddToList: (email: FullEmail) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ threadId, messages, isLoading, onSendReply, userProfile, onEmailSelect, onDownloadAttachment, contacts, onDeleteEmail, onReplyToEmail, onForwardEmail, onEditDraft, onAddToList }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const [optimisticMessages, setOptimisticMessages] = useState<OptimisticEmail[]>([]);
    const [isSending, setIsSending] = useState(false);
    const userEmail = userProfile?.email?.toLowerCase();

    // Clear optimistic messages when the real messages for this thread load/change
    useEffect(() => {
        setOptimisticMessages([]);
        setIsSending(false);
    }, [messages, threadId]);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages, optimisticMessages]);

    const handleSend = async (bodyHtml: string) => {
        if (!userProfile || !messages || messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        const subject = lastMessage.subject.startsWith('Re: ') ? lastMessage.subject : `Re: ${lastMessage.subject}`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bodyHtml;
        const bodyText = tempDiv.textContent || tempDiv.innerText || '';

        const tempId = `optimistic-${Date.now()}`;
        const optimisticMessage: OptimisticEmail = {
            id: tempId,
            threadId: messages[0].threadId,
            from: userProfile.email,
            to: '',
            subject: subject,
            bodyHtml: bodyHtml,
            bodyText: bodyText,
            snippet: bodyText.substring(0, 100),
            isRead: true,
            date: new Date().toISOString(),
            status: 'sending',
            messageId: tempId
        };

        setOptimisticMessages(prev => [...prev, optimisticMessage]);
        setIsSending(true);

        try {
            await onSendReply(bodyHtml);
            // The parent will refresh the messages prop, which triggers the useEffect to clear optimistic messages
        } catch (error) {
            console.error("Failed to send reply:", error);
            // Remove the failed message and show an error
            setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
            // You might want to show a toast or error message here
        } finally {
            // isSending will be reset by the useEffect that watches `messages`
        }
    };

    const handleDownload = (attachment: Attachment) => {
        onDownloadAttachment(attachment.messageId, attachment.attachmentId, attachment.filename, attachment.mimeType);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoaderIcon className="w-8 h-8 text-indigo-500" />
            </div>
        );
    }
    
    if (!messages) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <p>Sélectionnez une conversation pour la lire.</p>
            </div>
        );
    }

    const allMessages = [...messages, ...optimisticMessages];

    return (
        <div className="flex flex-col h-full bg-white">
            <div ref={chatContainerRef} className="flex-grow p-4 sm:p-6 space-y-4 overflow-y-auto min-h-0">
                <div className="space-y-4">
                    {allMessages.map(message => {
                        const fromAddress = message.from.match(/<(.+)>/)?.[1]?.toLowerCase() || message.from.toLowerCase();
                        const isSentByMe = !!userEmail && fromAddress === userEmail;
                        const contactInfo = isSentByMe ? undefined : contacts.find(c => c.email.toLowerCase() === fromAddress);
                        return <MessageBubble 
                            key={message.id} 
                            message={message} 
                            isSentByMe={isSentByMe} 
                            senderContact={contactInfo}
                            onSelect={() => onEmailSelect(message)} 
                            onDownloadAttachment={handleDownload}
                            onDelete={onDeleteEmail}
                            onReply={onReplyToEmail}
                            onForward={onForwardEmail}
                            onEditDraft={onEditDraft}
                            onAddToList={onAddToList}
                        />;
                    })}
                    <div ref={endOfMessagesRef} />
                </div>
            </div>
            <ConversationComposer
                onSend={handleSend}
                userProfile={userProfile}
                isSending={isSending}
            />
        </div>
    );
};