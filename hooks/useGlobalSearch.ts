import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useOrganizerState } from './useOrganizerState';
import { TodoItem, ShoppingItem, NoteItem, CustomList, GenericItem, Project, CalendarEvent, Contact, FullEmail } from '../types';
import * as geminiService from '../services/geminiService';
import * as googleMailService from '../services/googleMailService';
import * as googleCalendarService from '../services/googleCalendarService';
import * as googlePeopleService from '../services/googlePeopleService';

export interface SearchResults {
    todos: TodoItem[];
    shopping: ShoppingItem[];
    notes: NoteItem[];
    // FIX: Flatten the custom search result structure to include necessary properties directly.
    custom: (GenericItem & { listId: string, listTitle: string })[];
    projects: Project[];
    events: CalendarEvent[];
    contacts: Contact[];
    emails: FullEmail[];
}

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

export const useGlobalSearch = (
    organizerState: ReturnType<typeof useOrganizerState>,
    auth: ReturnType<typeof useAuth>
) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Partial<SearchResults>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const debouncedQuery = useDebounce(query, 500);

    const searchControllerRef = useRef<AbortController | null>(null);

    const resetSearch = useCallback(() => {
        if (searchControllerRef.current) {
            searchControllerRef.current.abort();
        }
        setQuery('');
        setResults({});
        setIsLoading(false);
        setIsAiLoading(false);
    }, []);

    useEffect(() => {
        if (searchControllerRef.current) {
            searchControllerRef.current.abort();
        }

        if (!debouncedQuery.trim()) {
            resetSearch();
            return;
        }

        const controller = new AbortController();
        searchControllerRef.current = controller;

        const performSearch = async () => {
            setIsLoading(true);
            setIsAiLoading(true);
            setResults({});

            // --- 1. Local Search (synchronous) ---
            const lowerQuery = debouncedQuery.toLowerCase();
            const localResults: Partial<SearchResults> = {
                todos: organizerState.todos.filter(t => t.task.toLowerCase().includes(lowerQuery)),
                shopping: organizerState.shoppingList.filter(s => s.item.toLowerCase().includes(lowerQuery)),
                notes: organizerState.notes.filter(n => n.content.toLowerCase().includes(lowerQuery)),
                projects: organizerState.projects.filter(p => p.title.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery)),
                // FIX: Map custom list items to a new structure that includes list info.
                custom: organizerState.customLists.flatMap(list =>
                    list.items.filter(item => item.text.toLowerCase().includes(lowerQuery))
                              .map(item => ({ ...item, listId: list.id, listTitle: list.title }))
                ),
            };
            
            if (controller.signal.aborted) return;
            setResults(localResults);
            setIsLoading(false);

            // --- 2. External & AI Search (asynchronous) ---
            if (!auth.accessToken) {
                setIsAiLoading(false);
                return;
            }

            try {
                const { accessToken } = auth;
                
                const directSearchPromise = Promise.all([
                    googleMailService.searchEmails(accessToken, debouncedQuery, 10),
                    googleCalendarService.searchEvents(accessToken, debouncedQuery, 'primary'),
                    googlePeopleService.searchContacts(accessToken, debouncedQuery)
                ]);
                
                const aiSearchPromise = geminiService.interpretSearchQuery(debouncedQuery)
                    .then(async (structuredQuery) => {
                        const aiEmailPromise = structuredQuery.gmail
                            ? googleMailService.searchEmails(accessToken, structuredQuery.gmail, 10)
                            : Promise.resolve(null);
                        
                        const aiEventPromise = structuredQuery.calendar
                            ? googleCalendarService.searchEvents(accessToken, structuredQuery.calendar, 'primary')
                            : Promise.resolve(null);

                        return Promise.all([aiEmailPromise, aiEventPromise]);
                    });
                
                const [directResults, aiResults] = await Promise.all([directSearchPromise, aiSearchPromise]);
                
                if (controller.signal.aborted) return;
                
                const [directEmails, directEvents, contacts] = directResults;
                const [aiEmails, aiEvents] = aiResults;

                const finalEmails = aiEmails || directEmails;
                const finalEvents = aiEvents || directEvents;
                
                setResults(prev => ({
                    ...prev,
                    emails: finalEmails,
                    events: finalEvents,
                    contacts,
                }));

            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    console.log("Search aborted.");
                } else {
                    console.error("Global search failed:", error);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsAiLoading(false);
                }
            }
        };

        performSearch();

        return () => {
            controller.abort();
        };
    }, [debouncedQuery, organizerState, auth.accessToken, resetSearch]);

    return {
        query,
        setQuery,
        results,
        isLoading,
        isAiLoading,
        resetSearch,
    };
};