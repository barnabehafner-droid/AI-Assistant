import React, { useState, useEffect, useCallback, useRef } from 'react';
import InputBar from './components/InputBar';
import TodoList from './components/TodoList';
import ShoppingList from './components/ShoppingList';
import NotesList from './components/NotesList';
import CustomListComponent from './components/CustomListComponent';
import AddListComponent from './components/AddListComponent';
import ProjectPlannerModal from './components/ProjectPlannerModal';
import { organizeInput, sanitizeTitleForKey, analyzeWritingStyle, extractItemsFromEmailForList } from './services/geminiService';
import { CameraIcon, RectangleGroupIcon, Bars3Icon, ArrowUturnLeftIcon, MagnifyingGlassIcon, EllipsisVerticalIcon } from './components/icons';
import { useOrganizerState, DragItemInfo, ListType, QueuedItem } from './hooks/useOrganizerState';
import { useConversationalChat } from './hooks/useConversationalChat';
import { useVideoChat } from './hooks/useVideoChat';
import ConfirmationModal from './components/ConfirmationModal';
import CameraModal from './components/CameraModal';
import { OrganizedData, Project, VoiceSettings, CalendarEvent, GoogleCalendar, FullEmail, Contact, EmailData, Priority, AllItemTypes } from './types';
import ConversationalChatButton from './components/ConversationalChatButton';
import TodoDetailModal from './components/TodoDetailModal';
import NoteDetailModal from './components/NoteDetailModal';
import ShoppingDetailModal from './components/ShoppingDetailModal';
import CustomListItemDetailModal from './components/CustomListItemDetailModal';
import TrashDropZone from './components/TrashDropZone';
import ProjectsDashboard from './components/ProjectsDashboard';
import ProjectDetailView from './components/ProjectDetailView';
import CreateProjectModal from './components/CreateProjectModal';
import LinkItemsModal from './components/LinkItemsModal';
import SettingsModal from './components/SettingsModal';
import DuplicateConfirmationModal from './components/DuplicateConfirmationModal';
import { useAuth } from './hooks/useAuth';
import CalendarWidget from './components/ScheduleView';
import UndoToast from './components/UndoToast';
import * as googleCalendarService from './services/googleCalendarService';
import * as googleMailService from './services/googleMailService';
import * as googlePeopleService from './services/googlePeopleService';
import CameraChoiceModal from './components/CameraChoiceModal';
import PhotoAnalyzerModal from './components/PhotoAnalyzerModal';
import EmailSearchResultsModal from './components/EmailSearchResultsModal';
import EmailDetailModal from './components/EmailDetailModal';
import EmailComposerModal from './components/EmailComposerModal';
import GmailView from './components/GmailView';
import Auth from './components/Auth';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import GlobalSearchModal from './components/GlobalSearchModal';
import EventModal from './components/EventModal';
import SelectionActionBar from './components/SelectionActionBar';


type EventConflict = {
    event: { summary: string; start: { dateTime: string }; end: { dateTime: string } };
    conflictingEvents: CalendarEvent[];
};

const loadFromCache = <T,>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.warn(`Failed to load ${key} from cache`, e);
        localStorage.removeItem(key); // Clear corrupted data
        return null;
    }
};

const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`Failed to save ${key} to cache`, e);
    }
};

const App: React.FC = () => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [selectedShoppingItemId, setSelectedShoppingItemId] = useState<string | null>(null);
    const [selectedCustomItem, setSelectedCustomItem] = useState<{ listId: string, itemId: string } | null>(null);
    const [draggingItem, setDraggingItem] = useState<DragItemInfo | null>(null);
    const [dropTarget, setDropTarget] = useState<{ type: ListType, listId?: string } | null>(null);
    const [isTrashActive, setIsTrashActive] = useState(false);
    const [dataSyncKey, setDataSyncKey] = useState(0);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [isCalendarLoading, setIsCalendarLoading] = useState(true);
    const [eventConflict, setEventConflict] = useState<EventConflict | null>(null);
    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [primaryCalendarId, setPrimaryCalendarId] = useState<string | null>(null);
    const [undoToastInfo, setUndoToastInfo] = useState<{ message: string; key: number } | null>(null);
    const [isCameraChoiceModalOpen, setIsCameraChoiceModalOpen] = useState(false);
    const [isPhotoAnalyzerModalOpen, setIsPhotoAnalyzerModalOpen] = useState(false);
    const [emailSearchResults, setEmailSearchResults] = useState<FullEmail[]>([]);
    const [isEmailSearchModalOpen, setIsEmailSearchModalOpen] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<FullEmail | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
    const [emailToCompose, setEmailToCompose] = useState<EmailData | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>({
        gmail: true,
        schedule: true,
    });
    
    // Gmail state
    const [gmailEmails, setGmailEmails] = useState<FullEmail[]>([]);
    const [unreadGmailEmails, setUnreadGmailEmails] = useState<FullEmail[]>([]);
    const [isGmailLoading, setIsGmailLoading] = useState(true);
    const [gmailError, setGmailError] = useState<string | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [gmailNextPageToken, setGmailNextPageToken] = useState<string | null>(null);
    const [isMoreGmailLoading, setIsMoreGmailLoading] = useState(false);

    // New state for view management
    const [view, setView] = useState<'lists' | 'projectsDashboard' | 'projectDetail'>('lists');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [linkingProject, setLinkingProject] = useState<Project | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const isProjectView = view === 'projectsDashboard' || view === 'projectDetail';

    const auth = useAuth();
    const organizerState = useOrganizerState(auth.accessToken);
    const search = useGlobalSearch(organizerState, auth);

    const {
        todos, shoppingList, notes, customLists, projects, defaultCalendarId,
        addTodo, addShoppingItem, addNote, addProject, deleteProject, updateProjectLinks, updateProjectVisibility,
        handleToggleTodo, handleDeleteTodo, editTodo, editTodoPriority, editTodoDescription, addTodoSubtask, toggleTodoSubtask, deleteTodoSubtask, editTodoSubtask, editTodoDueDate,
        handleToggleShoppingItem, handleDeleteShoppingItem, editShoppingItem, editShoppingItemDetails,
        handleDeleteNote, editNote, revertNoteToVersion,
        addCustomList, deleteCustomList, addCustomListItem,
        deleteCustomListItem, toggleCustomListItem, editCustomListItemDetails,
        reorderTodos, reorderShoppingList, reorderNotes, reorderCustomListItems, moveItem,
        fileInputRef, handleExportData, handleImportClick, handleFileChange,
        importConfirmationFile, confirmImport, cancelImport,
        todoSortOrder, setTodoSortOrder,
        activeFilter, clearFilter,
        duplicateConfirmation, processAdditionQueue, confirmDuplicateAdd, clearDuplicateConfirmation,
        voiceSettings, updateVoiceSettings, setDefaultCalendarId, forceSync,
        history, undoLastAction,
        visibleCalendarIds, updateVisibleCalendars,
        linkItemToProject, unlinkItemFromProject,
        selection, selectedIds, startSelectionMode, endSelectionMode, toggleItemSelected, selectAllInList, clearSelection,
        deleteSelectedItems, toggleSelectedItemsCompleted, linkSelectedItemsToProject, moveSelectedItems,
        setSelectedItemsPriority, setSelectedItemsDueDate, setSelectedShoppingItemsStore, mergeSelectedNotes,
    } = organizerState;

    const handleOpenEvent = (event: CalendarEvent | null) => {
        setSelectedEvent(event);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setIsMoreMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleToggleWidget = (widgetId: string) => {
        setCollapsedWidgets(prev => ({
            ...prev,
            [widgetId]: !prev[widgetId],
        }));
    };

    const showUndoToast = (message: string | undefined | null, isSuccess: boolean = true) => {
        if (message) {
            setUndoToastInfo({ message, key: Date.now() });
        }
    };
    
    const handleUndo = () => {
        undoLastAction();
        setUndoToastInfo(null); 
    };
    
    const forceSyncAll = () => {
        organizerState.forceSync(); // Syncs app data from Drive
        setDataSyncKey(k => k + 1); // Triggers calendar/gmail sync
    };

    // Main effect for loading from cache and performing background sync
    useEffect(() => {
        if (!auth.accessToken) {
            setGmailEmails(googleMailService.createMockEmails());
            setUnreadGmailEmails(googleMailService.createMockEmails().filter(e => !e.isRead).slice(0, 5));
            setIsGmailLoading(false);
            setIsCalendarLoading(false);
            return;
        };

        // 1. Load data from cache for instant UI
        const cachedEvents = loadFromCache<CalendarEvent[]>('calendar_events');
        if (cachedEvents) setCalendarEvents(cachedEvents);
        
        const cachedGmail = loadFromCache<FullEmail[]>('gmail_emails');
        if (cachedGmail) setGmailEmails(cachedGmail);
        
        const cachedUnread = loadFromCache<FullEmail[]>('gmail_unread_emails');
        if (cachedUnread) setUnreadGmailEmails(cachedUnread);

        setIsGmailLoading(!cachedGmail);
        setIsCalendarLoading(!cachedEvents);

        // 2. Start background sync for all Google services
        const syncAllGoogleData = async (token: string) => {
            // Calendar Sync
            try {
                const userCalendars = await googleCalendarService.listCalendars(token);
                setCalendars(userCalendars);
                const primary = userCalendars.find(c => c.primary);
                setPrimaryCalendarId(primary?.id || null);

                const calendarsToSync = (visibleCalendarIds && visibleCalendarIds.length > 0)
                    ? userCalendars.filter(c => visibleCalendarIds.includes(c.id))
                    : userCalendars.filter(c => c.primary);

                if (calendarsToSync.length > 0) {
                    const timeMin = new Date().toISOString();
                    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
                    
                    const eventPromises = calendarsToSync.map(cal =>
                        googleCalendarService.listEventsForTimeRange(token, timeMin, timeMax, cal.id)
                            .then(events => events.map(event => ({
                                ...event,
                                calendarId: cal.id,
                                backgroundColor: cal.backgroundColor,
                            })))
                    );

                    const allEventsNested = await Promise.all(eventPromises);
                    const allEvents = allEventsNested.flat();
                    allEvents.sort((a, b) => new Date(a.start.dateTime || a.start.date!).getTime() - new Date(b.start.dateTime || b.start.date!).getTime());

                    setCalendarEvents(allEvents);
                    saveToCache('calendar_events', allEvents);
                } else {
                    setCalendarEvents([]);
                    saveToCache('calendar_events', []);
                }
            } catch (e) {
                console.error("Multi-calendar sync failed:", e);
                // The error might be a 401, so we let the auth hook handle potential re-auth/sign-out
            } finally {
                setIsCalendarLoading(false);
            }

            // Gmail Sync
            try {
                setGmailError(null);
                const [{ emails, nextPageToken }, unreadEmails] = await Promise.all([
                    googleMailService.listInboxMessages(token, 20),
                    googleMailService.listUnreadInboxMessages(token, 5)
                ]);
                setGmailEmails(emails);
                setGmailNextPageToken(nextPageToken);
                setUnreadGmailEmails(unreadEmails);
                saveToCache('gmail_emails', emails);
                saveToCache('gmail_unread_emails', unreadEmails);
            } catch (err) {
                setGmailError(err instanceof Error ? err.message : 'Failed to load emails.');
            } finally {
                setIsGmailLoading(false);
            }
        };

        syncAllGoogleData(auth.accessToken);

    }, [auth.accessToken, dataSyncKey, visibleCalendarIds]);


    const fetchMoreGmailEmails = async () => {
        if (!auth.accessToken || !gmailNextPageToken || isMoreGmailLoading) return;

        setIsMoreGmailLoading(true);
        setGmailError(null);
        try {
            const { emails: newEmails, nextPageToken } = await googleMailService.listInboxMessages(
                auth.accessToken,
                20, 
                gmailNextPageToken
            );
            setGmailEmails(prevEmails => {
                const updated = [...prevEmails, ...newEmails];
                saveToCache('gmail_emails', updated); // Update cache on load more
                return updated;
            });
            setGmailNextPageToken(nextPageToken);
        } catch (err) {
            setGmailError(err instanceof Error ? err.message : 'Failed to load more emails.');
        } finally {
            setIsMoreGmailLoading(false);
        }
    };

    const fetchContacts = useCallback(async () => {
        if (!auth.accessToken) {
            setContacts([]);
            return;
        }
        try {
            const fetchedContacts = await googlePeopleService.listContacts(auth.accessToken);
            setContacts(fetchedContacts);
        } catch (err) {
            console.error("Failed to load contacts:", err);
        }
    }, [auth.accessToken]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);


    const { chatStatus, handleChatToggle, audioContext, mediaStream, isAiSpeaking, lastActionItem, itemToOpenDetailsFor, clearItemToOpen, projectToNavigateTo, clearProjectToNavigateTo } = useConversationalChat(organizerState, view === 'projectDetail' ? selectedProjectId : null, voiceSettings, auth, () => setDataSyncKey(k => k + 1), defaultCalendarId, calendarEvents, contacts, setEmailSearchResults, setIsEmailSearchModalOpen, setSelectedEmail, setEmailToCompose, setIsEmailComposerOpen);
    const { isVideoChatActive, startVideoSession, stopVideoSession, videoRef, switchCamera, canSwitchCamera } = useVideoChat(organizerState, voiceSettings, contacts, setEmailToCompose, setIsEmailComposerOpen);

    useEffect(() => {
        if (lastActionItem) {
            const elementId = `item-${lastActionItem.id}`;
            setTimeout(() => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('highlight-ai-action');
                    
                    const animationDuration = 1500;
                    setTimeout(() => {
                        const elStillExists = document.getElementById(elementId);
                        if (elStillExists) {
                            elStillExists.classList.remove('highlight-ai-action');
                        }
                    }, animationDuration);
                }
            }, 100);
        }
    }, [lastActionItem]);

    useEffect(() => {
        if (itemToOpenDetailsFor) {
            if (itemToOpenDetailsFor.type === 'todos') setSelectedTodoId(itemToOpenDetailsFor.id);
            else if (itemToOpenDetailsFor.type === 'notes') setSelectedNoteId(itemToOpenDetailsFor.id);
            else if (itemToOpenDetailsFor.type === 'shopping') setSelectedShoppingItemId(itemToOpenDetailsFor.id);
            else if (itemToOpenDetailsFor.type === 'custom' && itemToOpenDetailsFor.listId) setSelectedCustomItem({ listId: itemToOpenDetailsFor.listId, itemId: itemToOpenDetailsFor.id });
            clearItemToOpen();
        }
    }, [itemToOpenDetailsFor, clearItemToOpen]);

    useEffect(() => {
        if (projectToNavigateTo) {
            setSelectedProjectId(projectToNavigateTo);
            setView('projectDetail');
            clearProjectToNavigateTo();
        }
    }, [projectToNavigateTo, clearProjectToNavigateTo]);

    const createCalendarEvent = async (event: { summary: string, start: { dateTime: string }, end: { dateTime: string } }) => {
        if (!auth.accessToken) return;
        const calendarId = defaultCalendarId || primaryCalendarId || 'primary';
        try {
            await googleCalendarService.createEvent(auth.accessToken, calendarId, event);
            setDataSyncKey(k => k + 1); // Refresh calendar
        } catch (err) {
            console.error("Failed to create calendar event:", err);
            setError("Could not create calendar event.");
        }
    };

    const handleSaveEvent = async (eventData: Partial<CalendarEvent>, calendarId: string) => {
        if (!auth.accessToken) return;
        try {
            if (selectedEvent && selectedEvent.id && selectedEvent.calendarId) {
                await googleCalendarService.updateEvent(auth.accessToken, selectedEvent.calendarId, selectedEvent.id, eventData);
            } else {
                await googleCalendarService.createEvent(auth.accessToken, calendarId, eventData);
            }
            setSelectedEvent(null);
            setDataSyncKey(k => k + 1);
        } catch (err) {
            console.error("Failed to save event:", err);
        }
    };
    
    const handleDeleteEvent = async (eventId: string, calendarId: string) => {
        if (!auth.accessToken) return;
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
            try {
                await googleCalendarService.deleteEvent(auth.accessToken, calendarId, eventId);
                setSelectedEvent(null);
                setDataSyncKey(k => k + 1);
            } catch (err) {
                console.error("Failed to delete event:", err);
            }
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const organizedData = await organizeInput(inputValue, customLists);
            
            if (organizedData.events && organizedData.events.length > 0) {
                 if (!auth.isLoggedIn) {
                    auth.signIn();
                    setError("Please sign in to add calendar events.");
                    setIsLoading(false);
                    return;
                }
                for (const event of organizedData.events) {
                    const existingEvents = calendarEvents.filter(e => {
                        const eventStart = new Date(event.start.dateTime).getTime();
                        const eventEnd = new Date(event.end.dateTime).getTime();
                        const existingStart = new Date(e.start.dateTime!).getTime();
                        const existingEnd = new Date(e.end.dateTime!).getTime();
                        return Math.max(eventStart, existingStart) < Math.min(eventEnd, existingEnd);
                    });
                    
                    if (existingEvents.length > 0) {
                        setEventConflict({ event, conflictingEvents: existingEvents });
                        setIsLoading(false);
                        return; 
                    } else {
                        await createCalendarEvent(event);
                    }
                }
            }
            
            const queue: QueuedItem[] = [];
            organizedData.todos.forEach(item => queue.push({ type: 'todos', content: item }));
            organizedData.shopping.forEach(item => queue.push({ type: 'shopping', content: item }));
            organizedData.notes.forEach(item => queue.push({ type: 'notes', content: item }));
            
            customLists.forEach(list => {
                const key = sanitizeTitleForKey(list.title);
                if (organizedData[key]) {
                    organizedData[key].forEach((item: { item: string, customFields: Record<string, string> }) => {
                        queue.push({ type: 'custom', listId: list.id, content: { item: item.item, customFields: item.customFields } });
                    });
                }
            });

            if (queue.length > 0) {
                const messages = processAdditionQueue(queue);
                if (messages.length > 0) {
                    showUndoToast(messages.join(' '));
                }
            }

            setInputValue('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlanGeneratedForProject = (generatedProject: { title: string; description: string; plan: OrganizedData }) => {
        const { title, description, plan } = generatedProject;

        const { message: projectMessage } = addProject(title, description || "Ce projet a été planifié avec l'assistant IA.");
        
        const newTodoIds: string[] = [];
        plan.todos.forEach(todo => {
            const newId = addTodo(todo.task, todo.priority, null)?.newId;
            if (newId) {
                if (todo.dueDate) editTodoDueDate(newId, todo.dueDate);
                newTodoIds.push(newId);
            }
        });

        const newShoppingItemIds: string[] = [];
        plan.shopping.forEach(item => {
            const newId = addShoppingItem(item.item, null)?.newId;
            if (newId) newShoppingItemIds.push(newId);
        });

        const newNoteIds: string[] = [];
        plan.notes.forEach(note => {
            const newId = addNote(note.content, null)?.newId;
            if (newId) newNoteIds.push(newId);
        });
        
        const newProject = projects.find(p => p.title === title);
        const newProjectId = newProject?.id;

        if (newProjectId) {
            const newLinkedItemIds: Project['linkedItemIds'] = {
                todoIds: newTodoIds,
                shoppingItemIds: newShoppingItemIds,
                noteIds: newNoteIds,
                customListItemIds: {},
            };
            updateProjectLinks(newProjectId, newLinkedItemIds);

            setIsPlannerOpen(false);
            setSelectedProjectId(newProjectId);
            setView('projectDetail');
        } else {
             console.error("Could not find newly created project to link items.");
        }
    };

    const handleDragStart = (itemInfo: DragItemInfo) => setDraggingItem(itemInfo);
    const handleDragEnter = (type: ListType, listId?: string) => { if (draggingItem) { setIsTrashActive(false); setDropTarget({ type, listId }); } };
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    
    const convertEmailToListItems = async (email: FullEmail, destType: ListType, destListId?: string) => {
        setIsLoading(true);
        setError(null);
    
        try {
            const emailContentForDescription = `<p><em>From email:</em></p><p><strong>From:</strong> ${email.from}<br><strong>Subject:</strong> ${email.subject}</p><hr>${email.body}`;
    
            if (destType === 'notes') {
                showUndoToast(addNote(emailContentForDescription, null)?.message);
                return;
            }
    
            const customListContext = destType === 'custom' && destListId ? customLists.find(l => l.id === destListId) : undefined;
            const itemsFromAI = await extractItemsFromEmailForList(email, destType, customListContext);
    
            if (itemsFromAI.length === 0) {
                showUndoToast("L'IA n'a trouvé aucun élément à ajouter à partir de cet e-mail.", false);
                return;
            }
    
            const queue: QueuedItem[] = [];
            if (destType === 'todos') {
                itemsFromAI.forEach(item => {
                    queue.push({ type: 'todos', content: { ...item, description: emailContentForDescription } });
                });
            } else if (destType === 'shopping') {
                itemsFromAI.forEach(item => {
                    queue.push({ type: 'shopping', content: { ...item, description: emailContentForDescription } });
                });
            } else if (destType === 'custom' && destListId) {
                itemsFromAI.forEach(item => {
                    queue.push({ type: 'custom', listId: destListId, content: { ...item, description: emailContentForDescription } });
                });
            }
    
            if (queue.length > 0) {
                const messages = processAdditionQueue(queue);
                if (messages && messages.length > 0) {
                    showUndoToast(messages.join(' '));
                }
            }
    
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during AI processing.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (destType: ListType, destListId?: string, destIndex?: number) => {
        if (!draggingItem) return;

        if (draggingItem.type === 'email') {
            convertEmailToListItems(draggingItem.content as FullEmail, destType, destListId);
            handleDragEnd();
            return;
        }

        if (draggingItem.type === 'group') {
            showUndoToast(moveSelectedItems(destType, destListId)?.message);
            handleDragEnd();
            return;
        }

        const { type: sourceType, listId: sourceListId, id: sourceId } = draggingItem;
        if (sourceType === destType && sourceListId === destListId) {
            if (typeof destIndex === 'number') {
                const getListAndReorderFunc = () => {
                    switch(sourceType) {
                        case 'todos': return { list: todos, reorder: reorderTodos };
                        case 'shopping': return { list: shoppingList, reorder: reorderShoppingList };
                        case 'notes': return { list: notes, reorder: reorderNotes };
                        case 'custom':
                            if(sourceListId) {
                                const list = customLists.find(l => l.id === sourceListId);
                                return { list: list?.items || [], reorder: (start: number, end: number) => reorderCustomListItems(sourceListId, start, end) };
                            }
                    }
                    return { list: [], reorder: () => {} };
                };
                const { list, reorder } = getListAndReorderFunc();
                const sourceIndex = list.findIndex(item => item.id === sourceId);
                if (sourceIndex > -1) reorder(sourceIndex, destIndex);
            }
        } else {
             showUndoToast(moveItem(draggingItem, destType, destListId)?.message);
        }
        handleDragEnd();
    };

    const handleDropOnTrash = () => {
        if (!draggingItem) return;

        if (draggingItem.type === 'group') {
            showUndoToast(deleteSelectedItems()?.message);
            handleDragEnd();
            return;
        }

        let result;
        switch (draggingItem.type) {
            case 'todos': result = handleDeleteTodo(draggingItem.id); break;
            case 'shopping': result = handleDeleteShoppingItem(draggingItem.id); break;
            case 'notes': result = handleDeleteNote(draggingItem.id); break;
            case 'custom': if (draggingItem.listId) result = deleteCustomListItem(draggingItem.listId, draggingItem.id); break;
        }
        showUndoToast(result?.message);
        handleDragEnd();
    };

    const handleDragEnd = () => { setDraggingItem(null); setDropTarget(null); setIsTrashActive(false); };
    const handleNavigateToProject = (projectId: string) => { setSelectedTodoId(null); setSelectedNoteId(null); setSelectedShoppingItemId(null); setSelectedCustomItem(null); setSelectedProjectId(projectId); setView('projectDetail'); };
    const handleOpenExistingDuplicate = () => {
        if (!duplicateConfirmation) return;
        const { existingItem } = duplicateConfirmation;
        if (existingItem.type === 'todos') setSelectedTodoId(existingItem.id);
        else if (existingItem.type === 'shopping') setSelectedShoppingItemId(existingItem.id);
        else if (existingItem.type === 'custom' && existingItem.listId) setSelectedCustomItem({ listId: existingItem.listId, itemId: existingItem.id });
        clearDuplicateConfirmation();
    };

    const handleAddAnalyzedItems = (queue: QueuedItem[]) => {
        if (queue.length > 0) {
            const messages = processAdditionQueue(queue);
            if (messages.length > 0) showUndoToast(messages.join(' '));
        }
    };
    
    const handleAnalyzeStyle = async () => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter à Google pour utiliser cette fonctionnalité.", false);
            return;
        }
        try {
            const style = await analyzeWritingStyle(auth.accessToken);
            updateVoiceSettings({ writingStyle: style });
            showUndoToast("Votre style d'écriture a été analysé et sauvegardé !");
        } catch (error) {
            console.error("Style analysis failed:", error);
            showUndoToast(error instanceof Error ? error.message : "Une erreur est survenue.", false);
        }
    };

    const handleOpenEmail = async (emailId: string) => {
        if (!auth.accessToken) {
            const mockEmail = gmailEmails.find(e => e.id === emailId);
            if (mockEmail) {
                setSelectedEmail(mockEmail);
                setGmailEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: true } : e));
                setUnreadGmailEmails(prev => prev.filter(e => e.id !== emailId));
            }
            return;
        }
    
        // 1. Optimistic UI Update for both lists and cache
        setGmailEmails(prev => {
            const updated = prev.map(e => e.id === emailId ? { ...e, isRead: true } : e);
            saveToCache('gmail_emails', updated);
            return updated;
        });
        setUnreadGmailEmails(prev => {
            const updated = prev.filter(e => e.id !== emailId);
            saveToCache('gmail_unread_emails', updated);
            return updated;
        });
    
        try {
            // 2. Fetch full content for detail view
            const fullEmail = await googleMailService.getEmail(auth.accessToken, emailId);
            setSelectedEmail(fullEmail);
            
            // 3. Inform the server without triggering a UI refresh
            googleMailService.markAsRead(auth.accessToken, emailId)
            .catch(e => {
                console.error("Failed to mark email as read on server:", e);
                // On failure, trigger a full sync to get back to a consistent state.
                setDataSyncKey(k => k + 1); 
                showUndoToast("Échec de la mise à jour du statut de l'e-mail.", false);
            });
        } catch (e) {
            console.error("Failed to fetch email content:", e);
            showUndoToast("Impossible d'ouvrir l'e-mail.", false);
            // Revert if fetching content fails by triggering a full sync
            setDataSyncKey(k => k + 1);
        }
    };

    const handleComposeNewEmail = () => {
        setEmailToCompose({ to: '', cc: '', bcc: '', subject: '', body: '' });
        setIsEmailComposerOpen(true);
    };

    const handleReplyToEmail = (email: FullEmail) => {
        const fromAddress = email.from.match(/<(.+)>/)?.[1] || email.from;
        setSelectedEmail(null);
        setEmailToCompose({
            to: fromAddress,
            cc: '',
            bcc: '',
            subject: `Re: ${email.subject}`,
            body: `<p><br></p><p><br></p><hr><p>Le ${new Date().toLocaleString()}, ${email.from} a écrit :</p><blockquote>${email.body}</blockquote>`
        });
        setIsEmailComposerOpen(true);
    };

    const handleComposerSend = async (emailData: EmailData) => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour envoyer des e-mails.", false);
            return;
        }
        try {
            await googleMailService.sendEmail(auth.accessToken, emailData.to, emailData.subject, emailData.body, emailData.cc, emailData.bcc);
            showUndoToast("E-mail envoyé avec succès !");
            setDataSyncKey(k => k + 1);
        } catch (error) {
            showUndoToast("Échec de l'envoi de l'e-mail.", false);
        }
        setIsEmailComposerOpen(false);
    };

    const handleComposerCloseAndDraft = async (emailData: EmailData) => {
        setIsEmailComposerOpen(false);
        if (!auth.accessToken) return;
        if (emailData.to || emailData.subject || emailData.body || emailData.cc || emailData.bcc) {
            try {
                await googleMailService.createDraft(auth.accessToken, emailData.to, emailData.subject, emailData.body, emailData.cc, emailData.bcc);
                showUndoToast("E-mail enregistré comme brouillon.");
            } catch (error) {
                showUndoToast("Échec de l'enregistrement du brouillon.", false);
            }
        }
    };
    
    const handleLinkItem = (projectId: string, itemType: AllItemTypes, itemId: string) => {
        showUndoToast(linkItemToProject(projectId, itemType, itemId)?.message);
    };
    const handleUnlinkItem = (itemType: AllItemTypes, itemId: string) => {
        showUndoToast(unlinkItemFromProject(itemType, itemId)?.message);
    };

    const selectedTodo = todos.find(t => t.id === selectedTodoId) || null;
    const selectedNote = notes.find(n => n.id === selectedNoteId) || null;
    const selectedShoppingItem = shoppingList.find(s => s.id === selectedShoppingItemId) || null;
    const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
    const selectedCustomListData = selectedCustomItem ? customLists.find(l => l.id === selectedCustomItem.listId) : null;
    const selectedCustomListItemData = selectedCustomListData?.items.find(i => i.id === selectedCustomItem?.itemId);
    const chatButtonProps = { status: chatStatus, onClick: handleChatToggle, audioContext: audioContext, mediaStream: mediaStream, isAiSpeaking: isAiSpeaking };

    const renderListsView = () => {
        const hiddenProjectIds = new Set(projects.filter(p => p.isHiddenInMainView).map(p => p.id));
        const hiddenTypesByProject: Record<string, Project['hiddenItemTypes']> = {};
        projects.forEach(p => {
            if (p.hiddenItemTypes) {
                hiddenTypesByProject[p.id] = p.hiddenItemTypes;
            }
        });

        const isItemVisible = (item: { projectId?: string | null }, itemType: keyof Project['hiddenItemTypes']) => {
            if (!item.projectId) return true;
            if (hiddenProjectIds.has(item.projectId)) return false;
            if (hiddenTypesByProject[item.projectId]?.[itemType]) return false;
            return true;
        };
        
        const visibleTodos = todos.filter(item => isItemVisible(item, 'todos'));
        const visibleShoppingList = shoppingList.filter(item => isItemVisible(item, 'shopping'));
        const visibleNotes = notes.filter(item => isItemVisible(item, 'notes'));
        const visibleCustomLists = customLists.map(list => ({
            ...list,
            items: list.items.filter(item => isItemVisible(item, 'customLists'))
        })).filter(list => list.items.length > 0);

        const selectionProps = {
            selection,
            selectedIds,
            onStartSelection: startSelectionMode,
            onEndSelection: endSelectionMode,
            onToggleSelection: toggleItemSelected,
            onSelectAll: selectAllInList,
            onClearSelection: clearSelection,
        };

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <GmailView
                    auth={auth}
                    emails={gmailEmails}
                    unreadEmails={unreadGmailEmails}
                    isLoading={isGmailLoading}
                    error={gmailError}
                    onOpenEmail={handleOpenEmail}
                    onCompose={handleComposeNewEmail}
                    onRefresh={() => setDataSyncKey(k => k + 1)}
                    isCollapsed={!!collapsedWidgets['gmail']}
                    onToggleCollapse={() => handleToggleWidget('gmail')}
                    onDragStart={handleDragStart}
                    onLoadMore={fetchMoreGmailEmails}
                    hasNextPage={!!gmailNextPageToken}
                    isMoreLoading={isMoreGmailLoading}
                />
                <CalendarWidget
                    auth={auth}
                    events={calendarEvents}
                    isLoading={isCalendarLoading}
                    onRefresh={() => setDataSyncKey(k => k + 1)}
                    calendars={calendars}
                    defaultCalendarId={defaultCalendarId}
                    isCollapsed={!!collapsedWidgets['schedule']}
                    onToggleCollapse={() => handleToggleWidget('schedule')}
                    onOpenEvent={handleOpenEvent}
                />
                <TodoList items={visibleTodos} projects={projects} onToggle={(id) => showUndoToast(handleToggleTodo(id)?.message)} onEditPriority={(id, priority) => showUndoToast(editTodoPriority(id, priority)?.message)} onOpenDetails={setSelectedTodoId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'todos'} sortOrder={todoSortOrder} onSetSortOrder={(order) => showUndoToast(setTodoSortOrder(order)?.message)} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets['todos']} onToggleCollapse={() => handleToggleWidget('todos')} {...selectionProps} />
                <ShoppingList items={visibleShoppingList} projects={projects} onToggle={(id) => showUndoToast(handleToggleShoppingItem(id)?.message)} onOpenDetails={setSelectedShoppingItemId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'shopping'} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets['shopping']} onToggleCollapse={() => handleToggleWidget('shopping')} {...selectionProps} />
                <NotesList items={visibleNotes} projects={projects} onOpenDetails={setSelectedNoteId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'notes'} isCollapsed={!!collapsedWidgets['notes']} onToggleCollapse={() => handleToggleWidget('notes')} {...selectionProps} />
                {visibleCustomLists.map(list => (
                    <CustomListComponent key={list.id} list={list} projects={projects} onAddItem={(listId, text) => showUndoToast(addCustomListItem(listId, text)?.message)} onDeleteList={(listId) => showUndoToast(deleteCustomList(listId)?.message)} onToggleItem={(listId, itemId) => showUndoToast(toggleCustomListItem(listId, itemId)?.message)} onOpenDetails={(listId, itemId) => setSelectedCustomItem({ listId, itemId })} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'custom' && dropTarget.listId === list.id} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets[`custom_${list.id}`]} onToggleCollapse={() => handleToggleWidget(`custom_${list.id}`)} {...selectionProps} />
                ))}
                <AddListComponent onAddList={(title, fields) => showUndoToast(addCustomList(title, fields)?.message)} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-slate-100 text-slate-800 font-sans px-4 sm:px-6 lg:px-8 pt-2 sm:pt-3 lg:pt-4 pb-8 transition-all duration-300 ${selection.isActive ? 'pb-28' : ''}`}>
            <div className="max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <img src="https://i.imgur.com/DIJnPFq.png" alt="AI Organizer Logo" className="hidden md:block h-20 w-auto" />
                        <img src="https://i.imgur.com/5TulWNM.png" alt="AI Organizer Logo" className="block md:hidden h-16 w-auto" />
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden md:flex items-center gap-3">
                            <button onClick={handleUndo} disabled={history.length === 0} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Annuler la dernière action">
                                <ArrowUturnLeftIcon className="w-6 h-6" />
                            </button>
                            <button onClick={() => setIsSearchOpen(true)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Recherche globale">
                                <MagnifyingGlassIcon className="w-6 h-6" />
                            </button>
                            <button onClick={() => setView(isProjectView ? 'lists' : 'projectsDashboard')} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label={isProjectView ? "Voir les listes" : "Voir les projets"}>
                                {isProjectView ? <Bars3Icon className="w-6 h-6" /> : <RectangleGroupIcon className="w-6 h-6" />}
                            </button>
                        </div>

                        <button onClick={() => setIsCameraChoiceModalOpen(true)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Capturer une note via la vidéo" disabled={isLoading || chatStatus !== 'idle'}>
                            <CameraIcon className="w-6 h-6" />
                        </button>
                         {(view === 'lists' || view === 'projectsDashboard' || view === 'projectDetail') && (
                            <ConversationalChatButton {...chatButtonProps} />
                         )}
                         <Auth auth={auth} onOpenSettings={() => setIsSettingsModalOpen(true)} onRefresh={forceSyncAll} />

                        <div ref={moreMenuRef} className="relative md:hidden">
                            <button onClick={() => setIsMoreMenuOpen(prev => !prev)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Plus d'options">
                                <EllipsisVerticalIcon className="w-6 h-6" />
                            </button>
                            {isMoreMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 animate-fade-in-up">
                                    <button 
                                        onClick={() => { handleUndo(); setIsMoreMenuOpen(false); }} 
                                        disabled={history.length === 0}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUturnLeftIcon className="w-5 h-5" />
                                        <span>Annuler</span>
                                    </button>
                                    <button 
                                        onClick={() => { setIsSearchOpen(true); setIsMoreMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    >
                                        <MagnifyingGlassIcon className="w-5 h-5" />
                                        <span>Recherche</span>
                                    </button>
                                    <button 
                                        onClick={() => { setView(isProjectView ? 'lists' : 'projectsDashboard'); setIsMoreMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    >
                                        {isProjectView ? <Bars3Icon className="w-5 h-5" /> : <RectangleGroupIcon className="w-5 h-5" />}
                                        <span>{isProjectView ? "Voir les listes" : "Voir les projets"}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                
                <main className="flex-grow">
                    {view === 'lists' && (
                        <div className="mb-12">
                            <InputBar value={inputValue} onChange={(e) => setInputValue(e.target.value)} onSubmit={handleSubmit} isLoading={isLoading} error={error} isChatting={chatStatus !== 'idle'} />
                        </div>
                    )}
                    {view === 'lists' && renderListsView()}
                    {view === 'projectsDashboard' && (
                        <ProjectsDashboard projects={projects} todos={todos} shoppingList={shoppingList} customLists={customLists} onSelectProject={(id) => { setSelectedProjectId(id); setView('projectDetail'); }} onCreateProject={() => setIsCreateProjectModalOpen(true)} onPlanProjectWithAI={() => setIsPlannerOpen(true)} onDeleteProject={(id) => showUndoToast(deleteProject(id)?.message)} onLinkItems={(project) => setLinkingProject(project)} chatButtonProps={chatButtonProps} />
                    )}
                    {view === 'projectDetail' && selectedProject && (
                        <ProjectDetailView
                            project={selectedProject}
                            organizerState={organizerState}
                            onOpenTodoDetails={setSelectedTodoId}
                            onOpenShoppingDetails={setSelectedShoppingItemId}
                            onOpenNoteDetails={setSelectedNoteId}
                            onOpenCustomItemDetails={(listId, itemId) => setSelectedCustomItem({ listId, itemId })}
                            dragAndDropProps={{ onDragStart: handleDragStart, onDragEnd: handleDragEnd, onDragEnter: handleDragEnter, onDragOver: handleDragOver, onDrop: handleDrop, draggingItem: draggingItem }}
                            onBack={() => { setView('projectsDashboard'); setSelectedProjectId(null); }}
                            chatButtonProps={chatButtonProps}
                            gmailEmails={gmailEmails}
                            calendarEvents={calendarEvents}
                            onOpenEmail={handleOpenEmail}
                            onOpenEvent={handleOpenEvent}
                        />
                    )}
                </main>
                <footer className="mt-16 text-center text-sm text-slate-500">
                    <button onClick={handleImportClick} className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Importer les données</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={handleExportData} className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Exporter les données</button>
                </footer>
            </div>
             <TrashDropZone isVisible={!!draggingItem} isActive={isTrashActive} onDrop={handleDropOnTrash} onDragEnter={() => setIsTrashActive(true)} onDragLeave={() => setIsTrashActive(false)} />
             {selection.isActive && (
                <SelectionActionBar
                    selection={selection}
                    selectedIds={selectedIds}
                    projects={projects}
                    todos={todos}
                    shoppingList={shoppingList}
                    notes={notes}
                    customLists={customLists}
                    onDelete={() => showUndoToast(deleteSelectedItems()?.message)}
                    onToggleCompleted={() => showUndoToast(toggleSelectedItemsCompleted()?.message)}
                    onLinkToProject={(projectId) => showUndoToast(linkSelectedItemsToProject(projectId)?.message)}
                    onSetPriority={(p) => showUndoToast(setSelectedItemsPriority(p)?.message)}
                    onSetDueDate={(d) => showUndoToast(setSelectedItemsDueDate(d)?.message)}
                    onSetStore={(s) => showUndoToast(setSelectedShoppingItemsStore(s)?.message)}
                    onMergeNotes={() => showUndoToast(mergeSelectedNotes()?.message)}
                    onClose={endSelectionMode}
                />
             )}
            {undoToastInfo && ( <UndoToast key={undoToastInfo.key} message={undoToastInfo.message} onUndo={handleUndo} onClose={() => setUndoToastInfo(null)} /> )}
            <ProjectPlannerModal isOpen={isPlannerOpen} onClose={() => setIsPlannerOpen(false)} onPlanGenerated={handlePlanGeneratedForProject} voiceSettings={voiceSettings} />
            <CameraChoiceModal isOpen={isCameraChoiceModalOpen} onClose={() => setIsCameraChoiceModalOpen(false)} onAnalyzePhoto={() => { setIsCameraChoiceModalOpen(false); setIsPhotoAnalyzerModalOpen(true); }} onVideoChat={() => { setIsCameraChoiceModalOpen(false); startVideoSession(); }} />
            <PhotoAnalyzerModal isOpen={isPhotoAnalyzerModalOpen} onClose={() => setIsPhotoAnalyzerModalOpen(false)} onAddAnalyzedItems={handleAddAnalyzedItems} customLists={customLists} />
            <CameraModal isOpen={isVideoChatActive} onClose={stopVideoSession} videoRef={videoRef} onSwitchCamera={switchCamera} canSwitchCamera={canSwitchCamera} />
            <EmailSearchResultsModal isOpen={isEmailSearchModalOpen} emails={emailSearchResults} onClose={() => setIsEmailSearchModalOpen(false)} onSelectEmail={async (emailId) => { if (!auth.accessToken) return; try { const fullEmail = await googleMailService.getEmail(auth.accessToken, emailId); setSelectedEmail(fullEmail); } catch (e) { console.error("Failed to fetch selected email", e); } }} />
            <EmailDetailModal
                isOpen={!!selectedEmail}
                email={selectedEmail}
                onClose={() => setSelectedEmail(null)}
                onReply={handleReplyToEmail}
                projects={projects} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem}
            />
             <EmailComposerModal isOpen={isEmailComposerOpen} initialEmail={emailToCompose} onSend={handleComposerSend} onClose={handleComposerCloseAndDraft} contacts={contacts} />
             <EventModal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                event={selectedEvent}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                calendars={calendars}
                primaryCalendarId={primaryCalendarId}
                defaultCalendarId={defaultCalendarId}
                isLoggedIn={auth.isLoggedIn}
                projects={projects}
                onLinkItem={handleLinkItem}
                onUnlinkItem={handleUnlinkItem}
            />
             <GlobalSearchModal 
                isOpen={isSearchOpen}
                onClose={() => { setIsSearchOpen(false); search.resetSearch(); }}
                query={search.query}
                onQueryChange={search.setQuery}
                results={search.results}
                isLoading={search.isLoading}
                isAiLoading={search.isAiLoading}
                onSelectTodo={setSelectedTodoId}
                onSelectShoppingItem={setSelectedShoppingItemId}
                onSelectNote={setSelectedNoteId}
                onSelectCustomItem={(listId, itemId) => setSelectedCustomItem({ listId, itemId })}
                onSelectProject={handleNavigateToProject}
                onSelectEmail={setSelectedEmail}
             />
            <ConfirmationModal isOpen={!!importConfirmationFile} title="Confirmer l'importation" message="Êtes-vous sûr de vouloir importer ces données ? Cela écrasera toutes vos listes actuelles." onConfirm={confirmImport} onCancel={cancelImport} />
            {eventConflict && ( <ConfirmationModal isOpen={!!eventConflict} title="Conflit d'agenda" message={`Vous avez déjà un événement prévu à ce moment-là : "${eventConflict.conflictingEvents[0].summary}". Voulez-vous ajouter cet événement quand même ?`} onConfirm={() => { createCalendarEvent(eventConflict.event); setEventConflict(null); }} onCancel={() => setEventConflict(null)} /> )}
            <DuplicateConfirmationModal isOpen={!!duplicateConfirmation} newItemText={duplicateConfirmation?.newItem.content.task || duplicateConfirmation?.newItem.content.item || duplicateConfirmation?.newItem.content.text || ''} existingItemText={duplicateConfirmation?.existingItem.text || ''} onConfirmAdd={() => showUndoToast(confirmDuplicateAdd()?.join(' '))} onOpenExisting={handleOpenExistingDuplicate} onCancel={clearDuplicateConfirmation} />
            <CreateProjectModal isOpen={isCreateProjectModalOpen} onClose={() => setIsCreateProjectModalOpen(false)} onAddProject={(title, desc) => showUndoToast(addProject(title, desc)?.message)} />
             <LinkItemsModal isOpen={!!linkingProject} onClose={() => setLinkingProject(null)} project={linkingProject} onUpdateLinks={(projectId, links) => showUndoToast(updateProjectLinks(projectId, links)?.message)} todos={todos} shoppingList={shoppingList} notes={notes} customLists={customLists} />
             <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={voiceSettings} onUpdateSettings={updateVoiceSettings} calendars={calendars} defaultCalendarId={defaultCalendarId} onSetDefaultCalendarId={setDefaultCalendarId} onAnalyzeStyle={handleAnalyzeStyle} visibleCalendarIds={visibleCalendarIds} onUpdateVisibleCalendars={updateVisibleCalendars} />
            {selectedTodo && ( <TodoDetailModal isOpen={!!selectedTodoId} onClose={() => setSelectedTodoId(null)} todo={selectedTodo} projects={projects} onNavigateToProject={handleNavigateToProject} onEditTitle={(id, title) => showUndoToast(editTodo(id, title)?.message)} onEditPriority={(id, priority) => showUndoToast(editTodoPriority(id, priority)?.message)} onEditDescription={(id, desc) => showUndoToast(editTodoDescription(id, desc)?.message)} onAddSubtask={(id, text) => showUndoToast(addTodoSubtask(id, text)?.message)} onToggleSubtask={(todoId, subtaskId) => showUndoToast(toggleTodoSubtask(todoId, subtaskId)?.message)} onDeleteSubtask={(todoId, subtaskId) => showUndoToast(deleteTodoSubtask(todoId, subtaskId)?.message)} onEditSubtask={(todoId, subtaskId, text) => showUndoToast(editTodoSubtask(todoId, subtaskId, text)?.message)} onEditDueDate={(id, date) => showUndoToast(editTodoDueDate(id, date)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} voiceSettings={voiceSettings} /> )}
            {selectedNote && ( <NoteDetailModal isOpen={!!selectedNoteId} onClose={() => setSelectedNoteId(null)} note={selectedNote} projects={projects} onNavigateToProject={handleNavigateToProject} onEdit={(id, content) => showUndoToast(editNote(id, content)?.message)} onRevert={(noteId, entry) => showUndoToast(revertNoteToVersion(noteId, entry)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} voiceSettings={voiceSettings} /> )}
             {selectedShoppingItem && ( <ShoppingDetailModal isOpen={!!selectedShoppingItemId} onClose={() => setSelectedShoppingItemId(null)} item={selectedShoppingItem} projects={projects} onNavigateToProject={handleNavigateToProject} onEditItem={(id, name) => showUndoToast(editShoppingItem(id, name)?.message)} onEditDetails={(id, details) => showUndoToast(editShoppingItemDetails(id, details)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} /> )}
             {selectedCustomItem && selectedCustomListItemData && selectedCustomListData && ( <CustomListItemDetailModal isOpen={!!selectedCustomItem} onClose={() => setSelectedCustomItem(null)} item={selectedCustomListItemData} list={selectedCustomListData} listId={selectedCustomItem.listId} projects={projects} onNavigateToProject={handleNavigateToProject} onEditDetails={(listId, itemId, details) => showUndoToast(editCustomListItemDetails(listId, itemId, details)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} /> )}
        </div>
    );
};

export default App;