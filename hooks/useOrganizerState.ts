// FIX: Import React to use types like React.ChangeEvent
import React, { useState, useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import { AppData, TodoItem, ShoppingItem, NoteItem, Priority, CustomList, GenericItem, SubtaskItem, ShoppingUnit, Project, FilterState, OrganizedData, CustomListField, NoteHistoryEntry, VoiceSettings, TodoSortOrder, SelectionState, AllItemTypes } from '../types';
import { levenshteinDistance } from '../utils/fuzzyMatching';
import { sanitizeTitleForKey } from '../services/geminiService';
import * as googleDriveService from '../services/googleDriveService';

export type ListType = 'todos' | 'shopping' | 'notes' | 'custom';

const NOTE_HISTORY_LIMIT = 5;

const defaultSettings: VoiceSettings = {
  voiceName: 'Zephyr',
  tone: 0,
  proactivity: 0,
  verbosity: 0,
  customInstruction: '',
  formality: 'tutoiement',
  userName: '',
};

export interface DragItemInfo {
    id: string;
    // FIX: Add 'group' to the type to allow dragging multiple items.
    type: ListType | 'email' | 'group';
    listId?: string; // For custom lists
    content: any;
}

export interface QueuedItem {
    type: ListType;
    content: any;
    listId?: string; // for custom lists
}

interface HistoryEntry {
  id: number;
  message: string;
  appData: AppData;
}

const HISTORY_LIMIT = 30;

const getInitialState = (): AppData => {
    try {
        const saved = localStorage.getItem('appData');
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                lastModified: null,
                ...parsed,
                notes: (parsed.notes || []).map((note: any) => ({ ...note, history: note.history || [] })),
                voiceSettings: { ...defaultSettings, ...(parsed.voiceSettings || {}) },
                defaultCalendarId: parsed.defaultCalendarId || null,
                visibleCalendarIds: parsed.visibleCalendarIds || [],
            };
        }
    } catch (e) { console.error("Failed to load from local storage", e); }
    
    // Default initial state
    return {
        todos: [
            { id: 't1', task: 'Finalize quarterly report', completed: false, priority: Priority.High, description: 'Gather all the data and charts for the Q3 report.', subtasks: [{id: 'st1', text: 'Compile sales data', completed: true}, {id: 'st2', text: 'Create visualizations', completed: false}], dueDate: '2024-08-15', projectId: null },
            { id: 't2', task: 'Book dentist appointment', completed: true, priority: Priority.Medium, description: '', subtasks: [], dueDate: null, projectId: null },
        ],
        shoppingList: [
            { id: 's1', item: 'Milk', completed: true, quantity: 1, unit: ShoppingUnit.L, store: 'Super U', description: 'Lait entier', projectId: null },
            { id: 's2', item: 'Bread', completed: false, projectId: null },
        ],
        notes: [
            { id: 'n1', content: 'Project meeting is at 2 PM on Wednesday.', projectId: null, history: [] },
        ],
        customLists: [],
        projects: [],
        todoSortOrder: 'priority',
        lastModified: null,
        voiceSettings: defaultSettings,
        defaultCalendarId: null,
        visibleCalendarIds: [],
    };
};

export const useOrganizerState = (accessToken: string | null) => {
    const [appData, setAppData] = useState<AppData>(getInitialState);
    const { todos, shoppingList, notes, customLists, projects, todoSortOrder, lastModified, voiceSettings, defaultCalendarId, visibleCalendarIds } = appData;

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importConfirmationFile, setImportConfirmationFile] = useState<File | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterState | null>(null);
    const [duplicateConfirmation, setDuplicateConfirmation] = useState<{
        newItem: QueuedItem;
        existingItem: { id: string; type: ListType; listId?: string; text: string };
        unprocessedQueue: QueuedItem[];
    } | null>(null);

    // FIX: Add selection state and logic.
    const [selection, setSelection] = useState<SelectionState>({ isActive: false, type: null });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const driveFileIdRef = useRef<string | null>(null);
    const isSyncInitializedRef = useRef(false);
    // FIX: Changed NodeJS.Timeout to ReturnType<typeof setTimeout> for browser environments.
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const performAction = (
      message: string,
      action: (currentData: AppData) => AppData
    ) => {
      const oldAppData = { ...appData };
      const newAppData = action(oldAppData);
      setAppData(newAppData);
      
      const newEntry: HistoryEntry = { id: Date.now(), message, appData: oldAppData };
      setHistory(prev => [...prev, newEntry].slice(-HISTORY_LIMIT));
      
      return { message };
    };
    
    const undoLastAction = () => {
      if (history.length === 0) return null;
      
      const lastAction = history[history.length - 1];
      setAppData(lastAction.appData);
      setHistory(prev => prev.slice(0, -1));
      
      return `Annulé : ${lastAction.message}`;
    };

    const saveDataToDrive = useCallback(async (dataToSave: AppData) => {
        if (!accessToken || !isSyncInitializedRef.current) return;
        
        const timestamp = new Date().toISOString();
        const updatedData = { ...dataToSave, lastModified: timestamp };
        
        try {
            if (driveFileIdRef.current) {
                await googleDriveService.saveFileContent(accessToken, driveFileIdRef.current, updatedData);
            } else {
                const fileId = await googleDriveService.createFile(accessToken, updatedData);
                driveFileIdRef.current = fileId;
            }
            // Only update local timestamp after successful save
            localStorage.setItem('appData', JSON.stringify(updatedData));
            setAppData(prev => ({ ...prev, lastModified: timestamp }));
        } catch (error) {
            console.error("Failed to save data to Google Drive:", error);
        }
    }, [accessToken]);

    const initializeSync = useCallback(async (token: string) => {
        if (!token) return;
        try {
            const driveFile = await googleDriveService.findFile(token);
            if (driveFile) {
                driveFileIdRef.current = driveFile.id;
                const localData = getInitialState();
                
                const driveTimestamp = new Date(driveFile.modifiedTime);
                const localTimestamp = localData.lastModified ? new Date(localData.lastModified) : new Date(0);

                if (driveTimestamp > localTimestamp) {
                    const driveContent = await googleDriveService.getFileContent(token, driveFile.id);
                    setAppData({ ...getInitialState(), ...driveContent, voiceSettings: { ...defaultSettings, ...(driveContent.voiceSettings || {}) }, defaultCalendarId: driveContent.defaultCalendarId || null });
                } else if (localData.lastModified) {
                    saveDataToDrive(localData);
                }
            } else {
                const localData = getInitialState();
                const fileId = await googleDriveService.createFile(token, localData);
                driveFileIdRef.current = fileId;
            }
        } catch (error) {
            console.error("Error during initial sync:", error);
        } finally {
            isSyncInitializedRef.current = true;
        }
    }, [saveDataToDrive]);
    
    // Effect for debounced saving to local storage and Google Drive
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            if (isSyncInitializedRef.current) {
                const currentData = { todos, shoppingList, notes, customLists, projects, todoSortOrder, lastModified, voiceSettings, defaultCalendarId, visibleCalendarIds };
                localStorage.setItem('appData', JSON.stringify(currentData));
                saveDataToDrive(currentData);
            }
        }, 2500); // 2.5 second debounce

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [todos, shoppingList, notes, customLists, projects, todoSortOrder, voiceSettings, defaultCalendarId, visibleCalendarIds, saveDataToDrive, lastModified]);

    // Effect for initializing sync when user logs in
    useEffect(() => {
        if (accessToken && !isSyncInitializedRef.current) {
            initializeSync(accessToken);
        }
    }, [accessToken, initializeSync]);
    
    const forceSync = useCallback(() => {
        if (accessToken) {
            console.log("Forcing data refresh from Google Drive...");
            isSyncInitializedRef.current = false;
            initializeSync(accessToken);
        } else {
            console.warn("Cannot refresh, user not logged in.");
        }
    }, [accessToken, initializeSync]);

    // FIX: Implement selection mode state and functions.
    const clearSelection = () => setSelectedIds(new Set());

    const endSelectionMode = () => {
        setSelection({ isActive: false, type: null, listId: null });
        clearSelection();
    };

    const startSelectionMode = (type: 'todos' | 'shopping' | 'custom' | 'notes', listId?: string) => {
        endSelectionMode(); // Clear previous selection
        setSelection({ isActive: true, type, listId });
    };

    const toggleItemSelected = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllInList = () => {
        if (!selection.isActive) return;
        let allIds: string[] = [];
        if (selection.type === 'todos') {
            allIds = todos.map(i => i.id);
        } else if (selection.type === 'shopping') {
            allIds = shoppingList.map(i => i.id);
        } else if (selection.type === 'notes') {
            allIds = notes.map(i => i.id);
        } else if (selection.type === 'custom' && selection.listId) {
            const list = customLists.find(l => l.id === selection.listId);
            if (list) {
                allIds = list.items.map(i => i.id);
            }
        }
        setSelectedIds(new Set(allIds));
    };


    const updateVoiceSettings = (newSettings: Partial<VoiceSettings>) => {
        performAction("Paramètres de l'assistant mis à jour.", (data) => ({
          ...data,
          voiceSettings: { ...data.voiceSettings, ...newSettings }
        }));
    };

    const setDefaultCalendarId = (calendarId: string) => {
        performAction("Calendrier par défaut mis à jour.", (data) => ({
          ...data,
          defaultCalendarId: calendarId
        }));
    };

    const updateVisibleCalendars = (calendarIds: string[]) => {
        return performAction("Calendriers visibles mis à jour.", (data) => ({
          ...data,
          visibleCalendarIds: calendarIds
        }));
    };

    const findDuplicateForItem = useCallback((itemText: string, listType: ListType, listId?: string): { id: string, text: string, listId?: string, type: ListType } | null => {
        const lowerItemText = itemText.toLowerCase();
        let bestMatch: { id: string, text: string, listId?: string, type: ListType } | null = null;
        let minDistance = Infinity;
        let targetList: { id: string, text: string }[] = [];
        let threshold = 0.4;

        if (listType === 'todos') targetList = todos.map(t => ({ id: t.id, text: t.task }));
        else if (listType === 'shopping') targetList = shoppingList.map(s => ({ id: s.id, text: s.item }));
        else if (listType === 'custom' && listId) {
            const list = customLists.find(l => l.id === listId);
            if (list) targetList = list.items.map(i => ({ id: i.id, text: i.text }));
        }

        for (const existingItem of targetList) {
            const distance = levenshteinDistance(lowerItemText, existingItem.text.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = { ...existingItem, type: listType, listId };
            }
        }

        if (bestMatch && minDistance <= Math.max(lowerItemText.length, bestMatch.text.length) * threshold) {
            return bestMatch;
        }
        return null;
    }, [todos, shoppingList, customLists]);

    const addTodo = (task: string, priority: Priority, projectId: string | null = null) => {
        const newTodo: TodoItem = { id: crypto.randomUUID(), task, priority, completed: false, description: '', subtasks: [], dueDate: null, projectId };
        const result = performAction(`Tâche "${task}" ajoutée.`, (data) => ({
            ...data,
            todos: [newTodo, ...data.todos]
        }));
        return { ...result, newId: newTodo.id };
    };

    const addShoppingItem = (item: string, projectId: string | null = null) => {
        const newShoppingItem: ShoppingItem = { id: crypto.randomUUID(), item, completed: false, quantity: null, unit: null, store: '', description: '', projectId };
        const result = performAction(`Article "${item}" ajouté.`, (data) => ({
            ...data,
            shoppingList: [newShoppingItem, ...data.shoppingList]
        }));
        return { ...result, newId: newShoppingItem.id };
    };

    const addNote = (content: string, projectId: string | null = null) => {
        const newNote: NoteItem = { id: crypto.randomUUID(), content, projectId, history: [] };
        const result = performAction('Note ajoutée.', (data) => ({
            ...data,
            notes: [newNote, ...data.notes]
        }));
        return { ...result, newId: newNote.id };
    };
    
    const addCustomListItem = (listId: string, itemText: string, customFields: Record<string, string> = {}, projectId: string | null = null) => {
        const newItem: GenericItem = { id: crypto.randomUUID(), text: itemText, completed: false, description: '', customFields, projectId };
        const result = performAction(`Élément "${itemText}" ajouté.`, (data) => ({
            ...data,
            customLists: data.customLists.map(list => list.id === listId ? { ...list, items: [...list.items, newItem] } : list)
        }));
        return { ...result, newId: newItem.id };
    };

    const processAdditionQueue = useCallback((queue: QueuedItem[]) => {
        const messages: string[] = [];
        let currentData = { ...appData };
    
        const processNext = (q: QueuedItem[], data: AppData): AppData => {
            if (q.length === 0) return data;
    
            const [currentItem, ...remainingQueue] = q;
            const { type, content, listId } = currentItem;
            const itemText = content.task || content.item || content.content || content.text;
    
            // Using a temporary findDuplicate to check against the most recent state in this batch
            const tempTodos = data.todos;
            const tempShopping = data.shoppingList;
            const tempCustom = data.customLists;
            const duplicate = findDuplicateForItem(itemText, type, listId); // This uses component state, which is fine for this check
    
            if (duplicate) {
                setDuplicateConfirmation({ newItem: currentItem, existingItem: duplicate, unprocessedQueue: remainingQueue });
                // Stop processing here, return current accumulated data
                return data;
            }
    
            let newData = data;
            if (type === 'todos') {
                const newTodo: TodoItem = { id: crypto.randomUUID(), task: content.task, priority: content.priority || Priority.Medium, completed: false, description: content.description || '', subtasks: [], dueDate: content.dueDate || null, projectId: null };
                newData = { ...data, todos: [newTodo, ...data.todos] };
                messages.push(`Tâche "${content.task}" ajoutée.`);
            } else if (type === 'shopping') {
                const newShoppingItem: ShoppingItem = { id: crypto.randomUUID(), item: content.item, completed: false, description: content.description || '', projectId: null, quantity: content.quantity || null, unit: content.unit || null, store: content.store || '' };
                newData = { ...data, shoppingList: [newShoppingItem, ...data.shoppingList] };
                messages.push(`Article "${content.item}" ajouté.`);
            } else if (type === 'notes') {
                const newNote: NoteItem = { id: crypto.randomUUID(), content: content.content, projectId: null, history: [] };
                newData = { ...data, notes: [newNote, ...data.notes] };
                messages.push('Note ajoutée.');
            } else if (type === 'custom' && listId) {
                const newItem: GenericItem = { id: crypto.randomUUID(), text: content.item, completed: false, customFields: content.customFields || {}, description: content.description || '', projectId: null };
                newData = { ...data, customLists: data.customLists.map(l => l.id === listId ? { ...l, items: [...l.items, newItem] } : l) };
                messages.push(`Élément "${content.item}" ajouté.`);
            }
            return processNext(remainingQueue, newData);
        };
    
        const finalData = processNext(queue, currentData);
    
        if (messages.length > 0) {
            const oldAppData = { ...appData };
            setAppData(finalData);
            const newEntry: HistoryEntry = { id: Date.now(), message: messages.join(' '), appData: oldAppData };
            setHistory(prev => [...prev, newEntry].slice(-HISTORY_LIMIT));
        }
    
        return messages;
    }, [appData, findDuplicateForItem]);

    const confirmDuplicateAdd = useCallback(() => {
        if (!duplicateConfirmation) return null;
        const { newItem, unprocessedQueue } = duplicateConfirmation;
        const messages = processAdditionQueue([newItem, ...unprocessedQueue]);
        setDuplicateConfirmation(null);
        return messages;
    }, [duplicateConfirmation, processAdditionQueue]);

    const clearDuplicateConfirmation = () => setDuplicateConfirmation(null);

    const handleToggleTodo = (id: string) => {
        const todo = todos.find(t => t.id === id);
        if (!todo) return null;
        return performAction(`Tâche "${todo.task}" marquée comme ${!todo.completed ? 'complétée' : 'non complétée'}.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
        }));
    };
    const handleDeleteTodo = (id: string) => {
        const todo = todos.find(t => t.id === id);
        if (!todo) return null;
        return performAction(`Tâche "${todo.task}" supprimée.`, (data) => ({
            ...data,
            todos: data.todos.filter(t => t.id !== id),
            projects: data.projects.map(p => ({
                ...p,
                linkedItemIds: { ...p.linkedItemIds, todoIds: p.linkedItemIds.todoIds.filter(tid => tid !== id) }
            }))
        }));
    };
    const editTodo = (id: string, task: string) => {
        return performAction(`Tâche renommée en "${task}".`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, task } : t)
        }));
    };
    const editTodoPriority = (id: string, priority: Priority) => {
        return performAction(`Priorité changée à "${priority}".`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, priority } : t)
        }));
    };
    const editTodoDescription = (id: string, description: string) => {
         return performAction(`Description de la tâche mise à jour.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, description } : t)
        }));
    };
    const editTodoDueDate = (id: string, dueDate: string | null) => {
        return performAction(`Date limite mise à jour.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === id ? { ...t, dueDate } : t)
        }));
    };
    const addTodoSubtask = (todoId: string, text: string) => {
        const newSubtask: SubtaskItem = { id: crypto.randomUUID(), text, completed: false };
        return performAction(`Sous-tâche "${text}" ajoutée.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === todoId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t)
        }));
    };
    const toggleTodoSubtask = (todoId: string, subtaskId: string) => {
        const todo = todos.find(t => t.id === todoId);
        const subtask = todo?.subtasks.find(st => st.id === subtaskId);
        if (!subtask) return null;
        return performAction(`Sous-tâche "${subtask.text}" mise à jour.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === todoId ? { ...t, subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st) } : t)
        }));
    };
    const deleteTodoSubtask = (todoId: string, subtaskId: string) => {
         const todo = todos.find(t => t.id === todoId);
        const subtask = todo?.subtasks.find(st => st.id === subtaskId);
        if (!subtask) return null;
        return performAction(`Sous-tâche "${subtask.text}" supprimée.`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === todoId ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subtaskId) } : t)
        }));
    };
    const editTodoSubtask = (todoId: string, subtaskId: string, text: string) => {
         return performAction(`Sous-tâche renommée en "${text}".`, (data) => ({
            ...data,
            todos: data.todos.map(t => t.id === todoId ? { ...t, subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, text } : st) } : t)
        }));
    };

    const handleToggleShoppingItem = (id: string) => {
        const item = shoppingList.find(i => i.id === id);
        if (!item) return null;
        return performAction(`Article "${item.item}" marqué comme ${!item.completed ? 'acheté' : 'à acheter'}.`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.map(i => i.id === id ? { ...i, completed: !i.completed } : i)
        }));
    };
    const handleDeleteShoppingItem = (id: string) => {
        const item = shoppingList.find(i => i.id === id);
        if (!item) return null;
        return performAction(`Article "${item.item}" supprimé.`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.filter(i => i.id !== id),
            projects: data.projects.map(p => ({
                ...p,
                linkedItemIds: { ...p.linkedItemIds, shoppingItemIds: p.linkedItemIds.shoppingItemIds.filter(sid => sid !== id) }
            }))
        }));
    };
    const editShoppingItem = (id:string, item: string) => {
        return performAction(`Article renommé en "${item}".`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.map(i => i.id === id ? { ...i, item } : i)
        }));
    };
    const editShoppingItemDetails = (id: string, details: Partial<Pick<ShoppingItem, 'quantity' | 'unit' | 'store' | 'description'>>) => {
        return performAction(`Détails de l'article mis à jour.`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.map(i => i.id === id ? { ...i, ...details } : i)
        }));
    };
    
    const handleDeleteNote = (id: string) => {
         const note = notes.find(n => n.id === id);
        if (!note) return null;
        return performAction(`Note supprimée.`, (data) => ({
            ...data,
            notes: data.notes.filter(n => n.id !== id),
            projects: data.projects.map(p => ({
                ...p,
                linkedItemIds: { ...p.linkedItemIds, noteIds: p.linkedItemIds.noteIds.filter(nid => nid !== id) }
            }))
        }));
    };
    const editNote = (id: string, content: string) => {
        return performAction(`Note mise à jour.`, (data) => {
            const note = data.notes.find(n => n.id === id);
            if (note && note.content !== content) {
                const newHistoryEntry: NoteHistoryEntry = { content: note.content, timestamp: new Date().toISOString() };
                const newHistory = [newHistoryEntry, ...(note.history || [])];
                return {
                    ...data,
                    notes: data.notes.map(n => n.id === id ? { ...n, content, history: newHistory.slice(0, NOTE_HISTORY_LIMIT) } : n)
                };
            }
            return data;
        });
    };
    const revertNoteToVersion = (noteId: string, historyEntry: NoteHistoryEntry) => editNote(noteId, historyEntry.content);

    const addCustomList = (title: string, fields: { name: string }[]) => {
        if (customLists.some(list => list.title.toLowerCase() === title.toLowerCase())) {
            alert("A list with this title already exists."); return null;
        }
        const newList: CustomList = { id: crypto.randomUUID(), title, items: [], fields: fields.map(f => ({ id: crypto.randomUUID(), name: f.name })) };
        return performAction(`Liste "${title}" créée.`, (data) => ({
            ...data,
            customLists: [...data.customLists, newList]
        }));
    };
    const deleteCustomList = (listId: string) => {
         const list = customLists.find(l => l.id === listId);
        if (!list) return null;
        return performAction(`Liste "${list.title}" supprimée.`, (data) => {
            const itemIdsToDelete = new Set(data.customLists.find(l => l.id === listId)?.items.map(i => i.id));
            return {
                ...data,
                customLists: data.customLists.filter(l => l.id !== listId),
                projects: data.projects.map(p => ({
                    ...p,
                    linkedItemIds: {
                        ...p.linkedItemIds,
                        customListItemIds: Object.fromEntries(Object.entries(p.linkedItemIds.customListItemIds).filter(([itemId]) => !itemIdsToDelete.has(itemId)))
                    }
                }))
            };
        });
    };
    const deleteCustomListItem = (listId: string, itemId: string) => {
        const list = customLists.find(l => l.id === listId);
        const item = list?.items.find(i => i.id === itemId);
        if (!item) return null;
        return performAction(`Élément "${item.text}" supprimé.`, (data) => ({
            ...data,
            customLists: data.customLists.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l),
            projects: data.projects.map(p => {
                const newCustomIds = { ...p.linkedItemIds.customListItemIds };
                if (newCustomIds[itemId]) delete newCustomIds[itemId];
                return { ...p, linkedItemIds: { ...p.linkedItemIds, customListItemIds: newCustomIds } };
            })
        }));
    };
    const toggleCustomListItem = (listId: string, itemId: string) => {
        const list = customLists.find(l => l.id === listId);
        const item = list?.items.find(i => i.id === itemId);
        if (!item) return null;
        return performAction(`Élément "${item.text}" mis à jour.`, (data) => ({
            ...data,
            customLists: data.customLists.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i) } : l)
        }));
    };
    const editCustomListItemDetails = (listId: string, itemId: string, details: Partial<Pick<GenericItem, 'text' | 'description'>> & { customFields?: Record<string, string> }) => {
        return performAction(`Détails de l'élément mis à jour.`, (data) => ({
            ...data,
            customLists: data.customLists.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...details } : i) } : l)
        }));
    };

    const addProject = (title: string, description: string) => {
        const newProject: Project = { 
            id: crypto.randomUUID(), 
            title, 
            description, 
            isHiddenInMainView: false,
            hiddenItemTypes: { todos: false, shopping: false, notes: false, customLists: false },
            linkedItemIds: { todoIds: [], shoppingItemIds: [], noteIds: [], customListItemIds: {}, linkedEventIds: [], linkedEmailIds: [] } 
        };
        return performAction(`Projet "${title}" créé.`, (data) => ({
            ...data,
            projects: [...data.projects, newProject]
        }));
    };

    const updateProjectVisibility = (projectId: string, settings: Partial<{ isHiddenInMainView: boolean; hiddenItemTypes: Partial<Project['hiddenItemTypes']> }>) => {
        return performAction('Paramètres de visibilité du projet mis à jour.', (data) => ({
            ...data,
            projects: data.projects.map(p => {
                if (p.id === projectId) {
                    return {
                        ...p,
                        isHiddenInMainView: settings.isHiddenInMainView ?? p.isHiddenInMainView,
                        hiddenItemTypes: settings.hiddenItemTypes ? { ...p.hiddenItemTypes, ...settings.hiddenItemTypes } : p.hiddenItemTypes,
                    };
                }
                return p;
            })
        }));
    };
    
    const deleteProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return null;
        return performAction(`Projet "${project.title}" supprimé.`, (data) => {
            const { todoIds, shoppingItemIds, noteIds, customListItemIds } = project.linkedItemIds;
            const allItemIds = new Set([...todoIds, ...shoppingItemIds, ...noteIds, ...Object.keys(customListItemIds)]);
            
            return {
                ...data,
                todos: data.todos.map(item => allItemIds.has(item.id) ? { ...item, projectId: null } : item),
                shoppingList: data.shoppingList.map(item => allItemIds.has(item.id) ? { ...item, projectId: null } : item),
                notes: data.notes.map(item => allItemIds.has(item.id) ? { ...item, projectId: null } : item),
                customLists: data.customLists.map(list => ({
                    ...list,
                    items: list.items.map(item => allItemIds.has(item.id) ? { ...item, projectId: null } : item)
                })),
                projects: data.projects.filter(p => p.id !== projectId),
            };
        });
    };
    
    const updateProjectLinks = (projectId: string, newLinkedItemIds: Project['linkedItemIds']) => {
        return performAction(`Liens du projet mis à jour.`, (data) => {
            const project = data.projects.find(p => p.id === projectId);
            if (!project) return data;

            const allLinkedIds = new Set([
                ...newLinkedItemIds.todoIds,
                ...newLinkedItemIds.shoppingItemIds,
                ...newLinkedItemIds.noteIds,
                ...Object.keys(newLinkedItemIds.customListItemIds)
            ]);

            const updateItem = (item: any) => {
                if (allLinkedIds.has(item.id)) return { ...item, projectId };
                if (item.projectId === projectId) return { ...item, projectId: null };
                return item;
            };

            return {
                ...data,
                projects: data.projects.map(p => p.id === projectId ? { ...p, linkedItemIds: newLinkedItemIds } : p),
                todos: data.todos.map(updateItem),
                shoppingList: data.shoppingList.map(updateItem),
                notes: data.notes.map(updateItem),
                customLists: data.customLists.map(list => ({
                    ...list,
                    items: list.items.map(updateItem)
                }))
            };
        });
    };

    const reorderList = (listKey: keyof AppData, startIndex: number, endIndex: number) => {
        performAction(`Liste réorganisée.`, (data) => {
            const list = data[listKey] as any[];
            const result = Array.from(list);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { ...data, [listKey]: result };
        });
    };
    const reorderTodos = (s: number, e: number) => reorderList('todos', s, e);
    const reorderShoppingList = (s: number, e: number) => reorderList('shoppingList', s, e);
    const reorderNotes = (s: number, e: number) => reorderList('notes', s, e);
    const reorderCustomListItems = (listId: string, startIndex: number, endIndex: number) => {
        performAction(`Liste réorganisée.`, (data) => ({
            ...data,
            customLists: data.customLists.map(list => {
                if (list.id === listId) {
                    const result = Array.from(list.items);
                    const [removed] = result.splice(startIndex, 1);
                    result.splice(endIndex, 0, removed);
                    return { ...list, items: result };
                }
                return list;
            })
        }));
    };
    
    const moveItem = (dragItem: DragItemInfo, destType: ListType, destListId?: string) => {
        if (!dragItem) return null;
        const { type: sourceType, listId: sourceListId, id: sourceId, content } = dragItem;
        const textContent = content.task || content.item || content.text || content.content || 'Untitled';

        return performAction(`Élément "${textContent}" déplacé.`, (data) => {
            let newData = { ...data };

            // 1. Delete from source
            if (sourceType === 'todos') newData.todos = newData.todos.filter(i => i.id !== sourceId);
            else if (sourceType === 'shopping') newData.shoppingList = newData.shoppingList.filter(i => i.id !== sourceId);
            else if (sourceType === 'notes') newData.notes = newData.notes.filter(i => i.id !== sourceId);
            else if (sourceType === 'custom' && sourceListId) {
                newData.customLists = newData.customLists.map(l => l.id === sourceListId ? { ...l, items: l.items.filter(i => i.id !== sourceId) } : l);
            }
            
            // 2. Add to destination with a new ID
            const newId = crypto.randomUUID();
            if (destType === 'todos') {
                const newTodo: TodoItem = { id: newId, task: textContent, completed: false, priority: (content.priority as Priority) || Priority.Medium, description: content.description || '', subtasks: content.subtasks || [], dueDate: content.dueDate || null, projectId: content.projectId || null };
                newData.todos = [newTodo, ...newData.todos];
            } else if (destType === 'shopping') {
                const newShoppingItem: ShoppingItem = { id: newId, item: textContent, completed: false, projectId: content.projectId || null };
                newData.shoppingList = [newShoppingItem, ...newData.shoppingList];
            } else if (destType === 'notes') {
                const newNote: NoteItem = { id: newId, content: textContent, projectId: content.projectId || null, history: [] };
                newData.notes = [newNote, ...newData.notes];
            } else if (destType === 'custom' && destListId) {
                const newItem: GenericItem = { id: newId, text: textContent, completed: false, customFields: content.customFields || {}, projectId: content.projectId || null };
                newData.customLists = newData.customLists.map(l => l.id === destListId ? { ...l, items: [newItem, ...l.items] } : l);
            }
            return newData;
        });
    };
    
    const moveItemByNameAndList = (itemName: string, sourceListName: string, destListName: string): { success: boolean; message: string; itemId?: string; } => {
        // This function is complex and doesn't fit the `performAction` pattern well, so it's left as-is for now.
        // It internally calls other action functions that *do* use `performAction`.
        const findBestMatch = (list: any[], name: string, prop: string) => {
            let bestMatch = null;
            let minDistance = Infinity;
            for (const item of list) {
                const distance = levenshteinDistance(name.toLowerCase(), item[prop].toLowerCase());
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = item;
                }
            }
            if (bestMatch && minDistance < Math.max(name.length, bestMatch[prop].length) * 0.6) {
                return bestMatch;
            }
            return null;
        };

        const findItem = (name: string, listName: string): { item: any, type: ListType, listId?: string } | null => {
            const lowerListName = listName.toLowerCase();
            if (['tâches', 'tache', 'todo', 'todos'].some(alias => lowerListName.includes(alias))) {
                const item = findBestMatch(todos, name, 'task');
                return item ? { item, type: 'todos' } : null;
            }
            if (['courses', 'shopping'].some(alias => lowerListName.includes(alias))) {
                const item = findBestMatch(shoppingList, name, 'item');
                return item ? { item, type: 'shopping' } : null;
            }
            const list = customLists.find(l => l.title.toLowerCase() === lowerListName);
            if (list) {
                const item = findBestMatch(list.items, name, 'text');
                return item ? { item, type: 'custom', listId: list.id } : null;
            }
            return null;
        };

        const source = findItem(itemName, sourceListName);
        if (!source) {
            return { success: false, message: `Désolé, je n'ai pas trouvé d'élément ressemblant à "${itemName}" dans la liste "${sourceListName}".` };
        }

        const destLower = destListName.toLowerCase();
        let destType: ListType | undefined;
        let destListId: string | undefined;

        if (['tâches', 'tache', 'todo', 'todos'].some(alias => destLower.includes(alias))) destType = 'todos';
        else if (['courses', 'shopping'].some(alias => destLower.includes(alias))) destType = 'shopping';
        else {
            const list = customLists.find(l => l.title.toLowerCase() === destLower);
            if (list) {
                destType = 'custom';
                destListId = list.id;
            }
        }
        
        if (!destType) {
            return { success: false, message: `Désolé, je n'ai pas trouvé de liste de destination nommée "${destListName}".` };
        }

        if (source.type === destType && source.listId === destListId) {
            return { success: false, message: "L'élément est déjà dans cette liste." };
        }

        const dragInfo: DragItemInfo = { id: source.item.id, type: source.type, listId: source.listId, content: source.item };
        const result = moveItem(dragInfo, destType, destListId);

        return { success: true, message: result?.message || `OK, j'ai déplacé "${itemName}" vers la liste "${destListName}".` };
    };

    const handleExportData = () => { /* ... */ };
    const handleImportClick = () => fileInputRef.current?.click();
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.[0]) setImportConfirmationFile(event.target.files[0]);
        event.target.value = '';
    };
    const confirmImport = () => { if (importConfirmationFile) processImportedFile(importConfirmationFile); setImportConfirmationFile(null); };
    const cancelImport = () => setImportConfirmationFile(null);
    const processImportedFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                const importedData: AppData = {
                    ...getInitialState(), // Ensure all keys exist
                    ...data,
                    lastModified: new Date().toISOString(), // Mark as newest
                };
                setAppData(importedData);
                setHistory([]); // Clear history on import
                isSyncInitializedRef.current = true; // Treat import as initialization
                saveDataToDrive(importedData);
            } catch (error) { alert(`Import Error: ${error}`); }
        };
        reader.readAsText(file);
    };

    const findProjectByName = (name: string): Project | null => {
        if (!name) return null;
        const lowerName = name.toLowerCase();
        let bestMatch: Project | null = null;
        let minDistance = Infinity;
        for (const project of projects) {
            const distance = levenshteinDistance(lowerName, project.title.toLowerCase());
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = project;
            }
        }
        if (bestMatch && minDistance < Math.max(lowerName.length, bestMatch.title.length) * 0.5) {
            return bestMatch;
        }
        return null;
    };
    
    const linkItemToProject = (projectId: string, itemType: AllItemTypes, itemId: string) => {
        return performAction(`Élément lié au projet.`, (data) => {
            const updateItemProjectId = (item: any) => item.id === itemId ? { ...item, projectId } : item;

            const newProjects = data.projects.map(p => {
                // Remove from all other projects first
                const newLinkedIds = {
                    ...p.linkedItemIds,
                    todoIds: p.linkedItemIds.todoIds.filter(id => id !== itemId),
                    shoppingItemIds: p.linkedItemIds.shoppingItemIds.filter(id => id !== itemId),
                    noteIds: p.linkedItemIds.noteIds.filter(id => id !== itemId),
                    linkedEventIds: (p.linkedItemIds.linkedEventIds || []).filter(id => id !== itemId),
                    linkedEmailIds: (p.linkedItemIds.linkedEmailIds || []).filter(id => id !== itemId),
                    customListItemIds: { ...p.linkedItemIds.customListItemIds }
                };
                delete newLinkedIds.customListItemIds[itemId];

                // Add to the target project
                if (p.id === projectId) {
                    if (itemType === 'todos') newLinkedIds.todoIds.push(itemId);
                    else if (itemType === 'shopping') newLinkedIds.shoppingItemIds.push(itemId);
                    else if (itemType === 'notes') newLinkedIds.noteIds.push(itemId);
                    else if (itemType === 'event') (newLinkedIds.linkedEventIds = newLinkedIds.linkedEventIds || []).push(itemId);
                    else if (itemType === 'email') (newLinkedIds.linkedEmailIds = newLinkedIds.linkedEmailIds || []).push(itemId);
                    else if (itemType === 'custom') {
                        const list = data.customLists.find(l => l.items.some(i => i.id === itemId));
                        if (list) newLinkedIds.customListItemIds[itemId] = list.id;
                    }
                }
                return { ...p, linkedItemIds: newLinkedIds };
            });

            if (itemType !== 'email' && itemType !== 'event') {
                return {
                    ...data,
                    projects: newProjects,
                    todos: data.todos.map(updateItemProjectId),
                    shoppingList: data.shoppingList.map(updateItemProjectId),
                    notes: data.notes.map(updateItemProjectId),
                    customLists: data.customLists.map(list => ({ ...list, items: list.items.map(updateItemProjectId) }))
                };
            } else {
                return {
                    ...data,
                    projects: newProjects,
                };
            }
        });
    };
    
    const unlinkItemFromProject = (itemType: AllItemTypes, itemId: string) => {
        return performAction(`Élément délié du projet.`, (data) => {
            const updateItemProjectId = (item: any) => item.id === itemId ? { ...item, projectId: null } : item;

            const newProjects = data.projects.map(p => {
                const newLinkedIds = {
                    ...p.linkedItemIds,
                    todoIds: p.linkedItemIds.todoIds.filter(id => id !== itemId),
                    shoppingItemIds: p.linkedItemIds.shoppingItemIds.filter(id => id !== itemId),
                    noteIds: p.linkedItemIds.noteIds.filter(id => id !== itemId),
                    linkedEventIds: (p.linkedItemIds.linkedEventIds || []).filter(id => id !== itemId),
                    linkedEmailIds: (p.linkedItemIds.linkedEmailIds || []).filter(id => id !== itemId),
                    customListItemIds: { ...p.linkedItemIds.customListItemIds }
                };
                delete newLinkedIds.customListItemIds[itemId];
                return { ...p, linkedItemIds: newLinkedIds };
            });

            if (itemType !== 'email' && itemType !== 'event') {
                 return {
                    ...data,
                    projects: newProjects,
                    todos: data.todos.map(updateItemProjectId),
                    shoppingList: data.shoppingList.map(updateItemProjectId),
                    notes: data.notes.map(updateItemProjectId),
                    customLists: data.customLists.map(list => ({ ...list, items: list.items.map(updateItemProjectId) }))
                };
            } else {
                return {
                    ...data,
                    projects: newProjects,
                };
            }
        });
    };
    
    const deleteCompletedTodos = () => {
        const completedCount = todos.filter(t => t.completed).length;
        if (completedCount === 0) return { message: "Aucune tâche terminée à supprimer." };
        return performAction(`${completedCount} tâche${completedCount > 1 ? 's' : ''} terminée${completedCount > 1 ? 's' : ''} supprimée${completedCount > 1 ? 's' : ''}.`, (data) => ({
            ...data,
            todos: data.todos.filter(todo => !todo.completed)
        }));
    };
    
    const deleteCompletedShoppingItems = () => {
        const completedCount = shoppingList.filter(i => i.completed).length;
        if (completedCount === 0) return { message: "Aucun article coché à supprimer." };
        return performAction(`${completedCount} article${completedCount > 1 ? 's' : ''} supprimé${completedCount > 1 ? 's' : ''}.`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.filter(item => !item.completed)
        }));
    };
    
    const deleteCompletedCustomListItems = (listId: string) => {
        const list = customLists.find(l => l.id === listId);
        if (!list) return null;
        const completedCount = list.items.filter(i => i.completed).length;
        if (completedCount === 0) return { message: `Aucun élément complété à supprimer dans "${list.title}".` };
        
        return performAction(`${completedCount} élément${completedCount > 1 ? 's' : ''} supprimé${completedCount > 1 ? 's' : ''} de "${list.title}".`, (data) => ({
            ...data,
            customLists: data.customLists.map(l => {
                if (l.id === listId) {
                    return { ...l, items: l.items.filter(item => !item.completed) };
                }
                return l;
            })
        }));
    };
    
    const setTodoSortOrder = (order: TodoSortOrder) => {
      return performAction(`Tâches triées par ${order}.`, (data) => ({
        ...data,
        todoSortOrder: order
      }));
    };

    // FIX: Add bulk selection actions
    const deleteSelectedItems = () => {
        if (!selection.isActive || selectedIds.size === 0) return null;
        const message = `${selectedIds.size} élément(s) supprimé(s).`;
        const result = performAction(message, (data) => {
            const itemType = selection.type;
            const listId = selection.listId;
            let newData = { ...data };

            if (itemType === 'todos') {
                newData.todos = data.todos.filter(item => !selectedIds.has(item.id));
            } else if (itemType === 'shopping') {
                newData.shoppingList = data.shoppingList.filter(item => !selectedIds.has(item.id));
            } else if (itemType === 'notes') {
                newData.notes = data.notes.filter(item => !selectedIds.has(item.id));
            } else if (itemType === 'custom' && listId) {
                newData.customLists = data.customLists.map(l =>
                    l.id === listId ? { ...l, items: l.items.filter(item => !selectedIds.has(item.id)) } : l
                );
            }

            // Unlink from projects
            newData.projects = newData.projects.map(p => {
                const newLinkedIds = { ...p.linkedItemIds };
                if (itemType === 'todos') {
                    newLinkedIds.todoIds = newLinkedIds.todoIds.filter(id => !selectedIds.has(id));
                } else if (itemType === 'shopping') {
                    newLinkedIds.shoppingItemIds = newLinkedIds.shoppingItemIds.filter(id => !selectedIds.has(id));
                } else if (itemType === 'notes') {
                    newLinkedIds.noteIds = newLinkedIds.noteIds.filter(id => !selectedIds.has(id));
                } else if (itemType === 'custom') {
                    const newCustomIds = { ...newLinkedIds.customListItemIds };
                    selectedIds.forEach(id => delete newCustomIds[id]);
                    newLinkedIds.customListItemIds = newCustomIds;
                }
                return { ...p, linkedItemIds: newLinkedIds };
            });

            return newData;
        });
        endSelectionMode();
        return result;
    };

    const toggleSelectedItemsCompleted = () => {
        if (!selection.isActive || selectedIds.size === 0 || selection.type === 'notes') return null;
        const message = `${selectedIds.size} élément(s) mis à jour.`;

        const result = performAction(message, (data) => {
            const itemType = selection.type;
            const listId = selection.listId;
            let newData = { ...data };

            // Determine if we should mark as complete or incomplete
            let targetState: boolean | null = null;
            let firstItem: { completed: boolean } | undefined;
            if (itemType === 'todos') firstItem = data.todos.find(i => selectedIds.has(i.id));
            else if (itemType === 'shopping') firstItem = data.shoppingList.find(i => selectedIds.has(i.id));
            else if (itemType === 'custom' && listId) firstItem = data.customLists.find(l => l.id === listId)?.items.find(i => selectedIds.has(i.id));

            if (firstItem) {
                targetState = !firstItem.completed;
            }

            if (targetState === null) return data;

            const toggle = (item: any) => selectedIds.has(item.id) ? { ...item, completed: targetState } : item;

            if (itemType === 'todos') newData.todos = data.todos.map(toggle);
            else if (itemType === 'shopping') newData.shoppingList = data.shoppingList.map(toggle);
            else if (itemType === 'custom' && listId) {
                newData.customLists = data.customLists.map(l =>
                    l.id === listId ? { ...l, items: l.items.map(toggle) } : l
                );
            }
            return newData;
        });
        endSelectionMode();
        return result;
    };

    const linkSelectedItemsToProject = (projectId: string) => {
        if (!selection.isActive || selectedIds.size === 0) return null;
        const itemType = selection.type;

        const result = performAction(`${selectedIds.size} élément(s) lié(s) au projet.`, (data) => {
            let newData = { ...data };
            const updateItemProjectId = (item: any) => selectedIds.has(item.id) ? { ...item, projectId } : item;

            const newProjects = data.projects.map(p => {
                let newLinkedIds = { ...p.linkedItemIds };
                // Remove from all projects first
                if (itemType === 'todos') newLinkedIds.todoIds = newLinkedIds.todoIds.filter(id => !selectedIds.has(id));
                else if (itemType === 'shopping') newLinkedIds.shoppingItemIds = newLinkedIds.shoppingItemIds.filter(id => !selectedIds.has(id));
                else if (itemType === 'notes') newLinkedIds.noteIds = newLinkedIds.noteIds.filter(id => !selectedIds.has(id));
                else if (itemType === 'custom') {
                    const customIds = { ...newLinkedIds.customListItemIds };
                    selectedIds.forEach(id => delete customIds[id]);
                    newLinkedIds.customListItemIds = customIds;
                }

                // Add to target project
                if (p.id === projectId) {
                    const idsToAdd = Array.from(selectedIds);
                    if (itemType === 'todos') newLinkedIds.todoIds = [...new Set([...newLinkedIds.todoIds, ...idsToAdd])];
                    else if (itemType === 'shopping') newLinkedIds.shoppingItemIds = [...new Set([...newLinkedIds.shoppingItemIds, ...idsToAdd])];
                    else if (itemType === 'notes') newLinkedIds.noteIds = [...new Set([...newLinkedIds.noteIds, ...idsToAdd])];
                    else if (itemType === 'custom' && selection.listId) {
                        idsToAdd.forEach(id => { newLinkedIds.customListItemIds[id] = selection.listId!; });
                    }
                }
                return { ...p, linkedItemIds: newLinkedIds };
            });

            if (itemType === 'todos') newData.todos = data.todos.map(updateItemProjectId);
            else if (itemType === 'shopping') newData.shoppingList = data.shoppingList.map(updateItemProjectId);
            else if (itemType === 'notes') newData.notes = data.notes.map(updateItemProjectId);
            else if (itemType === 'custom' && selection.listId) {
                newData.customLists = data.customLists.map(l => l.id === selection.listId ? { ...l, items: l.items.map(updateItemProjectId) } : l);
            }

            newData.projects = newProjects;
            return newData;
        });
        endSelectionMode();
        return result;
    };
    
    const moveSelectedItems = (destType: ListType, destListId?: string) => {
        if (!selection.isActive || selectedIds.size === 0) return null;
        const sourceType = selection.type;
        const sourceListId = selection.listId;

        const result = performAction(`${selectedIds.size} élément(s) déplacé(s).`, (data) => {
            let newData = { ...data };
            let itemsToMove: any[] = [];
            
            // 1. Get items to move and remove from source
            if (sourceType === 'todos') {
                itemsToMove = data.todos.filter(i => selectedIds.has(i.id));
                newData.todos = data.todos.filter(i => !selectedIds.has(i.id));
            } else if (sourceType === 'shopping') {
                itemsToMove = data.shoppingList.filter(i => selectedIds.has(i.id));
                newData.shoppingList = data.shoppingList.filter(i => !selectedIds.has(i.id));
            } else if (sourceType === 'notes') {
                itemsToMove = data.notes.filter(i => selectedIds.has(i.id));
                newData.notes = data.notes.filter(i => !selectedIds.has(i.id));
            } else if (sourceType === 'custom' && sourceListId) {
                const list = data.customLists.find(l => l.id === sourceListId);
                if (list) {
                    itemsToMove = list.items.filter(i => selectedIds.has(i.id));
                    newData.customLists = data.customLists.map(l => l.id === sourceListId ? { ...l, items: l.items.filter(i => !selectedIds.has(i.id)) } : l);
                }
            }

            // 2. Add to destination
            itemsToMove.forEach(content => {
                const newId = crypto.randomUUID();
                const textContent = content.task || content.item || content.text || content.content || 'Untitled';

                if (destType === 'todos') {
                    const newTodo: TodoItem = { id: newId, task: textContent, completed: content.completed, priority: (content.priority as Priority) || Priority.Medium, description: content.description || '', subtasks: content.subtasks || [], dueDate: content.dueDate || null, projectId: content.projectId || null };
                    newData.todos = [newTodo, ...newData.todos];
                } else if (destType === 'shopping') {
                    const newShoppingItem: ShoppingItem = { id: newId, item: textContent, completed: content.completed, projectId: content.projectId || null };
                    newData.shoppingList = [newShoppingItem, ...newData.shoppingList];
                } else if (destType === 'notes') {
                    const newNote: NoteItem = { id: newId, content: textContent, projectId: content.projectId || null, history: [] };
                    newData.notes = [newNote, ...newData.notes];
                } else if (destType === 'custom' && destListId) {
                    const newItem: GenericItem = { id: newId, text: textContent, completed: content.completed, customFields: content.customFields || {}, projectId: content.projectId || null };
                    newData.customLists = newData.customLists.map(l => l.id === destListId ? { ...l, items: [newItem, ...l.items] } : l);
                }
            });
            
            return newData;
        });
        endSelectionMode();
        return result;
    };
    
    const setSelectedItemsPriority = (priority: Priority) => {
        if (selection.type !== 'todos' || selectedIds.size === 0) return null;
        const result = performAction(`${selectedIds.size} tâche(s) mise(s) à jour avec la priorité ${priority}.`, (data) => ({
            ...data,
            todos: data.todos.map(t => selectedIds.has(t.id) ? { ...t, priority } : t)
        }));
        endSelectionMode();
        return result;
    };
    
    const setSelectedItemsDueDate = (dueDate: string | null) => {
        if (selection.type !== 'todos' || selectedIds.size === 0) return null;
        const result = performAction(`${selectedIds.size} tâche(s) mise(s) à jour avec une nouvelle date limite.`, (data) => ({
            ...data,
            todos: data.todos.map(t => selectedIds.has(t.id) ? { ...t, dueDate } : t)
        }));
        endSelectionMode();
        return result;
    };

    const setSelectedShoppingItemsStore = (store: string) => {
        if (selection.type !== 'shopping' || selectedIds.size === 0) return null;
        const result = performAction(`${selectedIds.size} article(s) assigné(s) au magasin ${store}.`, (data) => ({
            ...data,
            shoppingList: data.shoppingList.map(i => selectedIds.has(i.id) ? { ...i, store } : i)
        }));
        endSelectionMode();
        return result;
    };
    
    const mergeSelectedNotes = () => {
        if (selection.type !== 'notes' || selectedIds.size < 2) return null;
        
        const result = performAction(`${selectedIds.size} notes fusionnées.`, (data) => {
            const notesToMerge = data.notes.filter(n => selectedIds.has(n.id));
            if (notesToMerge.length < 2) return data;

            const mergedContent = notesToMerge.map(n => n.content).join('<hr>');
            const newNote: NoteItem = { id: crypto.randomUUID(), content: mergedContent, projectId: null, history: [] };
            
            const remainingNotes = data.notes.filter(n => !selectedIds.has(n.id));
            
            return {
                ...data,
                notes: [newNote, ...remainingNotes],
                projects: data.projects.map(p => ({
                    ...p,
                    linkedItemIds: {
                        ...p.linkedItemIds,
                        noteIds: p.linkedItemIds.noteIds.filter(id => !selectedIds.has(id)),
                    }
                }))
            };
        });

        endSelectionMode();
        return result;
    };

    return {
        ...appData,
        voiceSettings,
        updateVoiceSettings,
        setDefaultCalendarId,
        updateVisibleCalendars,
        setTodos: (todos: TodoItem[]) => performAction("Tâches mises à jour.", (data) => ({ ...data, todos })),
        setShoppingList: (shoppingList: ShoppingItem[]) => performAction("Liste de courses mise à jour.", (data) => ({ ...data, shoppingList })),
        setNotes: (notes: NoteItem[]) => performAction("Notes mises à jour.", (data) => ({ ...data, notes })),
        setCustomLists: (customLists: CustomList[]) => performAction("Listes personnalisées mises à jour.", (data) => ({ ...data, customLists })),
        setProjects: (projects: Project[]) => performAction("Projets mis à jour.", (data) => ({ ...data, projects })),
        setTodoSortOrder,
        addTodo, addShoppingItem, addNote, addProject, deleteProject, updateProjectLinks, updateProjectVisibility,
        handleToggleTodo, handleDeleteTodo, editTodo, editTodoPriority, editTodoDescription, addTodoSubtask, toggleTodoSubtask, deleteTodoSubtask, editTodoSubtask, editTodoDueDate,
        handleToggleShoppingItem, handleDeleteShoppingItem, editShoppingItem, editShoppingItemDetails,
        handleDeleteNote, editNote, revertNoteToVersion,
        addCustomList, deleteCustomList, addCustomListItem,
        deleteCustomListItem, toggleCustomListItem, editCustomListItemDetails,
        reorderTodos, reorderShoppingList, reorderNotes, reorderCustomListItems, moveItem,
        fileInputRef, handleExportData, handleImportClick, handleFileChange,
        importConfirmationFile, confirmImport, cancelImport,
        activeFilter, setActiveFilter, clearFilter: () => setActiveFilter(null),
        duplicateConfirmation, processAdditionQueue, confirmDuplicateAdd, clearDuplicateConfirmation,
        findDuplicateForItem,
        forceSync,
        history, undoLastAction,
        deleteCompletedTodos, deleteCompletedShoppingItems, deleteCompletedCustomListItems,
        findProjectByName, linkItemToProject, unlinkItemFromProject,
        moveItemByNameAndList,
        // FIX: Export selection state and functions
        selection,
        selectedIds,
        startSelectionMode,
        endSelectionMode,
        toggleItemSelected,
        selectAllInList,
        clearSelection,
        deleteSelectedItems,
        toggleSelectedItemsCompleted,
        linkSelectedItemsToProject,
        moveSelectedItems,
        setSelectedItemsPriority,
        setSelectedItemsDueDate,
        setSelectedShoppingItemsStore,
        mergeSelectedNotes,
    };
};