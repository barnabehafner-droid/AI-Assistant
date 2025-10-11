import { FullEmail } from '../types';
import { summarizeEmail } from './geminiService';

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
        { id: 'mock1', from: 'John Doe <john.doe@example.com>', to: 'me', subject: 'Project Update', snippet: 'Here is the latest update on the project...', body: 'Hi team,<br><br>Just wanted to share the latest project update. Things are going well and we are on track.<br><br>Best,<br>John', isRead: false, aiSummary: 'John shares a positive update on project progress.', labelIds: ['INBOX'] },
        { id: 'mock2', from: 'Jane Smith <jane.smith@example.com>', to: 'me', subject: 'Lunch tomorrow?', snippet: 'Are you free for lunch tomorrow to discuss the new design?', body: 'Hey! Are you free for lunch tomorrow? I would love to discuss the new design concepts with you. Let me know!', isRead: false, aiSummary: 'Jane proposes a lunch meeting tomorrow to discuss new designs.', labelIds: ['INBOX'] },
        { id: 'mock3', from: 'LinkedIn', to: 'me', subject: 'You appeared in 9 searches this week', snippet: 'See who\'s looking at your profile.', body: 'Your profile is getting attention!', isRead: true, aiSummary: 'LinkedIn weekly search appearance update.', labelIds: ['INBOX', 'CATEGORY_SOCIAL'] },
        { id: 'mock4', from: 'Alerts <alerts@service.com>', to: 'me', subject: 'Security Alert', snippet: 'A new device has signed into your account.', body: 'A new sign-in was detected on a Windows device. If this was not you, please secure your account immediately.', isRead: false, aiSummary: 'A security alert reports a new sign-in from a Windows device.', labelIds: ['INBOX', 'CATEGORY_UPDATES'] },
        { id: 'mock5', from: 'Stack Overflow', to: 'me', subject: '[Stack Overflow] New answers to your question', snippet: 'Your question "How to..." has new answers.', body: 'There are new answers to your question.', isRead: true, aiSummary: 'StackOverflow has new answers for your question.', labelIds: ['INBOX', 'CATEGORY_FORUMS'] },
    ];
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

    const results: FullEmail[] = [];

    for (const message of searchData.messages) {
        const messageId = message.id;
        const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`;
        const messageResponse = await fetch(messageUrl, { headers: getAuthHeaders(accessToken) });
        if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            const getHeader = (name: string) => messageData.payload.headers.find((h: any) => h.name === name)?.value || '';
            
            results.push({
                id: messageData.id,
                from: getHeader('From'),
                subject: getHeader('Subject'),
                snippet: messageData.snippet,
                to: '', // Not available in metadata
                body: '', // Not available in metadata
                isRead: !messageData.labelIds.includes('UNREAD'),
            });
        }
    }
    return results;
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

    // Now, generate summaries for each email
    const summarizedEmailPromises = emails.map(async (email) => {
        if (email.body) {
            const summary = await summarizeEmail(email.subject, email.body);
            return { ...email, aiSummary: summary };
        }
        return { ...email, aiSummary: email.snippet }; // Fallback to snippet
    });

    const emailsWithSummaries = await Promise.all(summarizedEmailPromises);

    return { emails: emailsWithSummaries, nextPageToken: listData.nextPageToken || null };
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

    const summarizedEmailPromises = emails.map(async (email) => {
        if (email.body) {
            const summary = await summarizeEmail(email.subject, email.body);
            return { ...email, aiSummary: summary };
        }
        return { ...email, aiSummary: email.snippet }; // Fallback to snippet
    });

    return await Promise.all(summarizedEmailPromises);
};


const extractBodyFromEmail = (data: any): string => {
    let bodyData = '';
    let isHtml = false;
    
    const findPart = (parts: any[], desiredMimeType: string): any | null => {
        for (const part of parts) {
            if (part.mimeType === desiredMimeType) {
                return part;
            }
            if (part.parts) {
                const nestedPart = findPart(part.parts, desiredMimeType);
                if (nestedPart) return nestedPart;
            }
        }
        return null;
    };

    if (data.payload.parts) {
        // Prioritize HTML part
        const htmlPart = findPart(data.payload.parts, 'text/html');
        if (htmlPart && htmlPart.body?.data) {
            bodyData = htmlPart.body.data;
            isHtml = true;
        } else {
            // Fallback to plain text
            const textPart = findPart(data.payload.parts, 'text/plain');
            if (textPart && textPart.body?.data) {
                bodyData = textPart.body.data;
            }
        }
    } else if (data.payload.body?.data) {
        // Handle simple emails
        bodyData = data.payload.body.data;
        if (data.payload.mimeType === 'text/html') {
            isHtml = true;
        }
    }

    if (bodyData) {
        try {
            // The robust way to decode base64url with UTF-8 support
            const base64 = bodyData.replace(/-/g, '+').replace(/_/g, '/');
            const binaryStr = atob(base64);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const decodedString = new TextDecoder('utf-8').decode(bytes);

            if (isHtml) {
                return decodedString;
            } else {
                // Convert plain text to basic HTML for rendering
                return decodedString
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;')
                    .replace(/\r\n/g, '<br>')
                    .replace(/\n/g, '<br>');
            }
        } catch (e) {
            console.error("Failed to decode base64 email body:", e);
            return '<p>Error decoding email content.</p>';
        }
    }

    return '';
};


export const getEmail = async (accessToken: string, messageId: string): Promise<FullEmail> => {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'get email content');
    const data = await response.json();

    const getHeader = (name: string) => data.payload.headers.find((h: any) => h.name === name)?.value || '';
    
    return {
        id: data.id,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        body: extractBodyFromEmail(data),
        snippet: data.snippet,
        isRead: !data.labelIds.includes('UNREAD'),
        labelIds: data.labelIds || [],
    };
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
            const body = extractBodyFromEmail(messageData);
            if(body) {
                emailBodies.push(body);
            }
        }
    }
    return emailBodies;
};

export const sendEmail = async (accessToken: string, to: string, subject: string, body: string, cc?: string, bcc?: string): Promise<void> => {
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

    const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify({ raw: encodedMessage }),
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