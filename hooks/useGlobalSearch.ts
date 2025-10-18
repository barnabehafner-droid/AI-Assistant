import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useOrganizerState } from './useOrganizerState';
import { TodoItem, ShoppingItem, NoteItem, CustomList, GenericItem, Project, CalendarEvent, Contact, FullEmail } from '../types';
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
    localData: {
        todos: TodoItem[];
        shoppingList: ShoppingItem[];
        notes: NoteItem[];
        projects: Project[];
        customLists: CustomList[];
        visibleCalendarIds: string[];
    },
    auth: ReturnType<typeof useAuth>
) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Partial<SearchResults>>({});
    const [isLoading, setIsLoading] = useState(false);
    const debouncedQuery = useDebounce(query, 500);

    const searchControllerRef = useRef<AbortController | null>(null);

    const resetSearch = useCallback(() => {
        if (searchControllerRef.current) {
            searchControllerRef.current.abort();
        }
        setQuery('');
        setResults({});
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (searchControllerRef.current) {
            searchControllerRef.current.abort();
        }

        if (!debouncedQuery.trim()) {
            setResults({});
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        searchControllerRef.current = controller;

        const performSearch = async () => {
            setIsLoading(true);
            setResults({});

            // --- 1. Local Search (synchronous, keyword-based) ---
            const lowerQuery = debouncedQuery.toLowerCase();
            const localResults: Partial<SearchResults> = {
                todos: localData.todos.filter(t => t.task.toLowerCase().includes(lowerQuery)),
                shopping: localData.shoppingList.filter(s => s.item.toLowerCase().includes(lowerQuery)),
                notes: localData.notes.filter(n => n.content.toLowerCase().includes(lowerQuery)),
                projects: localData.projects.filter(p => p.title.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery)),
                custom: localData.customLists.flatMap(list =>
                    list.items.filter(item => item.text.toLowerCase().includes(lowerQuery))
                              .map(item => ({ ...item, listId: list.id, listTitle: list.title }))
                ),
            };
            
            if (controller.signal.aborted) return;
            setResults(localResults);

            // --- 2. External Search (asynchronous) ---
            if (!auth.accessToken) {
                setIsLoading(false);
                return;
            }

            try {
                const { accessToken } = auth;
                const { visibleCalendarIds } = localData;

                const calendarIdsToSearch = (visibleCalendarIds && visibleCalendarIds.length > 0) ? visibleCalendarIds : ['primary'];
                
                const [emails, events, contacts] = await Promise.all([
                    googleMailService.searchEmails(accessToken, debouncedQuery, 10).catch(err => { console.error("Direct email search failed:", err); return []; }),
                    googleCalendarService.searchMultipleCalendars(accessToken, debouncedQuery, calendarIdsToSearch).catch(err => { console.error("Direct multi-calendar search failed:", err); return []; }),
                    googlePeopleService.searchContacts(accessToken, debouncedQuery).catch(err => { console.error("Direct contact search failed:", err); return []; })
                ]);
                
                if (controller.signal.aborted) return;
                
                setResults(prev => ({
                    ...prev,
                    emails,
                    events,
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
                    setIsLoading(false);
                }
            }
        };

        performSearch();

        return () => {
            controller.abort();
        };
    }, [debouncedQuery, localData, auth.accessToken]);

    return {
        query,
        setQuery,
        results,
        isLoading,
        resetSearch,
    };
};