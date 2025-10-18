import React, { useRef, useEffect } from 'react';
import { FullEmail, Attachment } from '../types';
import { XMarkIcon, PaperClipIcon, ArrowDownTrayIcon } from './icons';

const AttachmentCard: React.FC<{ attachment: Attachment; onDownload: (attachment: Attachment) => void }> = ({ attachment, onDownload }) => {
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="mt-2 flex items-center gap-3 p-2 border border-slate-200 bg-slate-100 rounded-lg">
            <PaperClipIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{attachment.filename}</p>
                <p className="text-xs text-slate-500">{formatSize(attachment.size)}</p>
            </div>
            <button onClick={() => onDownload(attachment)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title="Télécharger">
                <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

const ParsedEmailBody: React.FC<{ htmlBody: string }> = ({ htmlBody }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!contentRef.current) return;

        const container = contentRef.current;
        container.innerHTML = htmlBody;

        // 1. Make all links open in a new tab
        container.querySelectorAll('a').forEach(link => {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });

        // 2. Smartly filter out template/tracker images
        container.querySelectorAll('img').forEach(img => {
            try {
                const alt = (img.alt || '').toLowerCase();
                const src = (img.src || '').toLowerCase();
                const width = parseInt(img.getAttribute('width') || '0', 10) || img.width;
                const height = parseInt(img.getAttribute('height') || '0', 10) || img.height;

                const isTracker = (width <= 5 && height <= 5);
                const isSpacer = src.includes('spacer') || alt.includes('spacer');
                const isSocialIcon = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'pinterest'].some(social => src.includes(social) || alt.includes(social));
                const isLikelyLogo = alt.includes('logo');
                const isPresentation = img.getAttribute('role') === 'presentation';

                if (isTracker || isSpacer || isSocialIcon || isLikelyLogo || isPresentation) {
                    img.style.display = 'none';
                }
            } catch (e) {
                console.warn("Could not process an image for filtering.", img, e);
            }
        });
        
        // 3. Dim signatures
        const signaturePatterns = ['-- \n', 'Best regards,', 'Kind regards,', 'Sincerely,', 'Meilleures salutations,', 'Cordialement,', 'Sent from my iPhone', 'Sent from my Android'];
        let signatureFound = false;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL, null);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                if (signaturePatterns.some(pattern => node.textContent?.includes(pattern))) {
                    signatureFound = true;
                    let parent = node.parentElement;
                    while(parent && parent !== container) {
                         let elementToWrap = parent;
                         // Try to find a logical block to wrap, not just the text node's parent
                         if (parent.tagName === 'P' || parent.tagName === 'DIV' || parent.tagName === 'SPAN') {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'opacity-50';
                            let sibling = elementToWrap;
                            while(sibling) {
                                const next = sibling.nextSibling;
                                wrapper.appendChild(sibling);
                                sibling = next;
                            }
                            elementToWrap.parentNode?.appendChild(wrapper);
                            break;
                         }
                         parent = parent.parentElement;
                    }
                    break;
                }
            }
            if (signatureFound) break;
        }

        // 4. Collapse quotes
        container.querySelectorAll('blockquote').forEach(quoteElement => {
            if (quoteElement.closest('.quote-wrapper')) return; // Already processed

            const wrapper = document.createElement('div');
            wrapper.className = 'quote-wrapper';

            const summary = document.createElement('button');
            summary.innerHTML = `<span class="text-slate-500 hover:text-slate-700 text-xs font-semibold flex items-center gap-1">...</span>`;
            summary.className = 'my-2';

            const content = document.createElement('div');
            content.style.display = 'none';
            content.className = 'pl-3 border-l-4 border-slate-300';
            content.appendChild(quoteElement.cloneNode(true));
            
            wrapper.appendChild(summary);
            wrapper.appendChild(content);

            summary.onclick = () => {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                summary.style.display = isHidden ? 'none' : 'block';
            };

            quoteElement.parentNode?.replaceChild(wrapper, quoteElement);
        });

    }, [htmlBody]);

    return <div ref={contentRef} className="prose prose-sm max-w-none break-words" />;
};

const FullEmailViewerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    email: FullEmail | null;
    onDownloadAttachment: (messageId: string, attachmentId: string, filename: string, mimeType: string) => void;
}> = ({ isOpen, onClose, email, onDownloadAttachment }) => {
    
    if (!isOpen || !email) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose} aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl m-4 flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                <header className="flex-shrink-0 p-4 sm:p-6 border-b">
                    <div className="flex items-start justify-between">
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{email.subject}</h2>
                            <p className="text-sm text-slate-600 mt-1">
                                <strong className="font-semibold">De :</strong> {email.from}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 ml-4 flex-shrink-0 p-1 rounded-full hover:bg-slate-100">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto p-4 sm:p-6">
                    <ParsedEmailBody htmlBody={email.bodyHtml} />
                    {email.attachments && email.attachments.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                             <h4 className="text-sm font-semibold text-slate-600 mb-2">Pièces jointes</h4>
                            <div className="space-y-2">
                                {email.attachments.map(att => (
                                    <AttachmentCard 
                                        key={att.attachmentId} 
                                        attachment={att} 
                                        onDownload={() => onDownloadAttachment(att.messageId, att.attachmentId, att.filename, att.mimeType)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FullEmailViewerModal;