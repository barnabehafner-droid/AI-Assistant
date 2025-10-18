import { AppData, TokenExpiredError, GoogleDriveFile } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILENAME = 'organizer-data.json';

interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

const getAuthHeaders = (accessToken: string) => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
});

// Helper for more descriptive errors
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


export const findFile = async (accessToken: string): Promise<DriveFile | null> => {
    const query = `name='${FILENAME}'`;
    const url = `${DRIVE_API_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
        headers: getAuthHeaders(accessToken),
    });

    await handleApiError(response, 'find file');

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
};

export const getFileContent = async (accessToken: string, fileId: string): Promise<AppData> => {
    const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
    const response = await fetch(url, {
        headers: getAuthHeaders(accessToken),
    });

    await handleApiError(response, 'get file content');

    return response.json();
};

export const saveFileContent = async (accessToken: string, fileId: string, data: AppData): Promise<void> => {
    const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    await handleApiError(response, 'save file content');
};

export const createFile = async (accessToken: string, data: AppData): Promise<string> => {
    const metadata = {
        name: FILENAME,
        parents: ['appDataFolder'],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        body: form,
    });
    
    await handleApiError(response, 'create file');

    const createdFile = await response.json();
    return createdFile.id;
};

export const searchFiles = async (accessToken: string, query: string): Promise<GoogleDriveFile[]> => {
    // Search for non-trashed files, prioritizing documents, spreadsheets, and presentations.
    // Searches both file names and content.
    const q = `(name contains '${query}' or fullText contains '${query}') and trashed = false`;
    const fields = 'files(id, name)';
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=10`;

    const response = await fetch(url, {
        headers: getAuthHeaders(accessToken),
    });

    await handleApiError(response, 'search Google Drive files');
    const data = await response.json();
    return data.files || [];
};