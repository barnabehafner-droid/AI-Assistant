import { Contact, TokenExpiredError } from '../types';

const PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me/connections';
const PEOPLE_SEARCH_URL = 'https://people.googleapis.com/v1/people:searchContacts';


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

const mapPersonToContact = (person: any): Contact | null => {
    const displayName = person.names?.[0]?.displayName;
    const email = person.emailAddresses?.[0]?.value;
    const picture = person.photos?.[0]?.url;

    if (displayName && email) {
        return {
            resourceName: person.resourceName,
            displayName,
            email,
            picture,
        };
    }
    return null;
}

export const listContacts = async (accessToken: string): Promise<Contact[]> => {
    const url = `${PEOPLE_API_URL}?personFields=names,emailAddresses,photos&pageSize=1000`;
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
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, 'search contacts');

    const data = await response.json();
    const results = data.results || [];

    return results
        .map((result: any) => mapPersonToContact(result.person))
        .filter((contact: Contact | null): contact is Contact => contact !== null);
};

export const createContact = async (accessToken: string, name: string, email?: string, phone?: string): Promise<any> => {
    const url = 'https://people.googleapis.com/v1/people:createContact';
    
    const person: any = {
        names: [{ givenName: name }]
    };
    if (email) {
        person.emailAddresses = [{ value: email }];
    }
    if (phone) {
        person.phoneNumbers = [{ value: phone }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(person),
    });

    await handleApiError(response, 'create contact');
    return response.json();
};