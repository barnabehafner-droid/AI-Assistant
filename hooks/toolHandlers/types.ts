import { RefObject, Dispatch, SetStateAction } from 'react';
import { useOrganizerState } from '../useOrganizerState';
import { useAuth } from '../useAuth';
import { CalendarEvent, Contact, CustomList, EmailData, FullEmail, GenericItem, NoteItem, ShoppingItem, SubtaskItem, TodoItem } from '../../types';

// Ce contexte fournit toutes les dépendances nécessaires aux gestionnaires d'outils.
export type ToolHandlerContext = {
    // Services et état externe
    organizer: ReturnType<typeof useOrganizerState>;
    auth: ReturnType<typeof useAuth>;
    refreshCalendar: () => void;
    defaultCalendarIdRef: RefObject<string | null>;
    calendarEvents: CalendarEvent[];
    contacts: Contact[];
    
    // Références à l'état du parent
    latestSearchResultsRef: RefObject<FullEmail[]>;
    restartNeededAfterTurnRef: RefObject<boolean>;

    // Setters d'état du hook parent
    setEmailSearchResults: (emails: FullEmail[]) => void;
    setIsEmailSearchModalOpen: (isOpen: boolean) => void;
    setSelectedEmail: (email: FullEmail | null) => void;
    setEmailToCompose: (email: EmailData | null) => void;
    setIsEmailComposerOpen: (isOpen: boolean) => void;
    setPendingDuplicate: Dispatch<SetStateAction<{ type: any; content: any; listId?: string; } | null>>;
    setItemToOpenDetailsFor: Dispatch<SetStateAction<{ type: any; id: string; listId?: string; } | null>>;
    setProjectToNavigateTo: Dispatch<SetStateAction<string | null>>;

    // Fonctions utilitaires passées du parent
    triggerHighlight: (id: string | undefined) => void;
    findBestMatchingTodo: (query: string) => TodoItem | null;
    findBestMatchingNote: (query: string) => NoteItem | null;
    findBestMatchingShoppingItem: (query: string) => ShoppingItem | null;
    findBestMatchingSubtask: (query: string, subtasks: SubtaskItem[]) => SubtaskItem | null;
    findBestMatchingList: (query: string) => CustomList | null;
    findBestMatchingCustomListItem: (list: CustomList, itemName: string) => GenericItem | null;
    findBestMatchingItem: (query: string) => { id: string; type: any; listId?: string; text: string } | null;
    findBestMatchingContact: (name: string) => Contact | null;
    resolveEmailIdentifier: (identifier: string) => FullEmail | null;
    
    // Pour la gestion des doublons
    pendingDuplicate: { type: any; content: any; listId?: string; } | null;
    currentProjectId: string | null;
};

// Un gestionnaire d'outil peut être synchrone ou asynchrone et retourne un résultat en chaîne de caractères pour l'IA.
export type ToolHandler = (args: any) => Promise<string> | string;