import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Blob, Type, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { ai } from '../services/aiClient';
import { TodoItem, ShoppingItem, NoteItem, Priority, CustomList, SubtaskItem, ShoppingUnit, GenericItem, FilterState, Project, VoiceSettings, CalendarEvent, FullEmail, TodoSortOrder, Contact, EmailData } from '../types';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { levenshteinDistance } from '../utils/fuzzyMatching';
import { 
    baseFunctionDeclarations, 
    formatTodosForAI, 
    formatShoppingForAI, 
    formatNotesForAI, 
    formatCustomListsForAI,
    buildSystemInstruction,
    formatCalendarEventsForAI,
    formatContactsForAI
} from '../services/aiConfig';
import { filterListWithAI } from '../services/geminiService';
import * as googleCalendarService from '../services/googleCalendarService';
import * as googleMailService from '../services/googleMailService';
import { useOrganizerState, ListType } from './useOrganizerState';
import { useAuth } from './useAuth';


interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media?: Blob; text?: string }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; } }): void;
}

type OrganizerProps = ReturnType<typeof useOrganizerState>;

export const useConversationalChat = (
    organizer: OrganizerProps, 
    currentProjectId: string | null = null, 
    voiceSettings: VoiceSettings, 
    auth: ReturnType<typeof useAuth>, 
    refreshCalendar: () => void, 
    defaultCalendarId: string | null,
    calendarEvents: CalendarEvent[],
    contacts: Contact[],
    setEmailSearchResults: (emails: FullEmail[]) => void,
    setIsEmailSearchModalOpen: (isOpen: boolean) => void,
    setSelectedEmail: (email: FullEmail | null) => void,
    // FIX: Update parameter type to use the shared EmailData interface.
    setEmailToCompose: (email: EmailData | null) => void,
    setIsEmailComposerOpen: (isOpen: boolean) => void,
) => {
    const { setActiveFilter, clearFilter } = organizer;

    const [chatStatus, setChatStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [chatError, setChatError] = useState<string | null>(null);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [lastActionItem, setLastActionItem] = useState<{ id: string; trigger: number } | null>(null);
    const [itemToOpenDetailsFor, setItemToOpenDetailsFor] = useState<{ type: ListType, id: string, listId?: string } | null>(null);
    const [projectToNavigateTo, setProjectToNavigateTo] = useState<string | null>(null);
    const [pendingDuplicate, setPendingDuplicate] = useState<{ type: ListType, content: any, listId?: string } | null>(null);
    
    const latestSearchResultsRef = useRef<FullEmail[]>([]);

    const organizerRef = useRef(organizer);
    useEffect(() => {
        organizerRef.current = organizer;
    }, [organizer]);

    const defaultCalendarIdRef = useRef(defaultCalendarId);
    useEffect(() => {
        defaultCalendarIdRef.current = defaultCalendarId;
    }, [defaultCalendarId]);


    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const restartNeededAfterTurnRef = useRef(false);
    const [restartPending, setRestartPending] = useState(false);
    const isStoppingRef = useRef(false);
    
    const triggerHighlight = (id: string | undefined) => {
        if (id) {
            setLastActionItem({ id, trigger: Date.now() });
        }
    };

    const findBestMatchingTodo = useCallback((query: string): TodoItem | null => {
        const { todos } = organizerRef.current;
        if (todos.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: TodoItem | null = null;
        let minDistance = Infinity;
        for (const todo of todos) {
            const distance = levenshteinDistance(lowerQuery, todo.task.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = todo;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.task.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, []);

     const findBestMatchingNote = useCallback((query: string): NoteItem | null => {
        const { notes } = organizerRef.current;
        if (notes.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: NoteItem | null = null;
        let minDistance = Infinity;
        for (const note of notes) {
            const distance = levenshteinDistance(lowerQuery, note.content.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = note;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.content.length) * 0.7) {
            return bestMatch;
        }
        return null;
    }, []);
    
    const findBestMatchingShoppingItem = useCallback((query: string): ShoppingItem | null => {
        const { shoppingList } = organizerRef.current;
        if (shoppingList.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: ShoppingItem | null = null;
        let minDistance = Infinity;
        for (const item of shoppingList) {
            const distance = levenshteinDistance(lowerQuery, item.item.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = item;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.item.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, []);

    const findBestMatchingSubtask = useCallback((query: string, subtasks: SubtaskItem[]): SubtaskItem | null => {
        if (subtasks.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: SubtaskItem | null = null;
        let minDistance = Infinity;
        for (const subtask of subtasks) {
            const distance = levenshteinDistance(lowerQuery, subtask.text.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = subtask;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.text.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, []);

    const findBestMatchingList = useCallback((query: string): CustomList | null => {
        const { customLists } = organizerRef.current;
        if (customLists.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: CustomList | null = null;
        let minDistance = Infinity;

        for (const list of customLists) {
            const distance = levenshteinDistance(lowerQuery, list.title.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = list;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.title.length) * 0.5) {
            return bestMatch;
        }
        return null;
    }, []);

     const findBestMatchingCustomListItem = useCallback((list: CustomList, itemName: string): GenericItem | null => {
        if (!list || list.items.length === 0) return null;
        const lowerItemName = itemName.toLowerCase();
        let bestMatch: GenericItem | null = null;
        let minDistance = Infinity;
        for (const item of list.items) {
            const distance = levenshteinDistance(lowerItemName, item.text.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = item;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerItemName.length, bestMatch.text.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, []);

    const findBestMatchingItem = useCallback((query: string): { id: string, type: ListType, listId?: string, text: string } | null => {
        const { todos, shoppingList, notes, customLists } = organizerRef.current;
        const allItems = [
            ...todos.map(i => ({ id: i.id, type: 'todos' as ListType, text: i.task })),
            ...shoppingList.map(i => ({ id: i.id, type: 'shopping' as ListType, text: i.item })),
            ...notes.map(i => ({ id: i.id, type: 'notes' as ListType, text: i.content })),
            ...customLists.flatMap(l => l.items.map(i => ({ id: i.id, type: 'custom' as ListType, listId: l.id, text: i.text })))
        ];

        if (allItems.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: { id: string, type: ListType, listId?: string, text: string } | null = null;
        let minDistance = Infinity;

        for (const item of allItems) {
            const distance = levenshteinDistance(lowerQuery, item.text.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = item;
            }
        }
        
        if (bestMatch && minDistance < Math.max(lowerQuery.length, bestMatch.text.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, []);

    const findBestMatchingContact = useCallback((name: string): Contact | null => {
        if (contacts.length === 0) return null;
        const lowerName = name.toLowerCase();
        let bestMatch: Contact | null = null;
        let minDistance = Infinity;
        for (const contact of contacts) {
            const distance = levenshteinDistance(lowerName, contact.displayName.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = contact;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerName.length, bestMatch.displayName.length) * 0.6) {
            return bestMatch;
        }
        return null;
    }, [contacts]);

    const addCustomListItemByName = useCallback((listName: string, itemText: string): { message: string, itemId?: string } => {
        const list = findBestMatchingList(listName);
        if (!list) {
            return { message: `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".` };
        }
        const duplicate = organizerRef.current.findDuplicateForItem(itemText, 'custom', list.id);
        if (duplicate) {
            setPendingDuplicate({ type: 'custom', listId: list.id, content: { item: itemText } });
            return { message: `J'ai trouvé un élément similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?` };
        }
        const { newId, message } = organizerRef.current.addCustomListItem(list.id, itemText) || {};
        return { message: message || "Une erreur est survenue.", itemId: newId };
    }, [findBestMatchingList]);
    
    const toggleTodoByTaskName = useCallback((taskName: string): { message: string, itemId?: string } => {
        const todoToToggle = findBestMatchingTodo(taskName);
        if (todoToToggle) {
            const { message } = organizerRef.current.handleToggleTodo(todoToToggle.id) || {};
            return { message: message || "Action effectuée.", itemId: todoToToggle.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
    }, [findBestMatchingTodo]);

    const toggleShoppingItemByName = useCallback((itemName: string): { message: string, itemId?: string } => {
        const itemToToggle = findBestMatchingShoppingItem(itemName);
        if (itemToToggle) {
            const { message } = organizerRef.current.handleToggleShoppingItem(itemToToggle.id) || {};
            return { message: message || "Action effectuée.", itemId: itemToToggle.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'article ressemblant à "${itemName}" dans la liste de courses.` };
    }, [findBestMatchingShoppingItem]);
    
    const toggleCustomListItemByName = useCallback((listName: string, itemName: string): { message: string, itemId?: string } => {
        const listToUpdate = findBestMatchingList(listName);
        if (!listToUpdate) {
            return { message: `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".` };
        }
        const itemToToggle = findBestMatchingCustomListItem(listToUpdate, itemName);
        if (itemToToggle) {
            const { message } = organizerRef.current.toggleCustomListItem(listToUpdate.id, itemToToggle.id) || {};
            return { message: message || "Action effectuée.", itemId: itemToToggle.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'élément ressemblant à "${itemName}" dans la liste "${listToUpdate.title}".` };
    }, [findBestMatchingList, findBestMatchingCustomListItem]);

    const handleCreateCustomListForVoice = useCallback((title: string): string => {
        const { customLists } = organizerRef.current;
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return "Veuillez fournir un nom pour la liste.";
        }
        if (customLists.some(list => list.title.toLowerCase() === trimmedTitle.toLowerCase())) {
            return `Désolé, une liste nommée "${trimmedTitle}" existe déjà.`;
        }
        
        const { message } = organizerRef.current.addCustomList(trimmedTitle, []) || {};
        restartNeededAfterTurnRef.current = true;
        return message || `OK, j'ai créé la nouvelle liste : "${trimmedTitle}".`;
    }, []);
    
    const deleteTodoByTaskName = useCallback((taskName: string): string => {
        const todoToDelete = findBestMatchingTodo(taskName);
        if (todoToDelete) {
            const { message } = organizerRef.current.handleDeleteTodo(todoToDelete.id) || {};
            return message || "Tâche supprimée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".`;
    }, [findBestMatchingTodo]);

    const deleteShoppingItemByName = useCallback((itemName: string): string => {
        const itemToDelete = findBestMatchingShoppingItem(itemName);
        if (itemToDelete) {
            const { message } = organizerRef.current.handleDeleteShoppingItem(itemToDelete.id) || {};
            return message || "Article supprimé.";
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${itemName}".`;
    }, [findBestMatchingShoppingItem]);
    
    const deleteNoteByContent = useCallback((contentQuery: string): string => {
        const noteToDelete = findBestMatchingNote(contentQuery);
        if (noteToDelete) {
            const { message } = organizerRef.current.handleDeleteNote(noteToDelete.id) || {};
            return message || "Note supprimée.";
        }
        return `Désolé, je n'ai pas trouvé de note contenant "${contentQuery}".`;
    }, [findBestMatchingNote]);
    
    const deleteCustomListItemByName = useCallback((listName: string, itemName: string): string => {
        const listToUpdate = findBestMatchingList(listName);
        if (!listToUpdate) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".`;
        const itemToDelete = findBestMatchingCustomListItem(listToUpdate, itemName);
        if (itemToDelete) {
            const { message } = organizerRef.current.deleteCustomListItem(listToUpdate.id, itemToDelete.id) || {};
            return message || "Élément supprimé.";
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${itemName}" dans la liste "${listToUpdate.title}".`;
    }, [findBestMatchingList, findBestMatchingCustomListItem]);
    
    const editTodoByTaskName = useCallback((oldTaskName: string, newTaskName: string): { message: string, itemId?: string } => {
        const todoToEdit = findBestMatchingTodo(oldTaskName);
        if (todoToEdit) {
            const { message } = organizerRef.current.editTodo(todoToEdit.id, newTaskName) || {};
            return { message: message || "Tâche modifiée.", itemId: todoToEdit.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${oldTaskName}".` };
    }, [findBestMatchingTodo]);
    
    const editTodoPriorityByName = useCallback((taskName: string, newPriority: Priority): { message: string, itemId?: string } => {
        const todoToEdit = findBestMatchingTodo(taskName);
        if (todoToEdit) {
            const { message } = organizerRef.current.editTodoPriority(todoToEdit.id, newPriority) || {};
            return { message: message || "Priorité modifiée.", itemId: todoToEdit.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
    }, [findBestMatchingTodo]);
    
    const editShoppingItemByName = useCallback((oldItemName: string, newItemName: string): { message: string, itemId?: string } => {
        const itemToEdit = findBestMatchingShoppingItem(oldItemName);
        if (itemToEdit) {
            const { message } = organizerRef.current.editShoppingItem(itemToEdit.id, newItemName) || {};
            return { message: message || "Article modifié.", itemId: itemToEdit.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'article ressemblant à "${oldItemName}".` };
    }, [findBestMatchingShoppingItem]);

    const editCustomListItemByName = useCallback((listName: string, oldItemName: string, newItemName: string): { message: string, itemId?: string } => {
        const listToUpdate = findBestMatchingList(listName);
        if (!listToUpdate) return { message: `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".` };
        const itemToEdit = findBestMatchingCustomListItem(listToUpdate, oldItemName);
        if (itemToEdit) {
            const { message } = organizerRef.current.editCustomListItemDetails(listToUpdate.id, itemToEdit.id, { text: newItemName }) || {};
            return { message: message || "Élément modifié.", itemId: itemToEdit.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'élément ressemblant à "${oldItemName}" dans la liste "${listToUpdate.title}".` };
    }, [findBestMatchingList, findBestMatchingCustomListItem]);

    const showTaskDetails = useCallback((taskName: string): string => {
        const todoToShow = findBestMatchingTodo(taskName);
        if (todoToShow) {
            setItemToOpenDetailsFor({ type: 'todos', id: todoToShow.id });
            return `OK, j'affiche les détails de la tâche "${todoToShow.task}".`;
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".`;
    }, [findBestMatchingTodo]);

    const showNoteDetails = useCallback((contentQuery: string): string => {
        const noteToShow = findBestMatchingNote(contentQuery);
        if (noteToShow) {
            setItemToOpenDetailsFor({ type: 'notes', id: noteToShow.id });
            return `OK, j'affiche la note qui commence par "${noteToShow.content.slice(0, 30)}...".`;
        }
        return `Désolé, je n'ai pas trouvé de note contenant "${contentQuery}".`;
    }, [findBestMatchingNote]);
    
    const showShoppingItemDetails = useCallback((itemName: string): string => {
        const itemToShow = findBestMatchingShoppingItem(itemName);
        if (itemToShow) {
            setItemToOpenDetailsFor({ type: 'shopping', id: itemToShow.id });
            return `OK, j'affiche les détails pour "${itemToShow.item}".`;
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${itemName}".`;
    }, [findBestMatchingShoppingItem]);
    
    const showCustomListItemDetails = useCallback((listName: string, itemName: string): string => {
        const list = findBestMatchingList(listName);
        if (!list) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".`;
        const item = findBestMatchingCustomListItem(list, itemName);
        if (item) {
            setItemToOpenDetailsFor({ type: 'custom', id: item.id, listId: list.id });
            return `OK, j'affiche les détails de "${item.text}" dans la liste "${list.title}".`;
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${itemName}" dans la liste "${list.title}".`;
    }, [findBestMatchingList, findBestMatchingCustomListItem]);


    const addShoppingItemDetails = useCallback((itemName: string, quantity?: number, unit?: ShoppingUnit, store?: string, description?: string): { message: string, itemId?: string } => {
        const itemToUpdate = findBestMatchingShoppingItem(itemName);
        if (itemToUpdate) {
            const details: Partial<ShoppingItem> = {};
            if (quantity) details.quantity = quantity;
            if (unit) details.unit = unit;
            if (store) details.store = store;
            if (description) details.description = description;
            const { message } = organizerRef.current.editShoppingItemDetails(itemToUpdate.id, details) || {};
            return { message: message || "Détails mis à jour.", itemId: itemToUpdate.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'article ressemblant à "${itemName}".` };
    }, [findBestMatchingShoppingItem]);

    const addTodoDescription = useCallback((taskName: string, description: string): { message: string, itemId?: string } => {
        const todoToUpdate = findBestMatchingTodo(taskName);
        if (todoToUpdate) {
            const { message } = organizerRef.current.editTodoDescription(todoToUpdate.id, description) || {};
            return { message: message || "Description ajoutée.", itemId: todoToUpdate.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
    }, [findBestMatchingTodo]);
    
    const addCustomListItemDescription = useCallback((listName: string, itemName: string, description: string): { message: string, itemId?: string } => {
        const list = findBestMatchingList(listName);
        if (!list) return { message: `Désolé, je n'ai pas trouvé de liste ressemblant à "${listName}".` };
        const item = findBestMatchingCustomListItem(list, itemName);
        if (item) {
            const { message } = organizerRef.current.editCustomListItemDetails(list.id, item.id, { description }) || {};
            return { message: message || "Description ajoutée.", itemId: item.id };
        }
        return { message: `Désolé, je n'ai pas trouvé d'élément ressemblant à "${itemName}" dans la liste "${list.title}".` };
    }, [findBestMatchingList, findBestMatchingCustomListItem]);


    const addTodoSubtaskByVoice = useCallback((taskName: string, subtaskText: string): { message: string, itemId?: string } => {
        const todoToUpdate = findBestMatchingTodo(taskName);
        if (todoToUpdate) {
            const { message } = organizerRef.current.addTodoSubtask(todoToUpdate.id, subtaskText) || {};
            return { message: message || "Sous-tâche ajoutée.", itemId: todoToUpdate.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
    }, [findBestMatchingTodo]);
    
    const toggleTodoSubtaskByVoice = useCallback((taskName: string, subtaskName: string): { message: string, itemId?: string } => {
        const todoToUpdate = findBestMatchingTodo(taskName);
        if (!todoToUpdate) {
            return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
        }
        const subtaskToToggle = findBestMatchingSubtask(subtaskName, todoToUpdate.subtasks);
        if (subtaskToToggle) {
            const { message } = organizerRef.current.toggleTodoSubtask(todoToUpdate.id, subtaskToToggle.id) || {};
            return { message: message || "Sous-tâche mise à jour.", itemId: todoToUpdate.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de sous-tâche ressemblant à "${subtaskName}" dans "${todoToUpdate.task}".` };
    }, [findBestMatchingTodo, findBestMatchingSubtask]);

    const setTodoDueDateByName = useCallback((taskName: string, dueDate: string): { message: string, itemId?: string } => {
        const todoToUpdate = findBestMatchingTodo(taskName);
        if (todoToUpdate) {
            const { message } = organizerRef.current.editTodoDueDate(todoToUpdate.id, dueDate) || {};
            return { message: message || "Date limite définie.", itemId: todoToUpdate.id };
        }
        return { message: `Désolé, je n'ai pas trouvé de tâche ressemblant à "${taskName}".` };
    }, [findBestMatchingTodo]);

    const sortTodoList = useCallback((critere: 'priorité' | 'date' | 'alphabétique'): string => {
        const sortOrderMapping: { [key in typeof critere]: TodoSortOrder } = {
            'priorité': 'priority',
            'date': 'dueDate',
            'alphabétique': 'alphabetical'
        };
        const sortOrder = sortOrderMapping[critere];
        if (sortOrder) {
            const { message } = organizerRef.current.setTodoSortOrder(sortOrder) || {};
            return message || `OK, je trie les tâches par ${critere}.`;
        }
        return `Désolé, je ne peux pas trier par "${critere}".`;
    }, []);
    
    const deleteCompletedItemsFromList = useCallback((listName: string): string => {
        const lowerListName = listName.toLowerCase();
        
        if (['tâches', 'tache', 'todo', 'todos'].some(alias => lowerListName.includes(alias))) {
            const { message } = organizerRef.current.deleteCompletedTodos() || {};
            return message || "Tâches terminées supprimées.";
        }
        
        if (['courses', 'shopping'].some(alias => lowerListName.includes(alias))) {
            const { message } = organizerRef.current.deleteCompletedShoppingItems() || {};
            return message || "Articles de courses supprimés.";
        }
        
        const list = findBestMatchingList(listName);
        if (list) {
            const { message } = organizerRef.current.deleteCompletedCustomListItems(list.id) || {};
            return message || `Éléments complétés supprimés de "${list.title}".`;
        }
        
        return `Désolé, je n'ai pas trouvé de liste nommée "${listName}".`;
    }, [findBestMatchingList]);

    const handleFilterList = async (listName: string, criteria: string): Promise<string> => {
        const { todos, shoppingList, customLists } = organizerRef.current;
        const lowerListName = listName.toLowerCase();
        const lowerCriteria = criteria.toLowerCase();
        let matchingIds: string[] = [];
        let targetList: any[] = [];
        let listType: FilterState['listType'] | null = null;
        let listId: string | undefined = undefined;
        let itemTextProp = 'task';

        if (['tâches', 'tache', 'todo', 'todos'].some(alias => lowerListName.includes(alias))) {
            listType = 'todos';
            targetList = todos;
        } else if (['courses', 'shopping'].some(alias => lowerListName.includes(alias))) {
            listType = 'shopping';
            targetList = shoppingList;
            itemTextProp = 'item';
        } else {
            const list = findBestMatchingList(listName);
            if (list) {
                listType = 'custom';
                listId = list.id;
                targetList = list.items;
                itemTextProp = 'text';
            } else {
                return `Désolé, je n'ai pas trouvé de liste nommée "${listName}".`;
            }
        }

        const priorityMatch = lowerCriteria.match(/priorité (haute|élevée|moyenne|basse|high|medium|low)/);
        const keywordMatch = lowerCriteria.match(/cont(?:enant|ient) le mot ['"](.+?)['"]/);

        if (listType === 'todos' && priorityMatch) {
            const priorityMap = { haute: 'high', élevée: 'high', high: 'high', moyenne: 'medium', medium: 'medium', basse: 'low', low: 'low' };
            const targetPriority = priorityMap[priorityMatch[1] as keyof typeof priorityMap];
            if (targetPriority) {
                matchingIds = (targetList as TodoItem[]).filter(item => item.priority === targetPriority).map(item => item.id);
            }
        } else if (keywordMatch) {
            const keyword = keywordMatch[1].toLowerCase();
            matchingIds = targetList.filter(item => (item[itemTextProp] as string).toLowerCase().includes(keyword)).map(item => item.id);
        } else {
            const itemsToFilter = targetList.map(item => ({ id: item.id, text: item[itemTextProp] }));
            matchingIds = await filterListWithAI(itemsToFilter, criteria);
        }

        setActiveFilter({
            listType,
            listId,
            criteria,
            itemIds: new Set(matchingIds)
        });
        
        return `OK, je filtre la liste "${listName}" pour afficher les éléments correspondant à "${criteria}".`;
    };

    const handleCancelFilter = (): string => {
        clearFilter();
        return "OK, j'ai annulé le filtre.";
    };
    
    const handleCheckForCalendarConflicts = async (startTime: string, endTime: string): Promise<string> => {
        if (!auth.accessToken) return "Désolé, vous devez être connecté à Google pour vérifier l'agenda.";
        const calendarId = defaultCalendarIdRef.current || 'primary';
        try {
            const conflictingEvents = await googleCalendarService.listEventsForTimeRange(auth.accessToken, startTime, endTime, calendarId);
            if (conflictingEvents.length > 0) {
                const eventTitles = conflictingEvents.map(e => `"${e.summary}"`).join(', ');
                return `Oui, il y a un conflit. Vous avez déjà les événements suivants : ${eventTitles}.`;
            }
            return "Non, ce créneau est libre.";
        } catch (error) {
            console.error("Error checking calendar conflicts:", error);
            return "Désolé, une erreur est survenue en vérifiant votre agenda.";
        }
    };

    const handleCreateCalendarEvent = async (summary: string, startTime: string, endTime: string): Promise<string> => {
        if (!auth.accessToken) return "Désolé, vous devez être connecté à Google pour créer un événement.";
        const calendarId = defaultCalendarIdRef.current || 'primary';
        try {
            await googleCalendarService.createEvent(auth.accessToken, calendarId, {
                summary,
                start: { dateTime: startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                end: { dateTime: endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            });
            refreshCalendar();
            return `OK, j'ai ajouté l'événement "${summary}" à votre agenda.`;
        } catch (error) {
            console.error("Error creating calendar event:", error);
            return "Désolé, une erreur est survenue lors de la création de l'événement.";
        }
    };

    const resolveEmailIdentifier = (identifier: string): FullEmail | null => {
        const results = latestSearchResultsRef.current;
        if (!results || results.length === 0) return null;

        const lowerIdentifier = identifier.toLowerCase();
        
        // Check for ordinal numbers
        const ordinals: { [key: string]: number } = { 'premier': 0, 'deuxième': 1, 'troisième': 2 };
        if (lowerIdentifier in ordinals) {
            return results[ordinals[lowerIdentifier]];
        }
        
        // Fuzzy match against sender and subject
        let bestMatch: FullEmail | null = null;
        let minDistance = Infinity;

        for (const email of results) {
            const fromDistance = levenshteinDistance(lowerIdentifier, email.from.toLowerCase());
            const subjectDistance = levenshteinDistance(lowerIdentifier, email.subject.toLowerCase());
            const distance = Math.min(fromDistance, subjectDistance);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = email;
            }
        }
        
        return bestMatch;
    };

    // --- GMAIL HANDLERS ---
    const handleSearchEmails = async (requete: string): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter à Google pour utiliser les fonctions de messagerie.";
        try {
            const results = await googleMailService.searchEmails(auth.accessToken, requete);
            latestSearchResultsRef.current = results;
            setEmailSearchResults(results);
            setIsEmailSearchModalOpen(true);
            if (results.length === 0) {
                return "Je n'ai trouvé aucun e-mail correspondant à votre recherche.";
            }
            return `J'ai trouvé ${results.length} e-mail(s) et les ai affichés à l'écran. Lequel souhaitez-vous que je lise ?`;
        } catch (error) {
            console.error("Email search error:", error);
            return "Désolé, une erreur est survenue lors de la recherche de vos e-mails.";
        }
    };

    const handleReadEmail = async (identifiantEmail: string): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter à Google pour lire des e-mails.";
        const emailToRead = resolveEmailIdentifier(identifiantEmail);
        if (!emailToRead) {
            return "Désolé, je n'ai pas pu identifier l'e-mail que vous voulez lire à partir des résultats de recherche.";
        }
        try {
            const fullEmail = await googleMailService.getEmail(auth.accessToken, emailToRead.id);
            setSelectedEmail(fullEmail);
            return `Voici l'e-mail de ${fullEmail.from} avec pour sujet "${fullEmail.subject}". ${fullEmail.body}`;
        } catch (error) {
            return "Désolé, je n'ai pas pu récupérer le contenu de cet e-mail.";
        }
    };

    const handleAddEmailToNotes = async (identifiantEmail: string): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter pour utiliser cette fonction.";
        const emailToAdd = resolveEmailIdentifier(identifiantEmail);
        if (!emailToAdd) {
            return "Désolé, je n'ai pas pu identifier l'e-mail que vous voulez ajouter aux notes.";
        }
        try {
            const fullEmail = await googleMailService.getEmail(auth.accessToken, emailToAdd.id);
            const noteContent = `<h3>De : ${fullEmail.from}</h3><h4>Sujet : ${fullEmail.subject}</h4><hr/><p>${fullEmail.body.replace(/\n/g, '<br/>')}</p>`;
            const { newId, message } = organizerRef.current.addNote(noteContent) || {};
            triggerHighlight(newId);
            return message ? `OK, la note a été créée.` : "Une erreur est survenue lors de la création de la note.";
        } catch (error) {
            return "Désolé, je n'ai pas pu récupérer le contenu de cet e-mail pour l'ajouter aux notes.";
        }
    };


    const cleanupLocalResources = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(e => console.warn("Input AudioContext close error:", e));
        outputAudioContextRef.current?.close().catch(e => console.warn("Output AudioContext close error:", e));
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextAudioStartTimeRef.current = 0;

        sessionPromiseRef.current = null;
        streamRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;

        setChatStatus('idle');
        setIsAiSpeaking(false);
    }, []);

    const stopChatSession = useCallback(async () => {
        if (isStoppingRef.current) return;
        
        if (!sessionPromiseRef.current) {
            cleanupLocalResources();
            return;
        }

        isStoppingRef.current = true;
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) { 
            console.error("Error closing session, forcing cleanup", e);
            cleanupLocalResources();
        } finally {
            isStoppingRef.current = false;
        }
    }, [cleanupLocalResources]);

    const startChatSession = useCallback(async () => {
        if (!auth.isLoggedIn) {
            auth.signIn();
            setChatError("Veuillez vous connecter pour utiliser l'assistant vocal avec l'agenda et Gmail.");
            setChatStatus('error');
            return;
        }
        
        setChatStatus('connecting');
        setChatError(null);
        setPendingDuplicate(null);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;

            const { projects, todos, shoppingList, notes, customLists } = organizerRef.current;

            let currentProjectContext = '';
            if (currentProjectId) {
                const currentProject = projects.find(p => p.id === currentProjectId);
                if (currentProject) {
                    currentProjectContext = `\n\nCONTEXTE IMPORTANT: L'utilisateur consulte actuellement le projet "${currentProject.title}". Les commandes sans nom de projet spécifique (comme "lier cette note") doivent s'appliquer à ce projet.`;
                }
            }

            const baseInstruction = `Tu es un assistant vocal pour une application d'organisation personnelle. Interagis en français. Tu as accès à l'agenda Google et à la messagerie Gmail de l'utilisateur.

**RÈGLE ABSOLUE POUR LES ÉVÉNEMENTS D'AGENDA :**
1.  Quand l'utilisateur demande de créer un événement, tu dois **TOUJOURS** d'abord utiliser l'outil \`checkForCalendarConflicts\`.
2.  Si l'outil renvoie un conflit, tu dois **OBLIGATOIREMENT** en informer l'utilisateur (ex: "Il semble que vous ayez déjà 'Réunion' à ce moment-là.") et lui demander s'il veut créer l'événement quand même ou le déplacer.
3.  N'utilise l'outil \`createCalendarEvent\` que si le créneau est libre ou si l'utilisateur a explicitement confirmé vouloir superposer l'événement.

**PROACTIVITÉ DE LIAISON DE PROJET :**
Quand l'utilisateur demande d'ajouter un nouvel élément (tâche, article, note), tu DOIS d'abord analyser son contenu et le comparer à la liste des projets existants. Si le contenu est clairement lié à un projet, tu NE DOIS PAS l'ajouter directement. À la place, tu DOIS poser la question : "Cela semble faire partie de votre projet '[Nom du Projet]'. Voulez-vous que je l'y associe ?".
- Si l'utilisateur répond OUI, tu DOIS utiliser l'outil \`ajouterEtLierElementAProjet\`.
- Si l'utilisateur répond NON, tu DOIS utiliser l'outil d'ajout normal (ex: \`ajouterTache\`).

**FORMATAGE DES NOTES :**
Quand tu crées ou modifies des notes, utilise le formatage HTML (par exemple <ul>, <li>, <b>, <table>) pour les listes, le texte en gras, les tableaux, etc., lorsque c'est pertinent. Lorsque tu crées un tableau, assure-toi de remplir les cellules <td> avec le texte correspondant.

Voici les données actuelles de l'utilisateur :

### Agenda des 30 prochains jours:
${formatCalendarEventsForAI(calendarEvents)}

### Contacts:
${formatContactsForAI(contacts)}

### Projets:
${projects.length > 0 ? projects.map(p => `- ${p.title}`).join('\n') : 'Aucun projet.'}

### Tâches à faire:
${formatTodosForAI(todos)}

### Liste de courses:
${formatShoppingForAI(shoppingList)}

### Notes:
${formatNotesForAI(notes)}

${customLists.length > 0 ? `### Listes personnalisées:\n${formatCustomListsForAI(customLists)}` : ''}
${currentProjectContext}

Engage une conversation naturelle. Réponds aux questions sur les listes et l'agenda. Lorsque l'utilisateur demande de créer, ajouter, cocher, modifier, déplacer, filtrer ou supprimer des éléments, tu DOIS utiliser les outils fournis. Après avoir reçu le résultat d'un appel de fonction, confirme verbalement cette action à l'utilisateur de manière claire.`;
            
            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);

            const functionDeclarations = baseFunctionDeclarations;

            const speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            };

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    tools: [{ functionDeclarations }], 
                    systemInstruction,
                    speechConfig 
                },
                callbacks: {
                    onopen: () => {
                        setChatStatus('listening');
                        sessionPromiseRef.current?.then((session) => {
                            const greeting = `Bonjour ${voiceSettings.userName || ''}! Je suis prêt à vous aider à organiser vos tâches, vos courses, et vos notes. Que voulez-vous faire ?`;
                            session.sendRealtimeInput({ text: greeting });
                        });
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result = 'Une erreur est survenue.';
                                try {
                                    let actionResult: { message: string; itemId?: string; };
                                    switch (fc.name) {
                                        case 'annulerDerniereAction':
                                            result = organizerRef.current.undoLastAction() || "Il n'y a aucune action à annuler.";
                                            break;
                                        // --- Gmail ---
                                        case 'rechercherEmails':
                                            result = await handleSearchEmails(fc.args.requete as string);
                                            break;
                                        case 'lireEmail':
                                            result = await handleReadEmail(fc.args.identifiantEmail as string);
                                            break;
                                        case 'envoyerEmail': {
                                            // AI-FIX-LOCKED: The logic below correctly handles resolving multiple recipients (to, cc, bcc) from contact names to email addresses and is considered robust. Do not try to fix it !
                                            const { destinataire, sujet, corps, cc, bcc } = fc.args as { destinataire: string, sujet: string, corps: string, cc?: string, bcc?: string };

                                            const resolveAndJoin = (recipients: string | undefined): { value: string; error?: string } => {
                                                if (!recipients) return { value: '' };
                                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                                const parts = recipients.split(/[,;]/).map(r => r.trim()).filter(Boolean);
                                                const resolvedEmails: string[] = [];
                                                for (const part of parts) {
                                                    if (emailRegex.test(part)) {
                                                        resolvedEmails.push(part);
                                                        continue;
                                                    }
                                                    const contact = findBestMatchingContact(part);
                                                    if (contact) {
                                                        resolvedEmails.push(contact.email);
                                                    } else {
                                                        return { value: '', error: `Désolé, je n'ai pas trouvé de contact ou d'e-mail valide pour "${part}".` };
                                                    }
                                                }
                                                return { value: resolvedEmails.join(', ') };
                                            };

                                            const toResult = resolveAndJoin(destinataire);
                                            if (toResult.error) { result = toResult.error; break; }
                                            if (!toResult.value) { result = 'Destinataire manquant.'; break; }
                                            
                                            const ccResult = resolveAndJoin(cc);
                                            if (ccResult.error) { result = ccResult.error; break; }
                                            
                                            const bccResult = resolveAndJoin(bcc);
                                            if (bccResult.error) { result = bccResult.error; break; }
                                            
                                            // FIX: The error "Expected 4 arguments, but got 3" is misleading.
                                            // This case is inlined to match the implementation in useVideoChat.ts and avoid a potential closure or type issue with the helper function.
                                            if (!auth.accessToken) {
                                                result = "Veuillez vous connecter à Google pour envoyer des e-mails.";
                                            } else {
                                                setEmailToCompose({ to: toResult.value, subject: sujet, body: corps, cc: ccResult.value, bcc: bccResult.value });
                                                setIsEmailComposerOpen(true);
                                                result = "J'ai préparé le brouillon pour vous. Vous pouvez le vérifier et l'envoyer.";
                                            }
                                            break;
                                        }
                                        case 'ajouterContenuEmailAuxNotes':
                                            result = await handleAddEmailToNotes(fc.args.identifiantEmail as string);
                                            break;
                                        // --- Calendar ---
                                        case 'checkForCalendarConflicts':
                                            result = await handleCheckForCalendarConflicts(fc.args.startTime as string, fc.args.endTime as string);
                                            break;
                                        case 'createCalendarEvent':
                                            result = await handleCreateCalendarEvent(fc.args.summary as string, fc.args.startTime as string, fc.args.endTime as string);
                                            break;
                                        case 'modifyCalendarEvent':
                                            result = "La modification d'événements n'est pas encore entièrement prise en charge. Veuillez supprimer et recréer l'événement.";
                                            break;
                                        // --- Existing ---
                                        case 'ajouterEtLierElementAProjet': {
                                            const { nomProjet, typeElement, contenu, priorite, nomListePersonnalisee } = fc.args as {
                                                nomProjet: string;
                                                typeElement: 'tache' | 'course' | 'note' | 'elementPersonnalise';
                                                contenu: string;
                                                priorite?: Priority;
                                                nomListePersonnalisee?: string;
                                            };
                                        
                                            const project = organizerRef.current.findProjectByName(nomProjet);
                                            if (!project) {
                                                result = `Désolé, je n'ai pas pu trouver le projet "${nomProjet}".`;
                                                break;
                                            }
                                        
                                            let newId: string | undefined;
                                            let itemTypeForLink: ListType | undefined;
                                            let confirmationText = '';
                                        
                                            if (typeElement === 'tache') {
                                                newId = organizerRef.current.addTodo(contenu, priorite || Priority.Medium)?.newId;
                                                itemTypeForLink = 'todos';
                                                confirmationText = `la tâche "${contenu}"`;
                                            } else if (typeElement === 'course') {
                                                newId = organizerRef.current.addShoppingItem(contenu)?.newId;
                                                itemTypeForLink = 'shopping';
                                                confirmationText = `l'article "${contenu}"`;
                                            } else if (typeElement === 'note') {
                                                newId = organizerRef.current.addNote(contenu)?.newId;
                                                itemTypeForLink = 'notes';
                                                confirmationText = `la note`;
                                            } else if (typeElement === 'elementPersonnalise' && nomListePersonnalisee) {
                                                const list = findBestMatchingList(nomListePersonnalisee);
                                                if (list) {
                                                    newId = organizerRef.current.addCustomListItem(list.id, contenu)?.newId;
                                                    itemTypeForLink = 'custom';
                                                    confirmationText = `l'élément "${contenu}" dans la liste "${list.title}"`;
                                                } else {
                                                    result = `Je n'ai pas trouvé la liste personnalisée "${nomListePersonnalisee}", donc je n'ai pas pu ajouter l'élément.`;
                                                    break;
                                                }
                                            }
                                        
                                            if (newId && itemTypeForLink) {
                                                organizerRef.current.linkItemToProject(project.id, itemTypeForLink, newId);
                                                triggerHighlight(newId);
                                                result = `Parfait, j'ai ajouté ${confirmationText} et je l'ai lié au projet "${project.title}".`;
                                            } else if (!result) { 
                                                result = "Désolé, une erreur s'est produite lors de la création de l'élément.";
                                            }
                                            break;
                                        }
                                        case 'confirmerAjoutElementDuplique':
                                            if (pendingDuplicate) {
                                                const { type, content, listId } = pendingDuplicate;
                                                let newId;
                                                if (type === 'todos') newId = organizerRef.current.addTodo(content.task, content.priority)?.newId;
                                                else if (type === 'shopping') newId = organizerRef.current.addShoppingItem(content.item)?.newId;
                                                else if (type === 'custom' && listId) newId = organizerRef.current.addCustomListItem(listId, content.item)?.newId;
                                                triggerHighlight(newId);
                                                result = "OK, je l'ai ajouté quand même.";
                                                setPendingDuplicate(null);
                                            } else {
                                                result = "Il n'y avait rien à confirmer.";
                                            }
                                            break;
                                        case 'annulerAjoutElementDuplique':
                                            setPendingDuplicate(null);
                                            result = "D'accord, j'annule l'ajout.";
                                            break;
                                        case 'creerProjet':
                                            organizerRef.current.addProject(fc.args.titre as string, fc.args.description as string || '');
                                            restartNeededAfterTurnRef.current = true;
                                            result = `OK, j'ai créé le projet "${fc.args.titre}".`;
                                            break;
                                        case 'supprimerProjet':
                                            const projectToDelete = organizerRef.current.findProjectByName(fc.args.nomProjet as string);
                                            if (projectToDelete) {
                                                organizerRef.current.deleteProject(projectToDelete.id);
                                                restartNeededAfterTurnRef.current = true;
                                                result = `OK, j'ai supprimé le projet "${projectToDelete.title}".`;
                                            } else {
                                                result = `Désolé, je n'ai pas trouvé de projet nommé "${fc.args.nomProjet}".`;
                                            }
                                            break;
                                        case 'afficherDetailsProjet':
                                            const projectToShow = organizerRef.current.findProjectByName(fc.args.nomProjet as string);
                                            if (projectToShow) {
                                                setProjectToNavigateTo(projectToShow.id);
                                                result = `OK, j'affiche le projet "${projectToShow.title}".`;
                                            } else {
                                                result = `Désolé, je n'ai pas trouvé de projet nommé "${fc.args.nomProjet}".`;
                                            }
                                            break;
                                        case 'lierElementAProjet':
                                            const { nomElement, nomProjet } = fc.args as { nomElement: string, nomProjet?: string };
                                            const targetProject = nomProjet ? organizerRef.current.findProjectByName(nomProjet) : (currentProjectId ? organizerRef.current.projects.find(p => p.id === currentProjectId) : null);
                                            if (!targetProject) {
                                                result = nomProjet ? `Désolé, je n'ai pas trouvé le projet "${nomProjet}".` : "Veuillez spécifier un projet ou naviguer vers un projet pour lier cet élément.";
                                                break;
                                            }
                                            const itemToLink = findBestMatchingItem(nomElement);
                                            if (!itemToLink) {
                                                result = `Désolé, je n'ai pas trouvé d'élément ressemblant à "${nomElement}".`;
                                                break;
                                            }
                                            organizerRef.current.linkItemToProject(targetProject.id, itemToLink.type, itemToLink.id);
                                            triggerHighlight(itemToLink.id);
                                            result = `OK, j'ai lié "${itemToLink.text}" au projet "${targetProject.title}".`;
                                            break;
                                        case 'delierElementDeProjet':
                                            const itemToUnlink = findBestMatchingItem(fc.args.nomElement as string);
                                            if (!itemToUnlink) {
                                                result = `Désolé, je n'ai pas trouvé d'élément ressemblant à "${fc.args.nomElement}".`;
                                                break;
                                            }
                                            organizerRef.current.unlinkItemFromProject(itemToUnlink.type, itemToUnlink.id);
                                            triggerHighlight(itemToUnlink.id);
                                            result = `OK, j'ai délié "${itemToUnlink.text}" de son projet.`;
                                            break;
                                        case 'filtrerListe':
                                            result = await handleFilterList(fc.args.nomListe as string, fc.args.critereFiltre as string);
                                            break;
                                        case 'annulerFiltre':
                                            result = handleCancelFilter();
                                            break;
                                        case 'supprimerElementsCoches':
                                            result = deleteCompletedItemsFromList(fc.args.nomListe as string);
                                            break;
                                        case 'trierTaches':
                                            result = sortTodoList(fc.args.critere as 'priorité' | 'date' | 'alphabétique');
                                            break;
                                        case 'definirDateLimiteTache':
                                            actionResult = setTodoDueDateByName(fc.args.taskName as string, fc.args.dueDate as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message;
                                            break;
                                        case 'afficherDetailsTache':
                                            result = showTaskDetails(fc.args.taskName as string);
                                            break;
                                        case 'afficherDetailsNote':
                                            result = showNoteDetails(fc.args.contentQuery as string);
                                            break;
                                        case 'afficherDetailsArticleCourse':
                                            result = showShoppingItemDetails(fc.args.itemName as string);
                                            break;
                                        case 'afficherDetailsElementListePersonnalisee':
                                            result = showCustomListItemDetails(fc.args.nomListe as string, fc.args.elementName as string);
                                            break;
                                        case 'ajouterDetailsArticleCourse':
                                            actionResult = addShoppingItemDetails(
                                                fc.args.itemName as string,
                                                fc.args.quantity as number | undefined,
                                                fc.args.unit as ShoppingUnit | undefined,
                                                fc.args.store as string | undefined,
                                                fc.args.description as string | undefined
                                            );
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message;
                                            break;
                                        case 'ajouterDescriptionTache':
                                            actionResult = addTodoDescription(fc.args.taskName as string, fc.args.description as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message;
                                            break;
                                        case 'ajouterDescriptionElementListePersonnalisee':
                                            actionResult = addCustomListItemDescription(fc.args.nomListe as string, fc.args.elementName as string, fc.args.description as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message;
                                            break;
                                        case 'ajouterSousTache':
                                            actionResult = addTodoSubtaskByVoice(fc.args.taskName as string, fc.args.subtaskText as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message;
                                            break;
                                        case 'basculerEtatSousTache':
                                            actionResult = toggleTodoSubtaskByVoice(fc.args.taskName as string, fc.args.subtaskName as string);
                                            triggerHighlight(actionResult.itemId);
                                            // AI-FIX-LOCKED: Correct. `actionResult` is an object, we need its `message` property for the string `result`. Do not try to fix it !
                                            result = actionResult.message;
                                            break;
                                        case 'ajouterTache': {
                                            const task = fc.args.task as string;
                                            const priority = (fc.args.priority as Priority) || Priority.Medium;
                                            const duplicate = organizerRef.current.findDuplicateForItem(task, 'todos');
                                            if (duplicate) {
                                                setPendingDuplicate({ type: 'todos', content: { task, priority } });
                                                result = `J'ai trouvé une tâche similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?`;
                                            } else {
                                                const { newId, message } = organizerRef.current.addTodo(task, priority) || {};
                                                triggerHighlight(newId);
                                                result = message || `OK, j'ai ajouté la tâche "${task}".`;
                                            }
                                            break;
                                        }
                                        case 'ajouterArticleCourse': {
                                            const item = fc.args.item as string;
                                            const duplicate = organizerRef.current.findDuplicateForItem(item, 'shopping');
                                            if (duplicate) {
                                                setPendingDuplicate({ type: 'shopping', content: { item } });
                                                result = `J'ai trouvé un article similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?`;
                                            } else {
                                                const { newId, message } = organizerRef.current.addShoppingItem(item) || {};
                                                triggerHighlight(newId);
                                                result = message || `OK, j'ai ajouté "${item}" à la liste de courses.`;
                                            }
                                            break;
                                        }
                                        case 'ajouterNote':
                                            const { newId, message } = organizerRef.current.addNote(fc.args.content as string) || {};
                                            triggerHighlight(newId);
                                            result = message || `OK, j'ai ajouté la note.`; break;
                                        case 'basculerEtatTache':
                                            actionResult = toggleTodoByTaskName(fc.args.taskName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'basculerEtatArticleCourse':
                                            actionResult = toggleShoppingItemByName(fc.args.itemName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'creerListePersonnalisee':
                                            result = handleCreateCustomListForVoice(fc.args.titre as string); break;
                                        case 'ajouterElementListePersonnalisee':
                                            actionResult = addCustomListItemByName(fc.args.nomListe as string, fc.args.element as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'basculerEtatElementListePersonnalisee':
                                            actionResult = toggleCustomListItemByName(fc.args.nomListe as string, fc.args.elementName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'supprimerTache':
                                            result = deleteTodoByTaskName(fc.args.taskName as string); break;
                                        case 'supprimerArticleCourse':
                                            result = deleteShoppingItemByName(fc.args.itemName as string); break;
                                        case 'supprimerNote':
                                            result = deleteNoteByContent(fc.args.contentQuery as string); break;
                                        case 'modifierNote': {
                                            const { noteIdentifier, nouveauContenu } = fc.args as { noteIdentifier: string, nouveauContenu: string };
                                            const noteToEdit = findBestMatchingNote(noteIdentifier);
                                            if (noteToEdit) {
                                                organizerRef.current.editNote(noteToEdit.id, nouveauContenu);
                                                triggerHighlight(noteToEdit.id);
                                                result = `OK, j'ai mis à jour la note.`;
                                            } else {
                                                result = `Désolé, je n'ai pas trouvé de note correspondant à "${noteIdentifier}".`;
                                            }
                                            break;
                                        }
                                        case 'supprimerElementListePersonnalisee':
                                            result = deleteCustomListItemByName(fc.args.nomListe as string, fc.args.elementName as string); break;
                                        case 'modifierTache':
                                            actionResult = editTodoByTaskName(fc.args.oldTaskName as string, fc.args.newTaskName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'modifierPrioriteTache':
                                            actionResult = editTodoPriorityByName(fc.args.taskName as string, fc.args.newPriority as Priority);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'modifierArticleCourse':
                                            actionResult = editShoppingItemByName(fc.args.oldItemName as string, fc.args.newItemName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'modifierElementListePersonnalisee':
                                            actionResult = editCustomListItemByName(fc.args.nomListe as string, fc.args.oldElementName as string, fc.args.newElementName as string);
                                            triggerHighlight(actionResult.itemId);
                                            result = actionResult.message; break;
                                        case 'deplacerElement':
                                            const moveResult = organizerRef.current.moveItemByNameAndList(fc.args.elementName as string, fc.args.sourceListName as string, fc.args.destListName as string);
                                            if (moveResult.success) {
                                                triggerHighlight(moveResult.itemId);
                                            }
                                            result = moveResult.message;
                                            break;
                                        default:
                                            result = `Fonction ${fc.name} non implémentée.`;
                                    }
                                } catch (e) { result = "Erreur lors du traitement."; }
                                sessionPromiseRef.current?.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                            }
                        }

                        const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                            for (const source of audioSourcesRef.current.values()) {
                                source.stop();
                            }
                            audioSourcesRef.current.clear();
                            nextAudioStartTimeRef.current = 0;
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputCtx) {
                            setIsAiSpeaking(true);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            const startTime = Math.max(outputCtx.currentTime, nextAudioStartTimeRef.current);
                            source.start(startTime);
                            nextAudioStartTimeRef.current = startTime + audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                            source.onended = () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                    setIsAiSpeaking(false);
                                }
                            };
                        }

                        if (message.serverContent?.turnComplete) {
                            if (restartNeededAfterTurnRef.current) {
                                restartNeededAfterTurnRef.current = false;
                                setRestartPending(true);
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setChatStatus('error');
                        setChatError('Erreur de connexion. Veuillez réessayer.');
                        console.error('Live session error:', e);
                    },
                    onclose: () => {
                        cleanupLocalResources();
                    },
                }
            });
            await sessionPromiseRef.current;
        } catch (err) {
            console.error('Failed to start conversation:', err);
            setChatError('Erreur: Impossible d\'accéder au microphone.');
            setChatStatus('error');
        }
    }, [
        auth, currentProjectId, voiceSettings, cleanupLocalResources, refreshCalendar, calendarEvents, contacts,
        setActiveFilter, clearFilter,
        findBestMatchingTodo, findBestMatchingNote, findBestMatchingShoppingItem, findBestMatchingSubtask, findBestMatchingList,
        findBestMatchingCustomListItem, findBestMatchingItem, findBestMatchingContact, addCustomListItemByName, toggleTodoByTaskName, toggleShoppingItemByName,
        toggleCustomListItemByName, handleCreateCustomListForVoice, deleteTodoByTaskName, deleteShoppingItemByName, deleteNoteByContent,
        deleteCustomListItemByName, editTodoByTaskName, editTodoPriorityByName, editShoppingItemByName, editCustomListItemByName,
        showTaskDetails, showNoteDetails, showShoppingItemDetails, showCustomListItemDetails, addShoppingItemDetails, addTodoDescription,
        addCustomListItemDescription, addTodoSubtaskByVoice, toggleTodoSubtaskByVoice, setTodoDueDateByName, sortTodoList,
        deleteCompletedItemsFromList, handleFilterList, handleCancelFilter, setEmailSearchResults, setIsEmailSearchModalOpen, setSelectedEmail,
        setEmailToCompose, setIsEmailComposerOpen,
    ]);
    
    const handleChatToggle = () => {
        if (chatStatus === 'idle' || chatStatus === 'error') {
            startChatSession();
        } else {
            stopChatSession();
        }
    };
    
    useEffect(() => {
        if (restartPending) {
            setRestartPending(false);
            const restart = async () => {
                await stopChatSession();
                await new Promise(resolve => setTimeout(resolve, 50));
                await startChatSession();
            };
            restart();
        }
    }, [restartPending, startChatSession, stopChatSession]);

    useEffect(() => {
        return () => {
            stopChatSession();
        };
    }, [stopChatSession]);

    return {
        chatStatus,
        chatError,
        handleChatToggle,
        audioContext: inputAudioContextRef.current,
        mediaStream: streamRef.current,
        isAiSpeaking,
        lastActionItem,
        itemToOpenDetailsFor: itemToOpenDetailsFor,
        clearItemToOpen: () => setItemToOpenDetailsFor(null),
        projectToNavigateTo,
        clearProjectToNavigateTo: () => setProjectToNavigateTo(null),
    };
};