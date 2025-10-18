import { FullEmail, GmailLabel, GmailThread, Attachment, GmailContactConversation, Contact, TokenExpiredError } from '../types';

// --- Helper for base64url encoding ---
const base64urlEncode = (str: string) => {
    // Handles UTF-8 characters correctly
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

const getAuthHeaders = (accessToken: string) => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
});

async function handleApiError(response: Response, action: string) {
    if (!response.ok) {
        if (response.status === 401) {
            throw new TokenExpiredError(`Failed to ${action}: Token is invalid or expired.`);
        }
        let errorMessage = `Status ${response.status}: ${response.statusText}`;
        try {
            const errorJson = await response.json();
            if (errorJson?.error?.message) {
                errorMessage = errorJson.error.message;
            }
        } catch (e) { /* ignore json parsing error */ }
        throw new Error(`Failed to ${action}: ${errorMessage}`);
    }
}

export const createMockEmails = (): FullEmail[] => {
    return [
        { id: 'mock1', threadId: 'thread_mock_1', from: 'Alice', to: 'Me', subject: 'Re: Project Update', snippet: 'Thanks for the update, looks great!', bodyHtml: '<p>Thanks for the update, looks great!</p>', bodyText: 'Thanks for the update, looks great!', isRead: false, date: new Date().toISOString() },
        { id: 'mock2', threadId: 'thread_mock_2', from: 'Bob', to: 'Me', subject: 'Lunch tomorrow?', snippet: 'Are we still on for lunch tomorrow at 12? Let me know!', bodyHtml: '<p>Are we still on for lunch tomorrow at 12? Let me know!</p>', bodyText: 'Are we still on for lunch tomorrow at 12? Let me know!', isRead: false, date: new Date().toISOString() },
        { id: 'mock3', threadId: 'thread_mock_3', from: 'Marketing Newsletter', to: 'Me', subject: 'Weekly Deals', snippet: 'Check out our latest deals for this week only!', bodyHtml: '<p>Check out our latest deals for this week only!</p>', bodyText: 'Check out our latest deals for this week only!', isRead: true, date: new Date().toISOString() },
    ];
};

export const createMockContactConversations = (): GmailContactConversation[] => {
    return [
        { name: 'Alice', email: 'alice@example.com', snippet: "Oui, c'est parfait, merci ! On se voit là-bas.", lastMessageDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), isUnread: true, threadId: 'mock_thread1' },
        { name: 'Bob (Manager)', email: 'bob@example.com', snippet: "Voici le rapport Q3 mis à jour.", lastMessageDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isUnread: true, threadId: 'mock_thread2' },
        { name: 'Charles', email: 'charles@example.com', snippet: "Super idée ! J'ai ajouté quelques suggestions...", lastMessageDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), isUnread: false, threadId: 'mock_thread3' },
    ];
};

export const createMockMessagesForContact = (email: string): FullEmail[] => {
     const now = new Date();
     if (email === 'alice@example.com') {
         return [
            { id: 'msg_1_1', threadId: 'thread_mock_1', from: 'Alice <alice@example.com>', to: 'Moi', subject: 'Confirmation pour le déjeuner de demain', bodyHtml: '<p>Salut, est-ce que 12h30 te convient toujours pour demain ?</p>', bodyText: 'Salut, est-ce que 12h30 te convient toujours pour demain ?', isRead: true, snippet: '', messageId: 'msg_1_1', date: new Date(now.getTime() - 10 * 60 * 1000).toISOString() },
            { id: 'msg_1_2', threadId: 'thread_mock_1', from: 'Moi <me@example.com>', to: 'Alice', subject: 'Re: Confirmation pour le déjeuner de demain', bodyHtml: '<p>Oui, 12h30 c\'est parfait pour moi.</p>', bodyText: 'Oui, 12h30 c\'est parfait pour moi.', isRead: true, snippet: '', messageId: 'msg_1_2', date: new Date(now.getTime() - 8 * 60 * 1000).toISOString() },
            { id: 'msg_1_3', threadId: 'thread_mock_1', from: 'Alice <alice@example.com>', to: 'Moi', subject: 'Re: Confirmation pour le déjeuner de demain', bodyHtml: "<p>Oui, c'est parfait, merci ! On se voit là-bas.</p>", bodyText: "Oui, c'est parfait, merci ! On se voit là-bas.", isRead: false, snippet: "Oui, c'est parfait, merci ! On se voit là-bas.", messageId: 'msg_1_3', date: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
         ].sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
     }
     if (email === 'bob@example.com') {
        return [
            { id: 'msg_2_1', threadId: 'thread_mock_2', from: 'Bob (Manager) <bob@example.com>', to: 'Moi', subject: 'Rapport Trimestriel Q3', bodyHtml: "Voici le rapport Q3 mis à jour. Peux-tu y jeter un œil avant la réunion ?<br><br>Merci,<br>Bob", bodyText: "Voici le rapport Q3 mis à jour. Peux-tu y jeter un œil avant la réunion ?\n\nMerci,\nBob", isRead: false, snippet: "Voici le rapport Q3 mis à jour. Peux-tu y jeter un œil avant la réunion ?", attachments: [{ filename: 'Rapport_Q3.pdf', mimeType: 'application/pdf', size: 1234567, attachmentId: 'mock_att_1', messageId: 'msg_2_1' }], messageId: 'msg_2_1', date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
        ]
     }
     return [];
};


// FIX: Added missing 'query' parameter.
export const searchEmails = async (accessToken: string, query: string, maxResults = 5): Promise<FullEmail[]> => {
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const searchResponse = await fetch(searchUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(searchResponse, 'search emails');
    const searchData = await searchResponse.json();

    if (!searchData.messages) {
        return [];
    }

    const emailPromises = searchData.messages.map((msg: { id: string }) => getEmail(accessToken, msg.id));
    return Promise.all(emailPromises);
};

export const listInboxMessages = async (
    accessToken: string, 
    maxResults = 20, 
    pageToken?: string
): Promise<{ emails: FullEmail[]; nextPageToken: string | null }> => {
    let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=${maxResults}`;
    if (pageToken) {
        listUrl += `&pageToken=${pageToken}`;
    }
    const listResponse = await fetch(listUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(listResponse, 'list inbox messages');
    const listData = await listResponse.json();

    if (!listData.messages) {
        return { emails: [], nextPageToken: null };
    }

    // Fetch full email for each message ID
    const emailPromises = listData.messages.map((message: { id: string }) => 
        getEmail(accessToken, message.id)
    );

    const emails = await Promise.all(emailPromises);

    return { emails: emails, nextPageToken: listData.nextPageToken || null };
};

export const listUnreadInboxMessages = async (accessToken: string, maxResults = 5): Promise<FullEmail[]> => {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent('label:inbox is:unread')}&maxResults=${maxResults}`;
    
    const listResponse = await fetch(listUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(listResponse, 'list unread inbox messages');
    const listData = await listResponse.json();

    if (!listData.messages) {
        return [];
    }

    const emailPromises = listData.messages.map((message: { id: string }) => 
        getEmail(accessToken, message.id)
    );
    const emails = await Promise.all(emailPromises);

    return emails;
};

const parseMessagePayload = (messageId: string, payload: any): { bodyHtml: string; bodyText: string; attachments: Attachment[] } => {
    let bodyHtml = '';
    let bodyText = '';
    const attachments: Attachment[] = [];

    const decodeBase64 = (data: string): string => {
        try {
            const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
            const binaryStr = atob(base64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            console.error("Failed to decode base64 email body:", e);
            return 'Error decoding content.';
        }
    };

    const findParts = (parts: any[]) => {
        for (const part of parts) {
            if (part.mimeType === 'text/html' && !bodyHtml) {
                if (part.body?.data) bodyHtml = decodeBase64(part.body.data);
            } else if (part.mimeType === 'text/plain' && !bodyText) {
                if (part.body?.data) bodyText = decodeBase64(part.body.data);
            } else if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size,
                    attachmentId: part.body.attachmentId,
                    messageId
                });
            }

            if (part.parts) {
                findParts(part.parts);
            }
        }
    };

    if (payload.parts) {
        findParts(payload.parts);
    } else if (payload.body?.data) {
        if (payload.mimeType === 'text/html') {
            bodyHtml = decodeBase64(payload.body.data);
        } else if (payload.mimeType === 'text/plain') {
            bodyText = decodeBase64(payload.body.data);
        }
    }

    if (bodyHtml && !bodyText) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bodyHtml;
        bodyText = tempDiv.textContent || tempDiv.innerText || '';
    } else if (bodyText && !bodyHtml) {
        bodyHtml = bodyText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/(?:\r\n|\r|\n)/g, '<br>');
    }

    return { bodyHtml, bodyText, attachments };
};

export const getAttachment = async (accessToken: string, messageId: string, attachmentId: string): Promise<string> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'get attachment');
    const data = await response.json();
    // The data is base64url encoded
    return data.data.replace(/-/g, '+').replace(/_/g, '/');
};

export const getEmail = async (accessToken: string, messageId: string): Promise<FullEmail> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'get email content');
    const data = await response.json();

    const getHeader = (name: string) => data.payload.headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    const { bodyHtml, bodyText, attachments } = parseMessagePayload(data.id, data.payload);
    
    // Use the reliable internalDate (Unix ms timestamp string) from the API.
    // Fall back to the Date header if it's somehow missing.
    const reliableDate = data.internalDate 
        ? new Date(parseInt(data.internalDate, 10)).toISOString()
        : getHeader('Date');

    return {
        id: data.id,
        threadId: data.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        bodyHtml,
        bodyText,
        attachments,
        snippet: data.snippet,
        isRead: !data.labelIds.includes('UNREAD'),
        date: reliableDate,
        labelIds: data.labelIds || [],
        messageId: getHeader('Message-ID'),
        references: getHeader('References'),
        inReplyTo: getHeader('In-Reply-To'),
    };
};

export const listContactConversations = async (
    accessToken: string,
    maxResults = 50,
    userEmail?: string | null,
    contacts: Contact[] = []
): Promise<GmailContactConversation[]> => {
    // 1. Fetch recent threads to identify conversation partners
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&labelIds=INBOX`;
    const listResponse = await fetch(listUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(listResponse, 'list threads for contacts');
    const listData = await listResponse.json();

    if (!listData.threads || listData.threads.length === 0) {
        return [];
    }

    // 2. Fetch metadata for each thread to get participants and last message details
    const threadPromises = listData.threads.map((thread: { id: string }) => 
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`, { headers: getAuthHeaders(accessToken) })
        .then(async res => {
            if (res.status === 401) throw new TokenExpiredError('Token expired while fetching thread details');
            return res.ok ? res.json() : null
        })
    );

    const threadDetailsResults = await Promise.all(threadPromises);

    const getHeaderValue = (headers: any[], name: string) => headers.find((h: any) => h.name === name)?.value || '';
    const parseParticipant = (header: string): { name: string; email: string } | null => {
        if (!header) return null;
        const match = header.match(/(.+?)\s*<(.+?)>/);
        if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() };
        if (header.includes('@')) return { name: header.split('@')[0], email: header };
        return null;
    };
    
    // 3. Aggregate conversations by contact
    const conversations = new Map<string, GmailContactConversation>();
    const contactMap = new Map(contacts.map(c => [c.email.toLowerCase(), c]));

    threadDetailsResults
        .filter((data): data is any => data !== null)
        .forEach(data => {
            if (data.messages && data.messages.length > 0) {
                const lastMessage = data.messages[data.messages.length - 1];

                // Find last received message to use for the snippet
                let lastRelevantMessage = lastMessage;
                if (userEmail) {
                    for (let i = data.messages.length - 1; i >= 0; i--) {
                        const msg = data.messages[i];
                        const fromHeader = getHeaderValue(msg.payload.headers, 'From');
                        const fromParticipant = parseParticipant(fromHeader);
                        if (fromParticipant && fromParticipant.email.toLowerCase() !== userEmail.toLowerCase()) {
                            lastRelevantMessage = msg;
                            break;
                        }
                    }
                }
                
                const lastMessageDate = new Date(getHeaderValue(lastRelevantMessage.payload.headers, 'Date')).toISOString();
                const snippet = lastRelevantMessage.snippet;
                const isUnread = lastMessage.labelIds.includes('UNREAD');
                const unsubscribeHeader = getHeaderValue(lastRelevantMessage.payload.headers, 'List-Unsubscribe');

                const allParticipantsHeaders = data.messages.flatMap((msg: any) => [getHeaderValue(msg.payload.headers, 'From'), getHeaderValue(msg.payload.headers, 'To')]);
                const participants = [...new Set(allParticipantsHeaders.flat())]
                    .map(parseParticipant)
                    .filter((p): p is { name: string; email: string } => p !== null);

                participants.forEach(p => {
                    // Filter out user's own email from contacts
                    if (userEmail && p.email.toLowerCase() === userEmail.toLowerCase()) {
                        return;
                    }

                    const contactInfo = contactMap.get(p.email.toLowerCase());
                    const existing = conversations.get(p.email);

                    if (!existing || new Date(lastMessageDate) > new Date(existing.lastMessageDate)) {
                        conversations.set(p.email, {
                            name: p.name,
                            email: p.email,
                            snippet,
                            lastMessageDate,
                            isUnread: existing ? existing.isUnread || isUnread : isUnread,
                            picture: contactInfo?.picture,
                            isUnsubscribable: !!unsubscribeHeader,
                            unsubscribeLink: unsubscribeHeader,
                            threadId: data.id,
                        });
                    }
                });
            }
        });

    // 4. Sort by last message date and return
    return Array.from(conversations.values())
        .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
};

export const getMessagesForContact = async (accessToken: string, contactEmail: string, maxResults = 50): Promise<FullEmail[]> => {
    const query = `from:${contactEmail} OR to:${contactEmail}`;
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    
    const searchResponse = await fetch(searchUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(searchResponse, `search messages for contact ${contactEmail}`);
    const searchData = await searchResponse.json();

    if (!searchData.messages) {
        return [];
    }

    const emailPromises = searchData.messages.map((msg: { id: string }) => getEmail(accessToken, msg.id));
    const emails = await Promise.all(emailPromises);
    
    // Sort chronologically, handling potential invalid dates
    return emails.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        // Treat invalid dates as very old
        return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });
};

export const markAsRead = async (accessToken: string, messageId: string): Promise<void> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify({
            removeLabelIds: ['UNREAD']
        }),
    });
    // Let the caller handle API errors.
    await handleApiError(response, `mark email ${messageId} as read`);
};

export const trashEmail = async (accessToken: string, messageId: string): Promise<void> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
    });
    await handleApiError(response, `trash email ${messageId}`);
};

export const trashThread = async (accessToken: string, threadId: string): Promise<void> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
    });
    await handleApiError(response, `trash thread ${threadId}`);
};

export const getSentEmails = async (accessToken: string, maxResults = 5): Promise<string[]> => {
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent&maxResults=${maxResults}`;
    const searchResponse = await fetch(searchUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(searchResponse, 'search sent emails');
    const searchData = await searchResponse.json();

    if (!searchData.messages) {
        return [];
    }

    const emailBodies: string[] = [];

    for (const message of searchData.messages) {
        const messageId = message.id;
        const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
        const messageResponse = await fetch(messageUrl, { headers: getAuthHeaders(accessToken) });
        if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            const { bodyHtml } = parseMessagePayload(messageId, messageData.payload);
            if(bodyHtml) {
                emailBodies.push(bodyHtml);
            }
        }
    }
    return emailBodies;
};

export const sendEmail = async (
    accessToken: string, 
    to: string, 
    subject: string, 
    body: string, 
    cc?: string, 
    bcc?: string,
    threadId?: string,
    inReplyTo?: string,
    references?: string
): Promise<void> => {
    const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
    ];
    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    if (inReplyTo) messageParts.push(`In-Reply-To: ${inReplyTo}`);
    if (references) messageParts.push(`References: ${references}`);

    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('MIME-Version: 1.0');
    messageParts.push(''); // Separator
    messageParts.push(body);
    const rawMessage = messageParts.join('\r\n');

    const encodedMessage = base64urlEncode(rawMessage);

    const requestBody: { raw: string; threadId?: string } = { raw: encodedMessage };
    if (threadId) {
        requestBody.threadId = threadId;
    }

    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(requestBody),
    });

    await handleApiError(response, 'send email');
};

export const createDraft = async (accessToken: string, to: string, subject: string, body: string, cc?: string, bcc?: string): Promise<void> => {
    const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
    ];
    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('MIME-Version: 1.0');
    messageParts.push(''); // Separator
    messageParts.push(body);
    const rawMessage = messageParts.join('\n');

    const encodedMessage = base64urlEncode(rawMessage);

    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify({
            message: {
                raw: encodedMessage,
            },
        }),
    });

    await handleApiError(response, 'create draft');
};

export const listLabels = async (accessToken: string): Promise<GmailLabel[]> => {
    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels';
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'list labels');
    const data = await response.json();
    return data.labels || [];
};

export const moveEmail = async (accessToken: string, messageId: string, addLabelIds: string[], removeLabelIds: string[]): Promise<void> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
    const body: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};
    if (addLabelIds.length > 0) body.addLabelIds = addLabelIds;
    if (removeLabelIds.length > 0) body.removeLabelIds = removeLabelIds;

    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(body),
    });
    await handleApiError(response, `move email ${messageId}`);
};

export const markAllAsRead = async (accessToken: string): Promise<void> => {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox`;
    const listResponse = await fetch(listUrl, { headers: getAuthHeaders(accessToken) });
    await handleApiError(listResponse, 'list unread messages for batch mark as read');
    const listData = await listResponse.json();

    if (!listData.messages || listData.messages.length === 0) {
        return; // Nothing to mark as read
    }
    const messageIds = listData.messages.map((msg: { id: string }) => msg.id);

    const batchModifyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify`;
    const response = await fetch(batchModifyUrl, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify({
            ids: messageIds,
            removeLabelIds: ['UNREAD']
        }),
    });
    await handleApiError(response, 'batch mark as read');
};

export const unsubscribe = async (accessToken: string, unsubscribeLinkHeader: string): Promise<{ action: 'mailto' | 'http' | 'none', value?: string }> => {
    // Prioritize mailto links
    const mailtoMatch = unsubscribeLinkHeader.match(/<mailto:([^>]+)>/);
    if (mailtoMatch && mailtoMatch[1]) {
        try {
            const mailtoContent = mailtoMatch[1];
            const mailtoUrl = new URL(`mailto:${mailtoContent}`);
            const to = mailtoUrl.pathname;
            const subject = mailtoUrl.searchParams.get('subject') || 'Unsubscribe';
            const body = mailtoUrl.searchParams.get('body') || 'Unsubscribe Request';

            // Use the existing sendEmail function to perform the action
            await sendEmail(accessToken, to, subject, body);
            return { action: 'mailto' };
        } catch (e) {
            console.error("Failed to parse mailto link:", e);
        }
    }

    // Fallback to http links
    const httpMatch = unsubscribeLinkHeader.match(/<(https?:[^>]+)>/);
    if (httpMatch && httpMatch[1]) {
        return { action: 'http', value: httpMatch[1] };
    }

    return { action: 'none' };
};