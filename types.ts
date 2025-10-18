// types.ts
import { LiveServerMessage } from '@google/genai';

// Custom error for handling token expiration
export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}


// FIX: This type was defined in a hook, but is needed globally.
export type DragItemInfo = {
    id: string;
    type: 'todos' | 'shopping' | 'notes' | 'custom' | 'email' | 'group';
    listId?: string;
    content: any;
};

// FIX: Define TodoSortOrder here to avoid circular dependency.
export type TodoSortOrder = 'priority' | 'dueDate' | 'alphabetical';
export type ShoppingSortOrder = 'default' | 'store';

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

export interface InfoCard {
  type: 'PHONE' | 'ADDRESS' | 'WEBSITE' | 'HOURS' | 'RECIPE_INGREDIENTS' | 'RECIPE_STEPS' | 'GENERIC_TEXT';
  label: string;
  content: string | string[];
}

export interface EnrichmentMetadata {
    query: string;
    sources: { uri: string; title: string }[];
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
  enrichedData?: InfoCard[] | null;
  enrichmentMetadata?: EnrichmentMetadata | null;
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
  category?: string;
  aisle?: string;
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
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
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
  shopping: Omit<ShoppingItem, 'id' | 'quantity' | 'unit' | 'store' | 'description' | 'projectId' | 'category' | 'aisle'>[];
  notes: Omit<NoteItem, 'id' | 'projectId' | 'history'>[];
  events?: {
      summary: string;
      start: { dateTime: string };
      end: { dateTime: string };
      location?: string;
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

export interface SummarySettings {
  includeWeather: boolean;
  includeUnreadEmails: boolean;
  includeEvents: boolean;
  includeUrgentTasks: boolean;
  includeRecentNotes: boolean;
  includeFitness: boolean;
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
  summarySettings?: SummarySettings;
  location?: string;
  hapticFeedbackEnabled?: boolean;
  transportMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}

// Data structure for the entire application state for export/import
export interface AppData {
    todos: TodoItem[];
    shoppingList: ShoppingItem[];
    notes: NoteItem[];
    customLists: CustomList[];
    projects: Project[];
    todoSortOrder: TodoSortOrder;
    shoppingSortOrder: ShoppingSortOrder;
    lastModified: string | null;
    voiceSettings: VoiceSettings;
    defaultCalendarId: string | null;
    visibleCalendarIds: string[];
    widgetOrders: {
        desktop: string[];
        mobile: string[];
    };
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
  picture?: string;
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
    location?: string;
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
export interface Attachment {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
    messageId: string;
}

export interface FullEmail {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    bodyHtml: string;
    bodyText: string;
    isRead: boolean;
    date: string;
    labelIds?: string[];
    attachments?: Attachment[];
    messageId?: string;
    references?: string;
    inReplyTo?: string;
}

export interface GmailLabel {
    id: string;
    name: string;
    type: 'system' | 'user';
}

// A summary of a conversation thread for the list view
export interface GmailThread {
    id: string;
    snippet: string;
    historyId: string;
    subject: string;
    participants: string[];
    messageCount: number;
    lastMessageDate: string;
    isUnread: boolean;
}

// A summary of all conversations with a single contact
export interface GmailContactConversation {
    name: string;
    email: string;
    snippet: string;
    lastMessageDate: string;
    isUnread: boolean;
    picture?: string;
    isUnsubscribable?: boolean;
    unsubscribeLink?: string;
    threadId: string;
}


// --- Weather Data ---
export interface WeatherData {
    temperature: number;
    condition: string;
    location: string;
}

// FIX: Define and export EmailData interface for use in composer and hooks.
export interface EmailData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}
// FIX: Define AllItemTypes here for use in multiple files.
export type AllItemTypes = 'todos' | 'shopping' | 'notes' | 'custom' | 'email' | 'event';

// --- Queued Item for batch processing
export interface QueuedItem {
    type: 'todos' | 'shopping' | 'notes' | 'custom';
    content: any;
    listId?: string;
}

// --- Live Chat Types ---
export type ChatStatus = 'idle' | 'connecting' | 'listening' | 'error';
export type ConversationMessage = {
    speaker: 'user' | 'ai';
    text: string;
};
export interface LiveSessionCallbacks {
    onToolCall?: (functionCalls: NonNullable<LiveServerMessage['toolCall']>['functionCalls']) => void;
    onTranscriptionUpdate?: (input: string, output: string) => void;
    onTurnComplete?: (fullInput: string, fullOutput: string) => void;
    onError?: (error: ErrorEvent) => void;
    onClose?: () => void;
}

// --- Directions Types ---
export interface DirectionsStep {
  instructions: string;
  duration: string;
  travel_mode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}

export interface DirectionsInfo {
  duration: string;
  durationInSeconds?: number;
  summary: string;
  steps: DirectionsStep[];
}

// --- Google Drive File Type ---
export interface GoogleDriveFile {
    id: string;
    name: string;
}