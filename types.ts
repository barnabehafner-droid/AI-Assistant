import { DragItemInfo } from './hooks/useOrganizerState';
// FIX: Define TodoSortOrder here to avoid circular dependency.
export type TodoSortOrder = 'priority' | 'dueDate' | 'alphabetical';

export enum Priority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface SubtaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TodoItem {
  id: string;
  task: string;
  completed: boolean;
  priority: Priority;
  description: string;
  subtasks: SubtaskItem[];
  dueDate?: string | null;
  projectId?: string | null;
}

export enum ShoppingUnit {
    Unit = 'unit',
    Kg = 'kg',
    L = 'L',
}

export interface ShoppingItem {
  id: string;
  item: string;
  completed: boolean;
  quantity?: number | null;
  unit?: ShoppingUnit | null;
  store?: string;
  description?: string;
  projectId?: string | null;
}

export interface NoteHistoryEntry {
  content: string;
  timestamp: string;
}

export interface NoteItem {
  id: string;
  content: string;
  projectId?: string | null;
  history?: NoteHistoryEntry[];
}

export interface CustomListField {
  id: string;
  name: string;
}

export interface GenericItem {
  id: string;
  text: string;
  completed: boolean;
  description?: string;
  projectId?: string | null;
  customFields: Record<string, string>;
}

export interface CustomList {
  id: string;
  title: string;
  items: GenericItem[];
  fields: CustomListField[];
}

export interface OrganizedData {
  todos: Omit<TodoItem, 'id' | 'description' | 'subtasks' | 'projectId'>[];
  shopping: Omit<ShoppingItem, 'id' | 'quantity' | 'unit' | 'store' | 'description' | 'projectId'>[];
  notes: Omit<NoteItem, 'id' | 'projectId' | 'history'>[];
  events?: {
      summary: string;
      start: { dateTime: string };
      end: { dateTime: string };
  }[];
  [key: string]: any; // Allow for custom lists
}

export interface Project {
  id: string;
  title: string;
  description: string;
  isHiddenInMainView?: boolean;
  hiddenItemTypes?: {
    todos?: boolean;
    shopping?: boolean;
    notes?: boolean;
    customLists?: boolean;
  };
  linkedItemIds: {
    todoIds: string[];
    shoppingItemIds: string[];
    noteIds: string[];
    // Key: itemId, Value: listId
    customListItemIds: Record<string, string>;
    linkedEventIds?: string[];
    linkedEmailIds?: string[];
  };
}

export interface VoiceSettings {
  voiceName: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
  tone: number; // -1 (Ludique) to 1 (Sérieux)
  proactivity: number; // -1 (Réactif) to 1 (Proactif)
  verbosity: number; // -1 (Concise) to 1 (Détaillé)
  customInstruction: string;
  formality: 'tutoiement' | 'vouvoiement';
  userName: string;
  writingStyle?: string;
}

// Data structure for the entire application state for export/import
export interface AppData {
    todos: TodoItem[];
    shoppingList: ShoppingItem[];
    notes: NoteItem[];
    customLists: CustomList[];
    projects: Project[];
    todoSortOrder: TodoSortOrder;
    lastModified: string | null;
    voiceSettings: VoiceSettings;
    defaultCalendarId: string | null;
    visibleCalendarIds: string[];
}

export interface FilterState {
  listType: 'todos' | 'shopping' | 'custom';
  listId?: string; // Only for custom lists
  criteria: string;
  itemIds: Set<string>;
}

export interface SelectionState {
  isActive: boolean;
  type: 'todos' | 'shopping' | 'custom' | 'notes' | null;
  listId?: string | null;
}


export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  given_name: string;
  family_name: string;
}

// --- Google Contact Types ---
export interface Contact {
  resourceName: string;
  displayName: string;
  email: string;
}

// --- Google Calendar Types ---
export interface GoogleCalendar {
    id: string;
    summary: string;
    backgroundColor: string;
    primary?: boolean;
}

export interface EventDateTime {
    dateTime?: string; // e.g., '2024-08-21T10:00:00-07:00'
    date?: string;     // e.g., '2024-08-21' for all-day events
    timeZone?: string;
}

export interface EventReminder {
    method: 'popup' | 'email';
    minutes: number;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: EventDateTime;
    end: EventDateTime;
    calendarId?: string;
    backgroundColor?: string; // For UI
    reminders?: {
        useDefault: boolean;
        overrides?: EventReminder[];
    };
    etag?: string; // For updates
}

// --- Google Mail Types ---
export interface FullEmail {
    id: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    body: string;
    isRead: boolean;
    aiSummary?: string;
    labelIds?: string[];
}
// FIX: Define and export EmailData interface for use in composer and hooks.
export interface EmailData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}
// FIX: Define AllItemTypes here for use in multiple files.
export type AllItemTypes = 'todos' | 'shopping' | 'notes' | 'custom' | 'email' | 'event';