import { Contact } from '../types';

const PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me/connections';
const PEOPLE_SEARCH_URL = 'https://people.googleapis.com/v1/people:searchContacts';


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

const mapPersonToContact = (person: any): Contact | null => {
    const displayName = person.names?.[0]?.displayName;
    const email = person.emailAddresses?.[0]?.value;

    if (displayName && email) {
        return {
            resourceName: person.resourceName,
            displayName,
            email,
        };
    }
    return null;
}

export const listContacts = async (accessToken: string): Promise<Contact[]> => {
    const url = `${PEOPLE_API_URL}?personFields=names,emailAddresses&pageSize=1000`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'list contacts');

    const data = await response.json();
    const connections = data.connections || [];

    const contacts: Contact[] = connections
        .map(mapPersonToContact)
        .filter((contact: Contact | null): contact is Contact => contact !== null);
    
    return contacts;
};

export const searchContacts = async (accessToken: string, query: string): Promise<Contact[]> => {
    if (!query) return [];
    const url = `${PEOPLE_SEARCH_URL}?query=${encodeURIComponent(query)}&readMask=names,emailAddresses&pageSize=10`;
    try {
        const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
        await handleApiError(response, 'search contacts');

        const data = await response.json();
        const results = data.results || [];

        return results
            .map((result: any) => mapPersonToContact(result.person))
            .filter((contact: Contact | null): contact is Contact => contact !== null);
    } catch (error) {
        console.error('Failed to search contacts:', error);
        return [];
    }
};
