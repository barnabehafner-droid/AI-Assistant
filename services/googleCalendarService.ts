import { CalendarEvent, GoogleCalendar, TokenExpiredError } from '../types';

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

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

export const listCalendars = async (accessToken: string): Promise<GoogleCalendar[]> => {
    const response = await fetch(CALENDAR_LIST_URL, {
        headers: getAuthHeaders(accessToken),
    });
    await handleApiError(response, 'fetch calendars');
    const data = await response.json();
    return data.items || [];
};

export const listEventsForTimeRange = async (accessToken: string, startTime: string, endTime: string, calendarId: string): Promise<CalendarEvent[]> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(startTime)}&timeMax=${encodeURIComponent(endTime)}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    if (!response.ok) {
        // For this function, we don't throw on error to avoid breaking Promise.all in App.tsx
        // but we still need to handle token expiration.
        if (response.status === 401) {
             throw new TokenExpiredError('Token expired while fetching events.');
        }
        console.error(`Failed to fetch events for calendar ${calendarId}: ${response.statusText}`);
        return []; // Return empty array on other errors
    }
    const data = await response.json();
    return data.items || [];
};


export const searchEvents = async (accessToken: string, query: string, calendarId: string = 'primary'): Promise<CalendarEvent[]> => {
    if (!query) return [];
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events?q=${encodeURIComponent(query)}&maxResults=10&singleEvents=true&orderBy=startTime`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    await handleApiError(response, `search events in calendar "${calendarId}"`);
    const data = await response.json();
    return (data.items || []);
};

export const searchMultipleCalendars = async (accessToken: string, query: string, calendarIds: string[]): Promise<CalendarEvent[]> => {
    if (!query || calendarIds.length === 0) {
        return [];
    }
    const searchPromises = calendarIds.map(calendarId => 
        searchEvents(accessToken, query, calendarId).catch(error => {
            if (error instanceof TokenExpiredError) throw error; // Re-throw critical auth errors
            console.warn(`Failed to search calendar ${calendarId}, continuing with next.`, error);
            return []; // Ignore failures for individual calendars
        })
    );
    const results = await Promise.all(searchPromises);
    return results.flat();
};


export const createEvent = async (accessToken: string, calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(event),
    });
    await handleApiError(response, 'create event');
    return response.json();
};

export const updateEvent = async (accessToken: string, calendarId: string, eventId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(event),
    });
    await handleApiError(response, 'update event');
    return response.json();
};

export const deleteEvent = async (accessToken: string, calendarId: string, eventId: string): Promise<void> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(accessToken),
    });

    if (!response.ok && response.status !== 204) {
        await handleApiError(response, 'delete event');
    }
};