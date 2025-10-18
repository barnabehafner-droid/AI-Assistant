import { useState, useRef, useEffect, useCallback } from 'react';
import { LiveServerMessage } from '@google/genai';
import { findBestMatch, levenshteinDistance } from '../utils/fuzzyMatching';
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
import { useOrganizerState } from './useOrganizerState';
import { useAuth } from './useAuth';
import { TodoItem, ShoppingItem, NoteItem, CustomList, SubtaskItem, GenericItem, Project, VoiceSettings, CalendarEvent, FullEmail, Contact, EmailData, WeatherData } from '../types';
import { useLiveAudioSession } from './useLiveAudioSession';

import { ToolHandler, ToolHandlerContext } from './toolHandlers/types';
import { createUtilityHandlers } from './toolHandlers/utilityHandlers';
import { createCalendarHandlers } from './toolHandlers/calendarHandlers';
import { createGmailHandlers } from './toolHandlers/gmailHandlers';
import { createProjectHandlers } from './toolHandlers/projectHandlers';
import { createListHandlers } from './toolHandlers/listHandlers';

type OrganizerProps = ReturnType<typeof useOrganizerState>;

export interface SummaryData {
    weather: WeatherData | null;
    unreadEmails: FullEmail[];
    events: CalendarEvent[];
    urgentTasks: TodoItem[];
    recentNotes: NoteItem[];
    fitness: any;
}

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
    setEmailToCompose: (email: EmailData | null) => void,
    setIsEmailComposerOpen: (isOpen: boolean) => void,
) => {
    const [lastActionItem, setLastActionItem] = useState<{ id: string; trigger: number } | null>(null);
    const [itemToOpenDetailsFor, setItemToOpenDetailsFor] = useState<{ type: any; id: string; listId?: string } | null>(null);
    const [projectToNavigateTo, setProjectToNavigateTo] = useState<string | null>(null);
    const [pendingDuplicate, setPendingDuplicate] = useState<{ type: any; content: any; listId?: string } | null>(null);
    
    const latestSearchResultsRef = useRef<FullEmail[]>([]);
    const [restartPending, setRestartPending] = useState(false);
    const restartNeededAfterTurnRef = useRef(false);

    const defaultCalendarIdRef = useRef(defaultCalendarId);
    useEffect(() => {
        defaultCalendarIdRef.current = defaultCalendarId;
    }, [defaultCalendarId]);
    
    const triggerHighlight = (id: string | undefined) => {
        if (id) {
            setLastActionItem({ id, trigger: Date.now() });
        }
    };
    
    // --- Finder Functions ---
    const findBestMatchingTodo = useCallback((query: string): TodoItem | null => findBestMatch(organizer.todos, query, 'task', 0.6), [organizer.todos]);
    const findBestMatchingNote = useCallback((query: string): NoteItem | null => findBestMatch(organizer.notes, query, 'content', 0.7), [organizer.notes]);
    const findBestMatchingShoppingItem = useCallback((query: string): ShoppingItem | null => findBestMatch(organizer.shoppingList, query, 'item', 0.6), [organizer.shoppingList]);
    const findBestMatchingSubtask = useCallback((query: string, subtasks: SubtaskItem[]): SubtaskItem | null => findBestMatch(subtasks, query, 'text', 0.6), []);
    const findBestMatchingList = useCallback((query: string): CustomList | null => findBestMatch(organizer.customLists, query, 'title', 0.5), [organizer.customLists]);
    const findBestMatchingCustomListItem = useCallback((list: CustomList, itemName: string): GenericItem | null => list ? findBestMatch(list.items, itemName, 'text', 0.6) : null, []);
    const findBestMatchingItem = useCallback((query: string): { id: string, type: any, listId?: string, text: string } | null => {
        const { todos, shoppingList, notes, customLists } = organizer;
        const allItems = [
            ...todos.map(i => ({ id: i.id, type: 'todos', listId: undefined, text: i.task })),
            ...shoppingList.map(i => ({ id: i.id, type: 'shopping', listId: undefined, text: i.item })),
            ...notes.map(i => ({ id: i.id, type: 'notes', listId: undefined, text: i.content })),
            ...customLists.flatMap(l => l.items.map(i => ({ id: i.id, type: 'custom', listId: l.id, text: i.text })))
        ];
        return findBestMatch(allItems, query, 'text', 0.6);
    }, [organizer]);
    const findBestMatchingContact = useCallback((name: string): Contact | null => findBestMatch(contacts, name, 'displayName', 0.6), [contacts]);
    const resolveEmailIdentifier = useCallback((identifier: string): FullEmail | null => {
        const results = latestSearchResultsRef.current;
        if (!results || results.length === 0) return null;
        const lowerIdentifier = identifier.toLowerCase();
        const ordinals: { [key: string]: number } = { 'premier': 0, 'deuxième': 1, 'troisième': 2 };
        if (lowerIdentifier in ordinals) return results[ordinals[lowerIdentifier]];
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
    }, []);

    // --- Tool Handlers Setup ---
    const toolHandlerContext: ToolHandlerContext = {
        organizer, auth, refreshCalendar, defaultCalendarIdRef, calendarEvents, contacts,
        latestSearchResultsRef, restartNeededAfterTurnRef,
        setEmailSearchResults, setIsEmailSearchModalOpen, setSelectedEmail, setEmailToCompose, setIsEmailComposerOpen,
        setPendingDuplicate, setItemToOpenDetailsFor, setProjectToNavigateTo,
        triggerHighlight, findBestMatchingTodo, findBestMatchingNote, findBestMatchingShoppingItem, findBestMatchingSubtask,
        findBestMatchingList, findBestMatchingCustomListItem, findBestMatchingItem, findBestMatchingContact, resolveEmailIdentifier,
        pendingDuplicate, currentProjectId
    };

    const toolHandlers: Record<string, ToolHandler> = {
        ...createUtilityHandlers(toolHandlerContext),
        ...createCalendarHandlers(toolHandlerContext),
        ...createGmailHandlers(toolHandlerContext),
        ...createProjectHandlers(toolHandlerContext),
        ...createListHandlers(toolHandlerContext),
    };

    const handleToolCall = useCallback(async (functionCalls: NonNullable<LiveServerMessage['toolCall']>['functionCalls']) => {
        for (const fc of functionCalls) {
            const handler = toolHandlers[fc.name];
            let result: string;

            if (handler) {
                try {
                    // Await both sync and async handlers
                    result = await Promise.resolve(handler(fc.args));
                } catch (error) {
                    console.error(`Error executing tool ${fc.name}:`, error);
                    result = `Désolé, une erreur est survenue lors de l'exécution de la commande.`;
                }
            } else {
                result = `Fonction ${fc.name} non implémentée.`;
            }
            
            sessionPromise?.then(session => {
                session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } });
            });
        }
    }, [toolHandlers]); // Dependencies are now encapsulated in toolHandlers

    // --- System Instruction Setup ---
    const { projects, todos, shoppingList, notes, customLists } = organizer;
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
    
    // --- Live Session Management ---
    const { status: chatStatus, isAiSpeaking, error: chatError, startSession, stopSession, sessionPromise, audioContext, mediaStream } = useLiveAudioSession(
        {
            systemInstruction,
            tools: baseFunctionDeclarations,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } } },
            enableTranscription: true,
        },
        {
            onToolCall: handleToolCall,
            onTurnComplete: () => { if (restartNeededAfterTurnRef.current) { restartNeededAfterTurnRef.current = false; setRestartPending(true); } },
            onError: () => { setRestartPending(false); },
        }
    );
    
    const handleChatToggle = () => {
        if (!auth.isLoggedIn) { auth.signIn(); return; }
        if (chatStatus === 'idle' || chatStatus === 'error') {
            setPendingDuplicate(null);
            startSession();
        } else {
            stopSession();
        }
    };
    
    const startSummarySession = useCallback((data: SummaryData) => {
        let summaryParts: string[] = [];
        if (data.weather) summaryParts.push(`À ${data.weather.location}, il fait actuellement ${data.weather.temperature} degrés avec un ciel ${data.weather.condition}.`);
        if (data.unreadEmails.length > 0) summaryParts.push(`Vous avez ${data.unreadEmails.length} e-mail${data.unreadEmails.length > 1 ? 's' : ''} non lu${data.unreadEmails.length > 1 ? 's' : ''}.`);
        if (data.events.length > 0) summaryParts.push(`Aujourd'hui, votre agenda contient : ${data.events.map(e => e.summary).join(', ')}.`);
        if (data.urgentTasks.length > 0) summaryParts.push(`Vous avez ${data.urgentTasks.length} tâche${data.urgentTasks.length > 1 ? 's' : ''} urgente${data.urgentTasks.length > 1 ? 's' : ''} à faire.`);
        if (data.recentNotes.length > 0) summaryParts.push(`Vous avez récemment travaillé sur quelques notes.`);
        if (data.fitness) summaryParts.push(`Côté activité, vous avez fait environ ${data.fitness.steps} pas aujourd'hui.`);

        let summaryText = `Bonjour ${voiceSettings.userName || ''} ! Voici votre résumé du jour. `;
        summaryText += summaryParts.length > 0 ? summaryParts.join(' ') : "Tout semble calme pour le moment. ";
        summaryText += " Que souhaitez-vous faire en premier ?";
        startSession(summaryText);
    }, [startSession, voiceSettings.userName]);
    
    useEffect(() => {
        if (restartPending) {
            setRestartPending(false);
            const restart = async () => {
                await stopSession();
                await new Promise(resolve => setTimeout(resolve, 50));
                await startSession();
            };
            restart();
        }
    }, [restartPending, startSession, stopSession]);

    return {
        chatStatus,
        chatError,
        handleChatToggle,
        startSummarySession,
        audioContext,
        mediaStream,
        isAiSpeaking,
        lastActionItem,
        itemToOpenDetailsFor: itemToOpenDetailsFor,
        clearItemToOpen: () => setItemToOpenDetailsFor(null),
        projectToNavigateTo,
        clearProjectToNavigateTo: () => setProjectToNavigateTo(null),
    };
};
