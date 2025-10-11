import { CalendarEvent, GoogleCalendar } from '../types';

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

const getAuthHeaders = (accessToken: string) => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
});

export const listCalendars = async (accessToken: string): Promise<GoogleCalendar[]> => {
    const response = await fetch(CALENDAR_LIST_URL, {
        headers: getAuthHeaders(accessToken),
    });
    if (!response.ok) {
        // FIX: The error "Failed to fetch initial events" is likely caused by an expired token.
        // Throwing a more specific error can help debugging.
        if (response.status === 401) {
            throw new Error("Unauthorized: The access token is expired or invalid.");
        }
        throw new Error(`Failed to fetch calendars: ${response.statusText}`);
    }
    const data = await response.json();
    return data.items || [];
};

export const listEventsForTimeRange = async (accessToken: string, startTime: string, endTime: string, calendarId: string): Promise<CalendarEvent[]> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(startTime)}&timeMax=${encodeURIComponent(endTime)}&singleEvents=true&orderBy=startTime&maxResults=250`;
    const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
    if (!response.ok) {
        console.error(`Failed to fetch events for calendar ${calendarId}: ${response.statusText}`);
        return []; // Return empty array on error to not break Promise.all
    }
    const data = await response.json();
    return data.items || [];
};


export const searchEvents = async (accessToken: string, query: string, calendarId: string = 'primary'): Promise<CalendarEvent[]> => {
    if (!query) return [];
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events?q=${encodeURIComponent(query)}&maxResults=10&singleEvents=true&orderBy=startTime`;
    try {
        const response = await fetch(url, { headers: getAuthHeaders(accessToken) });
        if (!response.ok) {
            console.warn(`Could not search events for calendar "${calendarId}"`);
            return [];
        }
        const data = await response.json();
        return (data.items || []);
    } catch (error) {
        console.warn(`Error searching calendar "${calendarId}":`, error);
        return [];
    }
};


export const createEvent = async (accessToken: string, calendarId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(event),
    });

    if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
    }

    return response.json();
};

export const updateEvent = async (accessToken: string, calendarId: string, eventId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: getAuthHeaders(accessToken),
        body: JSON.stringify(event),
    });

    if (!response.ok) {
        throw new Error(`Failed to update event: ${response.statusText}`);
    }

    return response.json();
};

export const deleteEvent = async (accessToken: string, calendarId: string, eventId: string): Promise<void> => {
    const url = `${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(accessToken),
    });

    if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to delete event: ${response.statusText}`);
    }
};
