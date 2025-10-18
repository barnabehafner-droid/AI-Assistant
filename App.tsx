import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import InputBar from './components/InputBar';
import TodoList from './components/TodoList';
import ShoppingList from './components/ShoppingList';
import NotesList from './components/NotesList';
import CustomListComponent from './components/CustomListComponent';
import AddListComponent from './components/AddListComponent';
import ProjectPlannerModal from './components/ProjectPlannerModal';
import { organizeInput, sanitizeTitleForKey, analyzeWritingStyle, extractItemsFromEmailForList, getShareSuggestion, categorizeShoppingItems, enrichTask, getCityFromCoordinates, analyzeImageAndSuggestAction } from './services/geminiService';
import { RectangleGroupIcon, Bars3Icon, MagnifyingGlassIcon, EllipsisVerticalIcon, PlusIcon, SparklesIcon } from './components/icons';
import { useOrganizerState, DragItemInfo, ListType, QueuedItem, HistoryEntry } from './hooks/useOrganizerState';
import { useConversationalChat, SummaryData } from './hooks/useConversationalChat';
import { useVideoChat } from './hooks/useVideoChat';
import ConfirmationModal from './components/ConfirmationModal';
import CameraModal from './components/CameraModal';
import { OrganizedData, Project, VoiceSettings, CalendarEvent, GoogleCalendar, FullEmail, Contact, EmailData, Priority, AllItemTypes, GmailLabel, ShoppingSortOrder, TodoItem, InfoCard, GmailContactConversation, ShoppingItem, TokenExpiredError, DirectionsInfo } from './types';
import TodoDetailModal from './components/TodoDetailModal';
import NoteDetailModal from './components/NoteDetailModal';
import ShoppingDetailModal from './components/ShoppingDetailModal';
import CustomListItemDetailModal from './components/CustomListItemDetailModal';
import TrashDropZone from './components/TrashDropZone';
import ProjectsDashboard from './components/ProjectsDashboard';
import { ProjectDetailView } from './components/ProjectDetailView';
import CreateProjectModal from './components/CreateProjectModal';
import LinkItemsModal from './components/LinkItemsModal';
import SettingsModal from './components/SettingsModal';
import DuplicateConfirmationModal from './components/DuplicateConfirmationModal';
import { useAuth } from './hooks/useAuth';
import { CalendarWidget } from './components/ScheduleView';
import UndoToast from './components/UndoToast';
import * as googleCalendarService from './services/googleCalendarService';
import * as googleMailService from './services/googleMailService';
import * as googlePeopleService from './services/googlePeopleService';
import * as weatherService from './services/weatherService';
import * as googleFitService from './services/googleFitService';
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
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import HelpPage from './components/HelpPage';
import ShareReceiverModal from './components/ShareReceiverModal';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { getCurrentLocation } from './utils/location';
import ConversationModal from './components/ConversationModal';
import AddEmailToListModal from './components/AddEmailToListModal';
import HistoryModal from './components/HistoryModal';
import { getDirections } from './services/googleMapsService';
import AIChatWidget from './components/AIChatWidget';
import ConsolidatedAIChatFAB from './components/ConsolidatedAIChatFAB';
import CameraChoiceModal from './components/CameraChoiceModal';


const ReconnectBanner: React.FC<{ onReconnect: () => void }> = ({ onReconnect }) => (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white p-3 z-50 flex justify-center items-center gap-4 shadow-lg animate-fade-in-down">
        <span className="font-semibold">Votre session Google a expiré.</span>
        <button 
            onClick={onReconnect}
            className="px-4 py-1 bg-white text-yellow-600 font-semibold rounded-md hover:bg-yellow-50 transition-colors"
        >
            Reconnecter
        </button>
    </div>
);


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
    const [dropTarget, setDropTarget] = useState<{ type: ListType, listId?: string, index?: number } | null>(null);
    const [isTrashActive, setIsTrashActive] = useState(false);
    const [dataSyncKey, setDataSyncKey] = useState(0);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [isCalendarLoading, setIsCalendarLoading] = useState(true);
    const [eventConflict, setEventConflict] = useState<EventConflict | null>(null);
    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [primaryCalendarId, setPrimaryCalendarId] = useState<string | null>(null);
    const [undoToastInfo, setUndoToastInfo] = useState<{ message: string; key: number } | null>(null);
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
        schedule: true,
    });
    const [enrichingTodoIds, setEnrichingTodoIds] = useState<Set<string>>(new Set());
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isGoogleSessionExpired, setIsGoogleSessionExpired] = useState(false);
    
    // Gmail state
    const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
    const [selectedContactEmailForModal, setSelectedContactEmailForModal] = useState<string | null>(null);
    const [emailToAddToList, setEmailToAddToList] = useState<FullEmail | null>(null);
    const [unreadGmailEmails, setUnreadGmailEmails] = useState<FullEmail[]>([]);
    const [gmailLabels, setGmailLabels] = useState<GmailLabel[]>([]);
    const [isGmailLoading, setIsGmailLoading] = useState(true);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isCategorizing, setIsCategorizing] = useState(false);
    const [unsubscribeTarget, setUnsubscribeTarget] = useState<GmailContactConversation | null>(null);

    // New state for view management
    const [view, setView] = useState<'lists' | 'projectsDashboard' | 'projectDetail'>('lists');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [linkingProject, setLinkingProject] = useState<Project | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isReordering, setIsReordering] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const [route, setRoute] = useState(window.location.hash);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Share Target State
    const [sharedData, setSharedData] = useState<{ title?: string; text?: string; url?: string; } | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [aiShareSuggestion, setAiShareSuggestion] = useState('');
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);

    // Offline state
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOfflineWarning, setShowOfflineWarning] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [currentUserCoordinates, setCurrentUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

    // AI Chat states
    const [isTextChatOpen, setIsTextChatOpen] = useState(false);
    const [isCameraChoiceOpen, setIsCameraChoiceOpen] = useState(false);

    // Widget reordering state
    const [draggedWidgetKey, setDraggedWidgetKey] = useState<string | null>(null);
    const [dragOverWidgetKey, setDragOverWidgetKey] = useState<string | null>(null);


    // Projects dropdown menu state
    const [isProjectsMenuOpen, setIsProjectsMenuOpen] = useState(false);
    const projectsMenuRef = useRef<HTMLDivElement>(null);

    const { isLoaded: mapsApiLoaded } = useGoogleMaps();

    const [travelInfoCache, setTravelInfoCache] = useState<Record<string, DirectionsInfo | 'loading' | 'error'>>({});

    useEffect(() => {
        const handleHashChange = () => {
            setRoute(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentUserCoordinates({ latitude, longitude });
                    try {
                        const cityName = await getCityFromCoordinates(latitude, longitude);
                        if(cityName) {
                            setCurrentLocation(cityName);
                        }
                    } catch (error) {
                        console.warn("Reverse geocoding failed:", error);
                    }
                },
                (error) => {
                    console.warn(`Geolocation error: ${error.message}. Falling back to settings location.`);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        } else {
            console.log('Geolocation is not available in this browser.');
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    
    const showOfflineError = () => {
        setShowOfflineWarning(true);
        setTimeout(() => setShowOfflineWarning(false), 3000);
    };


    const isProjectView = view === 'projectsDashboard' || view === 'projectDetail';
    
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const auth = useAuth();
    const organizerState = useOrganizerState(auth.accessToken);
    const { todos, shoppingList, notes, customLists, projects, visibleCalendarIds } = organizerState;

    const localDataForSearch = useMemo(() => ({
        todos,
        shoppingList,
        notes,
        customLists,
        projects,
        visibleCalendarIds,
    }), [todos, shoppingList, notes, customLists, projects, visibleCalendarIds]);
    
    const search = useGlobalSearch(localDataForSearch, auth);

    const handleTokenError = useCallback((error: unknown) => {
        if (error instanceof TokenExpiredError) {
            console.warn("Google token expired. Prompting for reconnect.");
            auth.invalidateAccessToken();
            setIsGoogleSessionExpired(true);
            return true; // Indicates the error was handled
        }
        return false;
    }, [auth]);

    const handleReconnect = () => {
        auth.signIn().then(() => {
            setIsGoogleSessionExpired(false);
            setDataSyncKey(k => k + 1); // Force a data refresh
        });
    };

    const {
        defaultCalendarId,
        addTodo, addShoppingItem, addNote, updateNoteAddress, addProject, deleteProject, updateProjectLinks, updateProjectVisibility,
        handleToggleTodo, handleDeleteTodo, editTodo, editTodoPriority, editTodoDescription, addTodoSubtask, toggleTodoSubtask, deleteTodoSubtask, editTodoSubtask, editTodoDueDate, setTodoEnrichment,
        handleToggleShoppingItem, handleDeleteShoppingItem, editShoppingItem, editShoppingItemDetails, updateShoppingItemCategories,
        handleDeleteNote, editNote, revertNoteToVersion,
        addCustomList, deleteCustomList, addCustomListItem,
        deleteCustomListItem, toggleCustomListItem, editCustomListItemDetails,
        reorderTodos, reorderShoppingList, reorderNotes, reorderCustomListItems, moveItem,
        fileInputRef, handleExportData, handleImportClick, handleFileChange,
        importConfirmationFile, confirmImport, cancelImport,
        todoSortOrder, setTodoSortOrder,
        shoppingSortOrder, setShoppingSortOrder,
        activeFilter, clearFilter,
        duplicateConfirmation, processAdditionQueue, confirmDuplicateAdd, clearDuplicateConfirmation,
        skipDuplicateAndContinue,
        voiceSettings, updateVoiceSettings, setDefaultCalendarId, forceSync,
        history, undoLastAction, revertToState,
        updateVisibleCalendars,
        widgetOrders, setWidgetOrders,
        linkItemToProject, unlinkItemFromProject,
        selection, selectedIds, startSelectionMode, endSelectionMode, toggleItemSelected, selectAllInList, clearSelection,
        deleteSelectedItems, toggleSelectedItemsCompleted, linkSelectedItemsToProject, moveSelectedItems,
        setSelectedItemsPriority, setSelectedItemsDueDate, setSelectedShoppingItemsStore, mergeSelectedNotes,
    } = organizerState;

    // FIX: Moved this function after the `organizerState` hook and its destructuring to ensure `voiceSettings` is declared before use.
    const fetchAndCacheTravelInfo = useCallback(async (event: CalendarEvent): Promise<DirectionsInfo | null> => {
        if (!event?.id || !event.location || !currentUserCoordinates) {
            return null;
        }
    
        const travelMode = voiceSettings.transportMode || 'DRIVING';
        const cacheKey = `${event.id}-${travelMode}`;
    
        const cached = travelInfoCache[cacheKey];
        if (cached) {
            if (cached === 'loading' || cached === 'error') return null;
            return cached;
        }
    
        try {
            setTravelInfoCache(prev => ({ ...prev, [cacheKey]: 'loading' }));
            const directions = await getDirections(currentUserCoordinates, event.location, travelMode);
            if (directions) {
                setTravelInfoCache(prev => ({ ...prev, [cacheKey]: directions }));
                return directions;
            } else {
                setTravelInfoCache(prev => ({ ...prev, [cacheKey]: 'error' }));
                return null;
            }
        } catch (error) {
            console.error("Failed to fetch and cache travel info:", error);
            setTravelInfoCache(prev => ({ ...prev, [cacheKey]: 'error' }));
            return null;
        }
    }, [currentUserCoordinates, voiceSettings.transportMode, travelInfoCache]);

    const prevTodosRef = useRef<TodoItem[]>(todos);

    useEffect(() => {
        if (todos.length > prevTodosRef.current.length) {
            const prevIds = new Set(prevTodosRef.current.map(t => t.id));
            const newTodos = todos.filter(t => !prevIds.has(t.id));

            newTodos.forEach(newTodo => {
                if (newTodo.task.trim() && !newTodo.enrichedData && !enrichingTodoIds.has(newTodo.id)) {
                    setEnrichingTodoIds(prev => new Set(prev).add(newTodo.id));
                    const location = currentLocation || voiceSettings.location;
                    const enrichmentQuery = (location && location.trim()) ? `${newTodo.task}, ${location}` : newTodo.task;
                    enrichTask({ id: newTodo.id, taskText: newTodo.task, enrichmentQuery: enrichmentQuery })
                        .then(({ taskId, enrichedData, enrichmentMetadata }) => {
                            if (enrichedData && enrichedData.length > 0) {
                                setTodoEnrichment(taskId, enrichedData, enrichmentMetadata);
                            }
                        })
                        .catch(err => console.error(`Failed to enrich task ${newTodo.id}:`, err))
                        .finally(() => {
                            setEnrichingTodoIds(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(newTodo.id);
                                return newSet;
                            });
                        });
                }
            });
        }
        prevTodosRef.current = todos;
    }, [todos, setTodoEnrichment, enrichingTodoIds, voiceSettings.location, currentLocation]);


    useEffect(() => {
        const CACHE_NAME = 'ai-organizer-cache-v5'; // Must match sw.js

        const processShareData = (data: { title?: string; text?: string; url?: string; }) => {
            if (!data || (!data.title && !data.text && !data.url)) {
                console.log("processShareData called with empty data.");
                return;
            }

            console.log("Processing shared data:", data);
            setSharedData(data);
            setIsShareModalOpen(true);
            setIsSuggestionLoading(true);
            
            getShareSuggestion(data)
                .then(res => {
                    console.log("AI suggestion received:", res);
                    setAiShareSuggestion(res);
                })
                .catch(err => console.error("Error getting AI suggestion:", err))
                .finally(() => {
                    console.log("Finished loading suggestion.");
                    setIsSuggestionLoading(false);
                });
        };

        const checkForShareData = async () => {
            // 1. Check for data cached by the Service Worker
            try {
                if ('caches' in window) {
                    const cache = await caches.open(CACHE_NAME);
                    const shareResponse = await cache.match('pending-share-data');
                    if (shareResponse) {
                        console.log("Found share data in cache.");
                        const data = await shareResponse.json();
                        // Important: delete the data to prevent re-processing
                        await cache.delete('pending-share-data');
                        processShareData(data);
                        return; // Exit after processing cached data
                    }
                }
            } catch (error) {
                console.error("Error checking cache for share data:", error);
            }

            // 2. Fallback to checking URL params (for when app is already open, or SW fails)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('share-target')) {
                console.log("Found share data in URL params as fallback.");
                const data = {
                    title: urlParams.get('title') || undefined,
                    text: urlParams.get('text') || undefined,
                    url: urlParams.get('url') || undefined
                };

                processShareData(data);
                
                // Clean the URL to avoid re-triggering
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        checkForShareData();
    }, []); // Run only once on mount

    const handleConfirmShare = async () => {
        if (!sharedData) return;
        const { title, text, url } = sharedData;
        let content = '';
        if (title) content += `<h1>${title}</h1>`;
        if (url) content += `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
        if (text) content += `<p>${text.replace(/\n/g, '<br>')}</p>`;
        
        const location = await getCurrentLocation();
        const result = addNote(content, null, location);

        if (result?.newId && location) {
            try {
                const address = await getCityFromCoordinates(location.latitude, location.longitude);
                updateNoteAddress(result.newId, address);
            } catch (e) {
                console.warn("Could not get address for shared note.", e);
            }
        }

        showUndoToast(result?.message);
        setIsShareModalOpen(false);
    };

    const handleAddToInputFromShare = () => {
        if (!sharedData) return;
        const { title, text, url } = sharedData;
        setInputValue([title, text, url].filter(Boolean).join(' '));
        setIsShareModalOpen(false);
    };


    const handleOpenEvent = (event: CalendarEvent | null) => {
        setSelectedEvent(event);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setIsMoreMenuOpen(false);
            }
            if (projectsMenuRef.current && !projectsMenuRef.current.contains(event.target as Node)) {
                setIsProjectsMenuOpen(false);
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

    const handleRevertToState = (historyId: number) => {
        const result = revertToState(historyId);
        if (result) {
            showUndoToast(result.message);
        }
    };
    
    const forceSyncAll = () => {
        if (!isOnline) {
            showOfflineError();
            return;
        }
        organizerState.forceSync();
        setDataSyncKey(k => k + 1);
    };

    useEffect(() => {
        if (!auth.accessToken || !isOnline) {
            if (!isOnline) {
                setIsGmailLoading(false);
                setIsCalendarLoading(false);
            }
            if (!auth.accessToken) {
                setIsGmailLoading(false);
                setIsCalendarLoading(false);
            }
            return;
        };

        const syncAllGoogleData = async (token: string) => {
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
                    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
                    
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
                if (!handleTokenError(e)) {
                    console.error("Multi-calendar sync failed:", e);
                }
            } finally {
                setIsCalendarLoading(false);
            }

            try {
                const labels = await googleMailService.listLabels(token);
                setGmailLabels(labels);
            } catch (err) {
                 if (!handleTokenError(err)) {
                    console.error("Failed to fetch gmail labels:", err);
                }
            }
        };

        syncAllGoogleData(auth.accessToken);

    }, [auth.accessToken, dataSyncKey, visibleCalendarIds, isOnline, handleTokenError]);
    
    useEffect(() => {
        if(auth.accessToken && isOnline) {
            googleMailService.listUnreadInboxMessages(auth.accessToken, 5)
                .then(setUnreadGmailEmails)
                .catch(e => {
                    if (!handleTokenError(e)) {
                        console.error("Failed to fetch unread emails for summary", e);
                    }
                });
        }
    }, [auth.accessToken, isOnline, dataSyncKey, handleTokenError]);

    const fetchContacts = useCallback(async () => {
        if (!auth.accessToken || !isOnline) {
            setContacts([]);
            return;
        }
        try {
            const fetchedContacts = await googlePeopleService.listContacts(auth.accessToken);
            setContacts(fetchedContacts);
        } catch (err) {
            if (!handleTokenError(err)) {
                console.error("Failed to load contacts:", err);
            }
        }
    }, [auth.accessToken, isOnline, handleTokenError]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);


    const { chatStatus, handleChatToggle, startSummarySession, itemToOpenDetailsFor, clearItemToOpen, projectToNavigateTo, clearProjectToNavigateTo } = useConversationalChat(organizerState, view === 'projectDetail' ? selectedProjectId : null, voiceSettings, auth, () => setDataSyncKey(k => k + 1), defaultCalendarId, calendarEvents, contacts, setEmailSearchResults, setIsEmailSearchModalOpen, setSelectedEmail, setEmailToCompose, setIsEmailComposerOpen);
    const { isVideoChatActive, startVideoSession, stopVideoSession, videoRef, switchCamera, canSwitchCamera } = useVideoChat(organizerState, voiceSettings, auth, contacts, calendarEvents, () => setDataSyncKey(k => k + 1), setEmailToCompose, setIsEmailComposerOpen);

    const handleStartSummary = async () => {
        if (!isOnline) {
            showOfflineError();
            return;
        }
        if (!auth.isLoggedIn) {
            auth.signIn();
            return;
        }
        
        const settings = organizerState.voiceSettings.summarySettings;
        if (!settings) return;

        let weatherData: SummaryData['weather'] = null;
        const locationForWeather = currentLocation || organizerState.voiceSettings.location;

        if (settings.includeWeather && locationForWeather) {
            try {
                weatherData = await weatherService.getTodaysWeather(locationForWeather);
            } catch (e) { console.error("Failed to fetch weather", e); }
        }

        let fitnessData: SummaryData['fitness'] = null;
        if (settings.includeFitness && auth.accessToken) {
            try {
                fitnessData = await googleFitService.getTodaysFitData(auth.accessToken);
            } catch (e) {
                if (!handleTokenError(e)) {
                    console.error("Failed to fetch fitness data", e);
                }
            }
        }

        const unread = settings.includeUnreadEmails ? unreadGmailEmails : [];
        
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const eventsToday = settings.includeEvents ? calendarEvents.filter(e => {
            const eventStart = new Date(e.start.dateTime || e.start.date!);
            return eventStart >= now && eventStart <= endOfToday;
        }) : [];

        const urgentTasks = settings.includeUrgentTasks ? organizerState.todos.filter(t => !t.completed && t.priority === Priority.High) : [];

        const recentNotes = settings.includeRecentNotes ? organizerState.notes.slice(0, 3) : [];

        startSummarySession({
            weather: weatherData,
            unreadEmails: unread,
            events: eventsToday,
            urgentTasks,
            recentNotes,
            fitness: fitnessData,
        });
    };

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
        if (!auth.accessToken || !isOnline) return;
        const calendarId = defaultCalendarId || primaryCalendarId || 'primary';
        try {
            await googleCalendarService.createEvent(auth.accessToken, calendarId, event);
            setDataSyncKey(k => k + 1);
        } catch (err) {
            if (!handleTokenError(err)) {
                console.error("Failed to create calendar event:", err);
                setError("Could not create calendar event.");
            }
        }
    };

    const handleSaveEvent = async (eventData: Partial<CalendarEvent>, calendarId: string) => {
        if (!auth.accessToken || !isOnline) return;
        try {
            if (selectedEvent && selectedEvent.id && selectedEvent.calendarId) {
                await googleCalendarService.updateEvent(auth.accessToken, selectedEvent.calendarId, selectedEvent.id, eventData);
            } else {
                await googleCalendarService.createEvent(auth.accessToken, calendarId, eventData);
            }
            setSelectedEvent(null);
            setDataSyncKey(k => k + 1);
        } catch (err) {
            if (!handleTokenError(err)) {
                console.error("Failed to save event:", err);
            }
        }
    };
    
    const handleDeleteEvent = async (eventId: string, calendarId: string) => {
        if (!auth.accessToken || !isOnline) return;
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
            try {
                await googleCalendarService.deleteEvent(auth.accessToken, calendarId, eventId);
                setSelectedEvent(null);
                setDataSyncKey(k => k + 1);
            } catch (err) {
                if (!handleTokenError(err)) {
                    console.error("Failed to delete event:", err);
                }
            }
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        if (!isOnline) {
            showOfflineError();
            return;
        }
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
                const { messages } = processAdditionQueue(queue);
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

// FIX: Refactor to use the newId returned from `addProject` for robustness.
    const handlePlanGeneratedForProject = (generatedProject: { title: string; description: string; plan: OrganizedData }) => {
        const { title, description, plan } = generatedProject;

        const addProjectResult = addProject(title, description || "Ce projet a été planifié avec l'assistant IA.");
        if (!addProjectResult) {
            console.error("Failed to create project, it might already exist.");
            // Optionally, show an error to the user
            return;
        }
        const newProjectId = addProjectResult.newId;

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
    };

    const handleDragStart = (itemInfo: DragItemInfo) => setDraggingItem(itemInfo);
    const handleDragEnter = (type: ListType, listId?: string, index?: number) => { if (draggingItem) { setIsTrashActive(false); setDropTarget({ type, listId, index }); } };
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    
    const convertEmailToListItems = async (email: FullEmail, destType: ListType | 'notes', destListId?: string) => {
        setIsLoading(true);
        setError(null);
    
        try {
            // FIX: Use `bodyHtml` instead of `body` which does not exist on FullEmail type.
            const emailContentForDescription = `<p><em>From email:</em></p><p><strong>From:</strong> ${email.from}<br><strong>Subject:</strong> ${email.subject}</p><hr>${email.bodyHtml}`;
    
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
                const { messages } = processAdditionQueue(queue);
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
            handleOpenAddEmailToListModal(draggingItem.content as FullEmail);
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
    
    const handleMergeDuplicate = () => {
        const { messages, newItems } = skipDuplicateAndContinue() || {};
        if (messages && messages.length > 0) {
            showUndoToast(messages.join(' '));
        }
    };
    
    const confirmDuplicateAndContinue = () => {
        const result = confirmDuplicateAdd();
        if (result) {
            const { messages } = result;
            if (messages && messages.length > 0) {
                showUndoToast(messages.join(' '));
            }
        }
    };

    const handleAddAnalyzedItems = (queue: QueuedItem[]) => {
        if (queue.length > 0) {
            const { messages } = processAdditionQueue(queue);
            if (messages.length > 0) showUndoToast(messages.join(' '));
        }
    };
    
    const handleAnalyzeStyle = async () => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour utiliser cette fonctionnalité.", false);
            return;
        }
        try {
            const style = await analyzeWritingStyle(auth.accessToken);
            updateVoiceSettings({ writingStyle: style });
            showUndoToast("Votre style d'écriture a été analysé et sauvegardé !");
        } catch (error) {
            if (!handleTokenError(error)) {
                console.error("Style analysis failed:", error);
                showUndoToast(error instanceof Error ? error.message : "Une erreur est survenue.", false);
            }
        }
    };

    const handleOpenEmail = async (emailId: string) => {
        if (!auth.accessToken) {
            return;
        }
        try {
            const fullEmail = await googleMailService.getEmail(auth.accessToken, emailId);
            setSelectedEmail(fullEmail);
            googleMailService.markAsRead(auth.accessToken, emailId).catch(console.error);
        } catch (e) {
            if (!handleTokenError(e)) {
                console.error("Failed to fetch email content:", e);
                showUndoToast("Impossible d'ouvrir l'e-mail.", false);
            }
        }
    };

    const handleMoveEmail = async (emailId: string, newLabelId: string) => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour déplacer des e-mails.", false);
            return;
        }
        try {
            const addLabelIds = newLabelId ? [newLabelId] : [];
            const removeLabelIds = ['INBOX']; 

            await googleMailService.moveEmail(auth.accessToken, emailId, addLabelIds, removeLabelIds);

            setSelectedEmail(null);
            
            const message = newLabelId ? "E-mail déplacé avec succès !" : "E-mail archivé avec succès !";
            showUndoToast(message);
        } catch (error) {
            if (!handleTokenError(error)) {
                showUndoToast("Échec du déplacement de l'e-mail.", false);
                console.error("Failed to move email:", error);
            }
        }
    };

    const handleComposeNewEmail = () => {
        setEmailToCompose({ to: '', cc: '', bcc: '', subject: '', body: '' });
        setIsEmailComposerOpen(true);
    };

    const handleReplyToEmail = (email: FullEmail) => {
        const fromAddress = email.from.match(/<(.+)>/)?.[1] || email.from;
        setSelectedEmail(null);
        setIsConversationModalOpen(false);
        setEmailToCompose({
            to: fromAddress,
            cc: '',
            bcc: '',
            subject: `Re: ${email.subject}`,
            // FIX: Use `bodyHtml` instead of `body` which does not exist on FullEmail type.
            body: `<p><br></p><p><br></p><hr><p>Le ${new Date().toLocaleString()}, ${email.from} a écrit :</p><blockquote>${email.bodyHtml}</blockquote>`,
            threadId: email.threadId,
            inReplyTo: email.messageId,
            references: email.references ? `${email.references} ${email.messageId}` : email.messageId
        });
        setIsEmailComposerOpen(true);
    };

    const handleForwardEmail = (email: FullEmail) => {
        setSelectedEmail(null);
        setIsConversationModalOpen(false);
        setEmailToCompose({
            to: '',
            cc: '',
            bcc: '',
            subject: `Fwd: ${email.subject}`,
            body: `<p><br></p><p>---------- Message transféré ----------<br>De : ${email.from}<br>Date : ${new Date(email.date).toLocaleString()}<br>Sujet : ${email.subject}<br>À : ${email.to}</p><br>${email.bodyHtml}`
        });
        setIsEmailComposerOpen(true);
    };

    const handleComposerSend = async (emailData: EmailData) => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour envoyer des e-mails.", false);
            return;
        }
        try {
            await googleMailService.sendEmail(auth.accessToken, emailData.to, emailData.subject, emailData.body, emailData.cc, emailData.bcc, emailData.threadId, emailData.inReplyTo, emailData.references);
            showUndoToast("E-mail envoyé avec succès !");
            setDataSyncKey(k => k + 1);
        } catch (error) {
            if (!handleTokenError(error)) {
                showUndoToast("Échec de l'envoi de l'e-mail.", false);
            }
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
                if (!handleTokenError(error)) {
                    showUndoToast("Échec de l'enregistrement du brouillon.", false);
                }
            }
        }
    };
    
    const handleLinkItem = (projectId: string, itemType: AllItemTypes, itemId: string) => {
        showUndoToast(linkItemToProject(projectId, itemType, itemId)?.message);
    };
    const handleUnlinkItem = (itemType: AllItemTypes, itemId: string) => {
        showUndoToast(unlinkItemFromProject(itemType, itemId)?.message);
    };

    const handleWidgetDragStart = (key: string, e: React.DragEvent) => {
        if (!isReordering) return;
        e.dataTransfer.effectAllowed = 'move';
        // Use a transparent image to hide the default drag ghost
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
        setDraggedWidgetKey(key);
    };

    const handleWidgetDragEnter = (key: string) => {
        if (isReordering && draggedWidgetKey && draggedWidgetKey !== key) {
            setDragOverWidgetKey(key);
        }
    };
    
    const handleWidgetDrop = () => {
        if (!draggedWidgetKey || !dragOverWidgetKey || draggedWidgetKey === dragOverWidgetKey) return;
        
        const deviceType = isMobile ? 'mobile' : 'desktop';
        const currentOrder = widgetOrders[deviceType];
    
        const fromIndex = currentOrder.indexOf(draggedWidgetKey);
        const toIndex = currentOrder.indexOf(dragOverWidgetKey);
    
        if (fromIndex === -1 || toIndex === -1) return;
        
        const newOrder = [...currentOrder];
        const [movedItem] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedItem);
    
        setWidgetOrders({
            ...widgetOrders,
            [deviceType]: newOrder
        });
    };
    
    const handleWidgetDragEnd = () => {
        setDraggedWidgetKey(null);
        setDragOverWidgetKey(null);
    };
    
    const handleManualAddTodo = (projectId: string | null = null) => {
        const result = addTodo('', Priority.Medium, projectId);
        showUndoToast(result?.message);
    };

    const handleManualAddShoppingItem = (projectId: string | null = null) => {
        const result = addShoppingItem('', projectId);
        showUndoToast(result?.message);
    };

    const handleManualAddNote = async (projectId: string | null = null) => {
        const location = await getCurrentLocation();
        const result = addNote('<p><br></p>', projectId, location);
        if (result?.newId) {
            setSelectedNoteId(result.newId);
            if (location) {
                try {
                    const address = await getCityFromCoordinates(location.latitude, location.longitude);
                    updateNoteAddress(result.newId, address);
                } catch (e) {
                    console.warn("Could not get address for new note.", e);
                }
            }
        }
        showUndoToast(result?.message);
    };

    const handleCategorizeShoppingList = async () => {
        if (!isOnline) {
            showOfflineError();
            return;
        }
        const uncategorizedItems = organizerState.shoppingList
            .filter(item => !item.category || !item.aisle)
            .map(item => ({ id: item.id, item: item.item }));
        
        if (uncategorizedItems.length === 0) {
            showUndoToast("Tous les articles sont déjà catégorisés.", false);
            return;
        }

        setIsCategorizing(true);
        try {
            const updates = await categorizeShoppingItems(uncategorizedItems);
            showUndoToast(updateShoppingItemCategories(updates)?.message);
        } catch (error) {
            console.error("Categorization failed:", error);
            showUndoToast("La catégorisation a échoué.", false);
        } finally {
            setIsCategorizing(false);
        }
    };

    const handleReEnrich = async (todoId: string, taskText: string, query: string) => {
        if (!isOnline) {
            showOfflineError();
            return;
        }
        setEnrichingTodoIds(prev => new Set(prev).add(todoId));
        try {
            const { taskId, enrichedData, enrichmentMetadata } = await enrichTask({ id: todoId, taskText, enrichmentQuery: query });
            setTodoEnrichment(taskId, enrichedData, enrichmentMetadata);
        } catch (err) {
            console.error(`Failed to re-enrich task ${todoId}:`, err);
            setError(`Failed to get enrichment for "${taskText}"`);
        } finally {
            setEnrichingTodoIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(todoId);
                return newSet;
            });
        }
    };

    const handleOpenConversationModal = (contactEmail: string) => {
        setSelectedContactEmailForModal(contactEmail);
        setIsConversationModalOpen(true);
    };

    const handleConfirmUnsubscribe = async () => {
        if (!unsubscribeTarget || !unsubscribeTarget.unsubscribeLink || !auth.accessToken) return;
    
        try {
            const result = await googleMailService.unsubscribe(auth.accessToken, unsubscribeTarget.unsubscribeLink);
            if (result.action === 'mailto') {
                showUndoToast("Demande de désabonnement envoyée.", true);
            } else if (result.action === 'http' && result.value) {
                window.open(result.value, '_blank');
                showUndoToast("Une page de désabonnement a été ouverte.", true);
            } else {
                showUndoToast("Impossible de trouver un lien de désabonnement valide.", false);
            }
        } catch (error) {
            if (!handleTokenError(error)) {
                console.error("Unsubscribe failed:", error);
                showUndoToast("Échec de la tentative de désabonnement.", false);
            }
        }
        setUnsubscribeTarget(null);
    };

    const handleTrashThread = async (threadId: string) => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour supprimer des conversations.", false);
            return;
        }
        try {
            await googleMailService.trashThread(auth.accessToken, threadId);
            showUndoToast("Conversation déplacée dans la corbeille.");
        } catch (error) {
            if (!handleTokenError(error)) {
                console.error("Failed to trash thread:", error);
                showUndoToast("La suppression de la conversation a échoué.", false);
            }
        }
    };
    
    const handleMarkAllAsRead = async () => {
        if (!auth.accessToken) {
            showUndoToast("Veuillez vous connecter pour cette action.", false);
            return;
        }
        try {
            await googleMailService.markAllAsRead(auth.accessToken);
            showUndoToast("Tous les messages ont été marqués comme lus.");
        } catch (error) {
            if (!handleTokenError(error)) {
                console.error("Failed to mark all as read:", error);
                showUndoToast("Une erreur est survenue.", false);
            }
        }
    };

    const handleEditDraft = (email: FullEmail) => {
        setEmailToCompose({
            to: email.to,
            cc: '', // Not available easily from current data model
            bcc: '', // Not available easily
            subject: email.subject,
            body: email.bodyHtml,
            threadId: email.threadId,
            inReplyTo: email.inReplyTo,
            references: email.references,
        });
        setIsEmailComposerOpen(true);
        setIsConversationModalOpen(false);
    };

    const handleOpenAddEmailToListModal = (email: FullEmail) => {
        setEmailToAddToList(email);
    };

    const handleConfirmAddEmailToList = async (listType: ListType | 'notes', listId?: string) => {
        if (emailToAddToList) {
            await convertEmailToListItems(emailToAddToList, listType, listId);
        }
        setEmailToAddToList(null);
    };

    const selectedTodo = todos.find(t => t.id === selectedTodoId) || null;
    const selectedNote = notes.find(n => n.id === selectedNoteId) || null;
    const selectedShoppingItem = shoppingList.find(s => s.id === selectedShoppingItemId) || null;
    const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
    const selectedCustomListData = selectedCustomItem ? customLists.find(l => l.id === selectedCustomItem.listId) : null;
    const selectedCustomListItemData = selectedCustomListData?.items.find(i => i.id === selectedCustomItem?.itemId);

    const renderWidgets = () => {
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
        
        const selectionProps = {
            selection,
            selectedIds,
            onStartSelection: startSelectionMode,
            onEndSelection: endSelectionMode,
            onToggleSelection: toggleItemSelected,
            onSelectAll: selectAllInList,
            onClearSelection: clearSelection,
        };

        const widgetsMap: { [key: string]: React.ReactElement } = {
            'gmail': <GmailView auth={auth} onCompose={handleComposeNewEmail} onRefresh={() => setDataSyncKey(k => k + 1)} isCollapsed={!!collapsedWidgets['gmail']} onToggleCollapse={() => handleToggleWidget('gmail')} isReordering={isReordering} isOnline={isOnline} onConversationSelect={handleOpenConversationModal} contacts={contacts} />,
            'schedule': <CalendarWidget auth={auth} events={calendarEvents} isLoading={isCalendarLoading} onRefresh={() => setDataSyncKey(k => k + 1)} calendars={calendars} defaultCalendarId={defaultCalendarId} isCollapsed={!!collapsedWidgets['schedule']} onToggleCollapse={() => handleToggleWidget('schedule')} onOpenEvent={handleOpenEvent} isReordering={isReordering} currentUserCoordinates={currentUserCoordinates} voiceSettings={voiceSettings} fetchAndCacheTravelInfo={fetchAndCacheTravelInfo} />,
            'todos': <TodoList items={visibleTodos} projects={projects} onToggle={(id) => showUndoToast(handleToggleTodo(id)?.message)} onEditPriority={(id, priority) => showUndoToast(editTodoPriority(id, priority)?.message)} onOpenDetails={setSelectedTodoId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'todos'} sortOrder={todoSortOrder} onSetSortOrder={(order) => showUndoToast(setTodoSortOrder(order)?.message)} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets['todos']} onToggleCollapse={() => handleToggleWidget('todos')} {...selectionProps} onAddItem={() => handleManualAddTodo()} isReordering={isReordering} enrichingTodoIds={enrichingTodoIds} />,
            'shopping': <ShoppingList items={visibleShoppingList} projects={projects} onToggle={(id) => showUndoToast(handleToggleShoppingItem(id)?.message)} onOpenDetails={setSelectedShoppingItemId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'shopping'} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets['shopping']} onToggleCollapse={() => handleToggleWidget('shopping')} {...selectionProps} onAddItem={() => handleManualAddShoppingItem()} isReordering={isReordering} shoppingSortOrder={shoppingSortOrder} onSetShoppingSortOrder={(order: ShoppingSortOrder) => showUndoToast(setShoppingSortOrder(order)?.message)} onCategorizeItems={handleCategorizeShoppingList} isCategorizing={isCategorizing} onEditDetails={(id, details) => showUndoToast(editShoppingItemDetails(id, details)?.message)} />,
            'notes': <NotesList items={visibleNotes} projects={projects} onOpenDetails={setSelectedNoteId} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'notes'} isCollapsed={!!collapsedWidgets['notes']} onToggleCollapse={() => handleToggleWidget('notes')} {...selectionProps} onAddItem={() => handleManualAddNote()} isReordering={isReordering} />,
        };

        customLists.forEach(list => {
             const visibleItems = list.items.filter(item => isItemVisible(item, 'customLists'));
             if (visibleItems.length > 0) {
                const listWithVisibleItems = { ...list, items: visibleItems };
                widgetsMap[list.id] = <CustomListComponent key={list.id} list={listWithVisibleItems} projects={projects} onAddItem={(listId, text) => showUndoToast(addCustomListItem(listId, text)?.message)} onDeleteList={(listId) => showUndoToast(deleteCustomList(listId)?.message)} onToggleItem={(listId, itemId) => showUndoToast(toggleCustomListItem(listId, itemId)?.message)} onOpenDetails={(listId, itemId) => setSelectedCustomItem({ listId, itemId })} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDrop={handleDrop} draggingItem={draggingItem} isDropTarget={dropTarget?.type === 'custom' && dropTarget.listId === list.id} activeFilter={activeFilter} onClearFilter={clearFilter} isCollapsed={!!collapsedWidgets[`custom_${list.id}`]} onToggleCollapse={() => handleToggleWidget(`custom_${list.id}`)} {...selectionProps} isReordering={isReordering} />
             }
        });
        
        const deviceType = isMobile ? 'mobile' : 'desktop';
        const currentOrder = widgetOrders[deviceType] || [];

        const isDragging = isReordering && !!(draggedWidgetKey && dragOverWidgetKey);
        const displayOrder = useMemo(() => {
            if (!isDragging) return currentOrder.filter(key => widgetsMap[key]);

            const fromIndex = currentOrder.indexOf(draggedWidgetKey!);
            const toIndex = currentOrder.indexOf(dragOverWidgetKey!);

            if (fromIndex === -1 || toIndex === -1) return currentOrder.filter(key => widgetsMap[key]);

            const newOrder = [...currentOrder];
            const [movedItem] = newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, movedItem);
            
            return newOrder.filter(key => widgetsMap[key]);
        }, [isDragging, currentOrder, draggedWidgetKey, dragOverWidgetKey, widgetsMap]);

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {displayOrder.map(key => (
                    <div 
                        key={key}
                        draggable={isReordering}
                        onDragStart={(e) => handleWidgetDragStart(key, e)}
                        onDragEnter={() => handleWidgetDragEnter(key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleWidgetDrop}
                        onDragEnd={handleWidgetDragEnd}
                        className={`transition-all duration-300 ease-in-out ${draggedWidgetKey === key ? 'widget-dragging' : ''}`}
                    >
                        {widgetsMap[key]}
                    </div>
                ))}
                {!isReordering && <AddListComponent onAddList={(title, fields) => showUndoToast(addCustomList(title, fields)?.message)} />}
            </div>
        );
    }

    if (route === '#/privacy') {
        return <PrivacyPolicy onBack={() => window.location.hash = ''} />;
    }
    if (route === '#/terms') {
        return <TermsOfUse onBack={() => window.location.hash = ''} />;
    }
    if (route === '#/help') {
        return <HelpPage onBack={() => window.location.hash = ''} />;
    }

    return (
        <div className={`min-h-screen bg-slate-100 text-slate-800 font-sans px-4 sm:px-6 lg:px-8 pb-8 transition-all duration-300 ${selection.isActive ? 'pb-28' : ''} ${(isReordering || isGoogleSessionExpired) ? 'pt-20' : 'pt-2 sm:pt-3 lg:pt-4'}`}>
            <div className={`fixed top-0 left-0 right-0 bg-yellow-500 text-white p-2 z-50 text-center font-semibold offline-banner ${!isOnline ? 'visible' : ''}`} role="status">
                Vous êtes hors ligne. Les fonctionnalités IA et la synchronisation sont désactivées.
            </div>
            {isGoogleSessionExpired && <ReconnectBanner onReconnect={handleReconnect} />}
            {showOfflineWarning && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-4 bg-red-600 text-white rounded-lg shadow-2xl animate-fade-in-down">
                    Cette fonctionnalité nécessite une connexion internet.
                </div>
            )}
            {isReordering && (
                <div className="fixed top-0 left-0 right-0 bg-indigo-600 text-white p-3 z-50 flex justify-center items-center gap-4 shadow-lg animate-fade-in-down">
                    <span className="font-semibold">Mode réorganisation activé</span>
                    <button 
                        onClick={() => setIsReordering(false)} 
                        className="px-4 py-1 bg-white text-indigo-600 font-semibold rounded-md hover:bg-indigo-50 transition-colors"
                    >
                        Terminé
                    </button>
                </div>
            )}
            <div className="max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <img src="https://i.imgur.com/Kh5mOZ0.png" alt="AI Organizer Logo" className="h-16 w-auto md:h-20" />
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden md:flex items-center gap-3">
                            <button onClick={() => setIsSearchOpen(true)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Recherche globale">
                                <MagnifyingGlassIcon className="w-6 h-6" />
                            </button>
                             {isProjectView ? (
                                <button onClick={() => setView('lists')} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Voir les listes">
                                    <Bars3Icon className="w-6 h-6" />
                                </button>
                            ) : (
                                <div
                                    ref={projectsMenuRef}
                                    className="relative"
                                    onMouseEnter={() => setIsProjectsMenuOpen(true)}
                                    onMouseLeave={() => setIsProjectsMenuOpen(false)}
                                >
                                    <button
                                        onClick={() => setView('projectsDashboard')}
                                        className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400"
                                        aria-label="Voir les projets"
                                    >
                                        <RectangleGroupIcon className="w-6 h-6" />
                                    </button>
                                    {isProjectsMenuOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl py-1 z-20 animate-fade-in-up">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b">Projets</div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {projects.length > 0 ? projects.map(project => (
                                                    <button
                                                        key={project.id}
                                                        onClick={() => {
                                                            handleNavigateToProject(project.id);
                                                            setIsProjectsMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 truncate"
                                                    >
                                                        {project.title}
                                                    </button>
                                                )) : (
                                                    <div className="px-4 py-3 text-sm text-slate-500 text-center">Aucun projet</div>
                                                )}
                                            </div>
                                            <div className="my-1 h-px bg-slate-200"></div>
                                            <button
                                                onClick={() => { setIsCreateProjectModalOpen(true); setIsProjectsMenuOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                <PlusIcon className="w-5 h-5 text-indigo-500" />
                                                <span>Nouveau projet</span>
                                            </button>
                                            <button
                                                onClick={() => { isOnline ? setIsPlannerOpen(true) : showOfflineError(); setIsProjectsMenuOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                                disabled={!isOnline}
                                            >
                                                <SparklesIcon className="w-5 h-5 text-purple-500" />
                                                <span>Nouveau projet IA</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                         <Auth auth={auth} onOpenSettings={() => setIsSettingsModalOpen(true)} onRefresh={forceSyncAll} onStartReorder={() => setIsReordering(true)} isOnline={isOnline} onOpenHistory={() => setIsHistoryModalOpen(true)} />

                        <div ref={moreMenuRef} className="relative md:hidden">
                            <button onClick={() => setIsMoreMenuOpen(prev => !prev)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Plus d'options">
                                <EllipsisVerticalIcon className="w-6 h-6" />
                            </button>
                            {isMoreMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 animate-fade-in-up">
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
                            <InputBar value={inputValue} onChange={(e) => setInputValue(e.target.value)} onSubmit={handleSubmit} isLoading={isLoading} error={error} isChatting={chatStatus !== 'idle'} isOnline={isOnline} />
                        </div>
                    )}
                    {view === 'lists' && renderWidgets()}
                    {view === 'projectsDashboard' && (
                        <ProjectsDashboard
                            projects={projects}
                            todos={todos}
                            shoppingList={shoppingList}
                            customLists={customLists}
                            onSelectProject={(id) => { setSelectedProjectId(id); setView('projectDetail'); }}
                            onCreateProject={() => setIsCreateProjectModalOpen(true)}
                            onPlanProjectWithAI={() => isOnline ? setIsPlannerOpen(true) : showOfflineError()}
                            onDeleteProject={(id) => showUndoToast(deleteProject(id)?.message)}
                            onLinkItems={(project) => setLinkingProject(project)}
                            isOnline={isOnline}
                        />
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
                            gmailEmails={[]}
                            calendarEvents={calendarEvents}
                            onOpenEmail={handleOpenEmail}
                            onOpenEvent={handleOpenEvent}
                            onAddTodo={() => handleManualAddTodo(selectedProject.id)}
                            onAddShoppingItem={() => handleManualAddShoppingItem(selectedProject.id)}
                            onAddNote={() => handleManualAddNote(selectedProject.id)}
                            onSetShoppingSortOrder={(order) => showUndoToast(setShoppingSortOrder(order)?.message)}
                            onCategorizeItems={handleCategorizeShoppingList}
                            isCategorizing={isCategorizing}
                            enrichingTodoIds={enrichingTodoIds}
                            mapsApiLoaded={mapsApiLoaded}
                        />
                    )}
                </main>
                <footer className="mt-16 text-center text-sm text-slate-500">
                    <button onClick={handleImportClick} className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Importer les données</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={handleExportData} className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Exporter les données</button>
                    <span className="text-slate-300">|</span>
                    <a href="#/help" className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Aide</a>
                    <span className="text-slate-300">|</span>
                    <a href="#/privacy" className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Règles de confidentialité</a>
                    <span className="text-slate-300">|</span>
                    <a href="#/terms" className="hover:underline hover:text-indigo-600 transition-colors px-3 py-1">Conditions d'utilisation</a>
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
            <AIChatWidget
                isOpen={isTextChatOpen}
                onClose={() => setIsTextChatOpen(false)}
                organizerState={organizerState}
                isOnline={isOnline}
                userProfile={auth.profile}
                calendarEvents={calendarEvents}
                contacts={contacts}
                voiceSettings={voiceSettings}
                currentLocation={currentLocation}
                currentUserCoordinates={currentUserCoordinates}
                unreadEmails={unreadGmailEmails}
                accessToken={auth.accessToken}
                handleTokenError={handleTokenError}
            />
            <ConsolidatedAIChatFAB
                isMobile={isMobile}
                isVoiceChatActive={chatStatus !== 'idle' && chatStatus !== 'error'}
                onOpenTextChat={() => setIsTextChatOpen(true)}
                onToggleVoiceChat={handleChatToggle}
                onOpenVideoOptions={() => setIsCameraChoiceOpen(true)}
                disabled={!isOnline || isVideoChatActive}
            />
            <ProjectPlannerModal isOpen={isPlannerOpen} onClose={() => setIsPlannerOpen(false)} onPlanGenerated={handlePlanGeneratedForProject} voiceSettings={voiceSettings} />
            <PhotoAnalyzerModal
                isOpen={isPhotoAnalyzerModalOpen}
                onClose={() => setIsPhotoAnalyzerModalOpen(false)}
                onAddAnalyzedItems={handleAddAnalyzedItems}
                customLists={customLists}
                shoppingList={shoppingList}
                onCheckShoppingListItems={(itemIds) => {
                    const messages: string[] = [];
                    itemIds.forEach(id => {
                        const msg = handleToggleShoppingItem(id)?.message;
                        if (msg) messages.push(msg);
                    });
                    showUndoToast(messages.join('. ') || 'Articles de courses mis à jour.');
                }}
                onCreateContact={async (contact) => {
                    if (!auth.accessToken) {
                        showUndoToast("Veuillez vous connecter pour créer un contact.", false);
                        return;
                    }
                    try {
                        await googlePeopleService.createContact(auth.accessToken, contact.name, contact.email, contact.phone);
                        showUndoToast(`Contact "${contact.name}" créé.`);
                        fetchContacts();
                    } catch (e) {
                        if (!handleTokenError(e)) {
                            console.error(e);
                            showUndoToast("La création du contact a échoué.", false);
                        }
                    }
                }}
                onCreateEvent={async (event) => {
                    if (!auth.isLoggedIn) {
                        auth.signIn();
                        return;
                    }
                    const existingEvents = calendarEvents.filter(e => {
                        const eventStart = new Date(event.start.dateTime).getTime();
                        const eventEnd = new Date(event.end.dateTime).getTime();
                        const existingStart = new Date(e.start.dateTime!).getTime();
                        const existingEnd = new Date(e.end.dateTime!).getTime();
                        return Math.max(eventStart, existingStart) < Math.min(eventEnd, existingEnd);
                    });
                    
                    if (existingEvents.length > 0) {
                        setEventConflict({ event, conflictingEvents: existingEvents });
                    } else {
                        await createCalendarEvent(event);
                        showUndoToast(`Événement "${event.summary}" créé.`);
                    }
                }}
                onCreateEmail={(email) => {
                    setEmailToCompose({ to: email.recipient || '', subject: email.subject || '', body: `<p>${(email.body || '').replace(/\n/g, '<br>')}</p>`, cc: '', bcc: '' });
                    setIsEmailComposerOpen(true);
                }}
            />
            <CameraChoiceModal
                isOpen={isCameraChoiceOpen}
                onClose={() => setIsCameraChoiceOpen(false)}
                onAnalyzePhoto={() => {
                    setIsPhotoAnalyzerModalOpen(true);
                    setIsCameraChoiceOpen(false);
                }}
                onVideoChat={() => {
                    startVideoSession();
                    setIsCameraChoiceOpen(false);
                }}
            />
            <CameraModal isOpen={isVideoChatActive} onClose={stopVideoSession} videoRef={videoRef} onSwitchCamera={switchCamera} canSwitchCamera={canSwitchCamera} />
            <EmailSearchResultsModal isOpen={isEmailSearchModalOpen} emails={emailSearchResults} onClose={() => setIsEmailSearchModalOpen(false)} onSelectEmail={async (emailId) => { if (!auth.accessToken) return; try { const fullEmail = await googleMailService.getEmail(auth.accessToken, emailId); setSelectedEmail(fullEmail); } catch (e) { console.error("Failed to fetch selected email", e); } }} />
            <EmailDetailModal
                isOpen={!!selectedEmail}
                email={selectedEmail}
                onClose={() => setSelectedEmail(null)}
                onReply={handleReplyToEmail}
                projects={projects} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem}
                gmailLabels={gmailLabels}
                onMoveEmail={handleMoveEmail}
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
                mapsApiLoaded={mapsApiLoaded}
                currentUserCoordinates={currentUserCoordinates}
                voiceSettings={voiceSettings}
                fetchAndCacheTravelInfo={fetchAndCacheTravelInfo}
            />
             <GlobalSearchModal 
                isOpen={isSearchOpen}
                onClose={() => { setIsSearchOpen(false); search.resetSearch(); }}
                query={search.query}
                onQueryChange={search.setQuery}
                results={search.results}
                isLoading={search.isLoading}
                onSelectTodo={setSelectedTodoId}
                onSelectShoppingItem={setSelectedShoppingItemId}
                onSelectNote={setSelectedNoteId}
                onSelectCustomItem={(listId, itemId) => setSelectedCustomItem({ listId, itemId })}
                onSelectProject={handleNavigateToProject}
                onSelectEmail={setSelectedEmail}
             />
            <ShareReceiverModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                sharedData={sharedData || {}}
                aiSuggestion={aiShareSuggestion}
                isLoadingSuggestion={isSuggestionLoading}
                onConfirm={handleConfirmShare}
                onAddToInput={handleAddToInputFromShare}
            />
            <ConversationModal
                isOpen={isConversationModalOpen}
                onClose={() => setIsConversationModalOpen(false)}
                initialContactEmail={selectedContactEmailForModal}
                auth={auth}
                onCompose={handleComposeNewEmail}
                onEditDraft={handleEditDraft}
                contacts={contacts}
                onReplyToEmail={handleReplyToEmail}
                onForwardEmail={handleForwardEmail}
                onUnsubscribeRequest={setUnsubscribeTarget}
                onTrashThread={handleTrashThread}
                onMarkAllAsRead={handleMarkAllAsRead}
                onAddToList={handleOpenAddEmailToListModal}
            />
            <AddEmailToListModal
                isOpen={!!emailToAddToList}
                onClose={() => setEmailToAddToList(null)}
                onConfirm={handleConfirmAddEmailToList}
                customLists={customLists}
            />
            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                history={history}
                onRevert={handleRevertToState}
            />
            <ConfirmationModal isOpen={!!importConfirmationFile} title="Confirmer l'importation" message="Êtes-vous sûr de vouloir importer ces données ? Cela écrasera toutes vos listes actuelles." onConfirm={confirmImport} onCancel={cancelImport} />
            <ConfirmationModal 
                isOpen={!!unsubscribeTarget}
                title="Confirmer le désabonnement ?"
                message={`Voulez-vous vraiment vous désabonner des e-mails provenant de "${unsubscribeTarget?.name}" ?`}
                onConfirm={handleConfirmUnsubscribe}
                onCancel={() => setUnsubscribeTarget(null)}
            />
            {eventConflict && ( <ConfirmationModal isOpen={!!eventConflict} title="Conflit d'agenda" message={`Vous avez déjà un événement prévu à ce moment-là : "${eventConflict.conflictingEvents[0].summary}". Voulez-vous ajouter cet événement quand même ?`} onConfirm={() => { createCalendarEvent(eventConflict.event); setEventConflict(null); }} onCancel={() => setEventConflict(null)} /> )}
            <DuplicateConfirmationModal isOpen={!!duplicateConfirmation} newItemText={duplicateConfirmation?.newItem.content.task || duplicateConfirmation?.newItem.content.item || duplicateConfirmation?.newItem.content.text || ''} existingItemText={duplicateConfirmation?.existingItem.text || ''} onConfirmAdd={confirmDuplicateAndContinue} onSkipAndContinue={handleMergeDuplicate} onCancel={clearDuplicateConfirmation} />
            <CreateProjectModal isOpen={isCreateProjectModalOpen} onClose={() => setIsCreateProjectModalOpen(false)} onAddProject={(title, desc) => showUndoToast(addProject(title, desc)?.message)} />
             <LinkItemsModal isOpen={!!linkingProject} onClose={() => setLinkingProject(null)} project={linkingProject} onUpdateLinks={(projectId, links) => showUndoToast(updateProjectLinks(projectId, links)?.message)} todos={todos} shoppingList={shoppingList} notes={notes} customLists={customLists} />
             <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                settings={voiceSettings} 
                onUpdateSettings={updateVoiceSettings} 
                calendars={calendars} 
                defaultCalendarId={defaultCalendarId} 
                onSetDefaultCalendarId={setDefaultCalendarId} 
                onAnalyzeStyle={handleAnalyzeStyle} 
                visibleCalendarIds={visibleCalendarIds} 
                onUpdateVisibleCalendars={updateVisibleCalendars} 
                userProfile={auth.profile}
            />
            {selectedTodo && ( <TodoDetailModal
                isOpen={!!selectedTodoId}
                onClose={() => setSelectedTodoId(null)}
                todo={selectedTodo}
                projects={projects}
                onNavigateToProject={handleNavigateToProject}
                onEditTitle={(id, title) => showUndoToast(editTodo(id, title)?.message)}
                onEditPriority={(id, priority) => showUndoToast(editTodoPriority(id, priority)?.message)}
                onEditDescription={(id, desc) => showUndoToast(editTodoDescription(id, desc, true)?.message)}
                onAddSubtask={(id, text) => showUndoToast(addTodoSubtask(id, text)?.message)}
                onToggleSubtask={(todoId, subtaskId) => showUndoToast(toggleTodoSubtask(todoId, subtaskId)?.message)}
                onDeleteSubtask={(todoId, subtaskId) => showUndoToast(deleteTodoSubtask(todoId, subtaskId)?.message)}
                onEditSubtask={(todoId, subtaskId, text) => showUndoToast(editTodoSubtask(todoId, subtaskId, text)?.message)}
                onEditDueDate={(id, date) => showUndoToast(editTodoDueDate(id, date)?.message)}
                onLinkItem={handleLinkItem}
                onUnlinkItem={handleUnlinkItem}
                voiceSettings={voiceSettings}
                onReEnrich={handleReEnrich}
                isEnriching={enrichingTodoIds.has(selectedTodo.id)}
            /> )}
            {selectedNote && ( <NoteDetailModal isOpen={!!selectedNoteId} onClose={() => setSelectedNoteId(null)} note={selectedNote} projects={projects} onNavigateToProject={handleNavigateToProject} onEdit={(id, content) => showUndoToast(editNote(id, content)?.message)} onRevert={(noteId, entry) => showUndoToast(revertNoteToVersion(noteId, entry)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} voiceSettings={voiceSettings} /> )}
             {selectedShoppingItem && ( <ShoppingDetailModal isOpen={!!selectedShoppingItemId} onClose={() => setSelectedShoppingItemId(null)} item={selectedShoppingItem} projects={projects} onNavigateToProject={handleNavigateToProject} onEditItem={(id, name) => showUndoToast(editShoppingItem(id, name)?.message)} onEditDetails={(id, details) => showUndoToast(editShoppingItemDetails(id, details)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} mapsApiLoaded={mapsApiLoaded} /> )}
             {selectedCustomItem && selectedCustomListItemData && selectedCustomListData && ( <CustomListItemDetailModal isOpen={!!selectedCustomItem} onClose={() => setSelectedCustomItem(null)} item={selectedCustomListItemData} list={selectedCustomListData} listId={selectedCustomItem.listId} projects={projects} onNavigateToProject={handleNavigateToProject} onEditDetails={(listId, itemId, details) => showUndoToast(editCustomListItemDetails(listId, itemId, details)?.message)} onLinkItem={handleLinkItem} onUnlinkItem={handleUnlinkItem} /> )}
        </div>
    );
};

export default App;