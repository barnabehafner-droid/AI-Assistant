import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { ai } from '../services/aiClient';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { buildSystemInstruction } from '../services/aiConfig';
import { useOrganizerState } from './useOrganizerState';
import { VoiceSettings, Contact, EmailData, CalendarEvent, ShoppingItem, Priority, CustomList } from '../types';
import { getCurrentLocation } from '../utils/location';
import { getCityFromCoordinates } from '../services/geminiService';
import * as googlePeopleService from '../services/googlePeopleService';
import * as googleCalendarService from '../services/googleCalendarService';
import { useAuth } from './useAuth';
import { findBestMatch } from '../utils/fuzzyMatching';

type OrganizerProps = ReturnType<typeof useOrganizerState>;

const FRAME_RATE = 1;
const JPEG_QUALITY = 0.7;

export const useVideoChat = (
    organizer: OrganizerProps, 
    voiceSettings: VoiceSettings, 
    auth: ReturnType<typeof useAuth>,
    contacts: Contact[],
    calendarEvents: CalendarEvent[],
    refreshCalendar: () => void,
    setEmailToCompose: (email: EmailData | null) => void,
    setIsEmailComposerOpen: (isOpen: boolean) => void
) => {
    const [isVideoChatActive, setIsVideoChatActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameIntervalRef = useRef<number | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const organizerRef = useRef(organizer);
    useEffect(() => { organizerRef.current = organizer; }, [organizer]);
    
    const authRef = useRef(auth);
    useEffect(() => { authRef.current = auth; }, [auth]);

    const contactsRef = useRef(contacts);
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);

    const calendarEventsRef = useRef(calendarEvents);
    useEffect(() => { calendarEventsRef.current = calendarEvents; }, [calendarEvents]);

    const refreshCalendarRef = useRef(refreshCalendar);
    useEffect(() => { refreshCalendarRef.current = refreshCalendar; }, [refreshCalendar]);

    const findBestMatchingShoppingItem = useCallback((query: string): ShoppingItem | null => findBestMatch(organizerRef.current.shoppingList, query, 'item', 0.6), []);
    const findBestMatchingContact = useCallback((name: string): Contact | null => findBestMatch(contactsRef.current, name, 'displayName', 0.6), []);
    const findBestMatchingList = useCallback((query: string): CustomList | null => findBestMatch(organizerRef.current.customLists, query, 'title', 0.5), []);


    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve(base64data.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const cleanupResources = useCallback(() => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        if (audioSourceNodeRef.current) audioSourceNodeRef.current.disconnect();
        inputAudioContextRef.current?.close().catch(e => console.warn("InputCTX close error:", e));
        outputAudioContextRef.current?.close().catch(e => console.warn("OutputCTX close error:", e));
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        
        sessionPromiseRef.current = null;
        setIsVideoChatActive(false);
        setError(null);
    }, []);

    const stopVideoSession = useCallback(async () => {
        if (!sessionPromiseRef.current) {
             cleanupResources();
             return;
        }
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) {
            console.error("Error closing session, forcing cleanup", e);
            cleanupResources();
        }
    }, [cleanupResources]);

    const startVideoSession = useCallback(async (deviceId?: string) => {
        if (isVideoChatActive) return;
        setError(null);
        setIsVideoChatActive(true);

        try {
            const videoConstraint = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' };
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: true });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
            setCurrentDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId || null);

            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;

            const baseInstruction = `You are a multimodal assistant analyzing a video feed. Your primary goal is to identify text and suggest relevant actions based on user confirmation.

Your process is:
1.  Analyze the video for text.
2.  Based on the text content, identify its nature (a shopping receipt, a new list, contact info, event details, generic text).
3.  Suggest a single, most relevant action to the user. DO NOT perform the action until the user agrees.
    - If you see a **shopping receipt**, ask: 'I see a receipt. Do you want me to check these off your shopping list?' If they say yes, use the \`checkOffShoppingListItems\` tool.
    - If you see a **new list of items** (not a receipt), ask: 'I see a list. Should I add these items to an existing list like "Tâches" or "Courses", or create a new list for them? I could name it [Suggest a title based on content].'
        - If they want to add to an existing list, ask for the list name and then use the \`addItemsToList\` tool.
        - If they want to create a new list, confirm the title and then use the \`createNewCustomList\` tool.
    - If you see contact information (name, email, phone), ask: 'This looks like contact information. Do you want to create a new contact?' If yes, use the \`createContactFromDetails\` tool.
    - If you see event details (date, time, location, summary), ask: 'This looks like an event. Do you want to add it to your calendar?' If yes, you MUST first use \`checkForCalendarConflicts\`. If there's a conflict, inform the user. If there is no conflict or the user confirms, use \`createCalendarEvent\`.
    - If you see a block of text that could be an email, ask: 'Do you want to create a new email with this content?' If yes, use the \`createEmailFromText\` tool.
    - If none of the above apply, default to the note-taking behavior: summarize the text briefly and ask 'Do you want me to add this as a note?'. If yes, use the \`ajouterNoteAvecAnalyse\` tool.

When using tools, you must provide all necessary arguments based on the text you've analyzed.`;
            
            const tools: FunctionDeclaration[] = [
                {
                    name: 'ajouterNoteAvecAnalyse',
                    description: "Ajoute une note avec le texte original et une fiche d'analyse générée par l'IA.",
                    parameters: { type: Type.OBJECT, properties: { texteOriginal: { type: Type.STRING, description: "L'intégralité du texte original et non modifié, formaté en HTML simple." }, ficheAnalyse: { type: Type.STRING, description: "Une fiche d'analyse concise sur les thèmes du texte, formatée en HTML." } }, required: ['texteOriginal', 'ficheAnalyse'] },
                },
                {
                    name: 'checkOffShoppingListItems',
                    description: "Coche les articles d'une liste de courses existante. Ne pas utiliser pour ajouter de nouveaux articles.",
                    parameters: { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, description: "Une liste de noms d'articles à cocher.", items: { type: Type.STRING } } }, required: ['items'] },
                },
                {
                    name: 'createContactFromDetails',
                    description: "Crée un nouveau contact dans le carnet d'adresses de l'utilisateur.",
                    parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Le nom complet de la personne." }, email: { type: Type.STRING, description: "L'adresse e-mail du contact." }, phone: { type: Type.STRING, description: "Le numéro de téléphone du contact." } }, required: ['name'] },
                },
                {
                    name: 'createEmailFromText',
                    description: "Ouvre l'éditeur d'e-mail avec un contenu pré-rempli.",
                    parameters: { type: Type.OBJECT, properties: { recipient: { type: Type.STRING, description: "Optionnel. Le destinataire (nom ou adresse e-mail)." }, subject: { type: Type.STRING, description: "Optionnel. Le sujet de l'e-mail." }, body: { type: Type.STRING, description: "Le contenu principal de l'e-mail." } }, required: ['body'] },
                },
                {
                    name: 'checkForCalendarConflicts',
                    description: "Vérifie s'il existe des événements existants dans l'agenda pendant une plage horaire. DOIT être utilisé AVANT `createCalendarEvent`.",
                    parameters: { type: Type.OBJECT, properties: { startTime: { type: Type.STRING, description: "L'heure de début au format ISO 8601." }, endTime: { type: Type.STRING, description: "L'heure de fin au format ISO 8601." } }, required: ['startTime', 'endTime'] },
                },
                {
                    name: 'createCalendarEvent',
                    description: "Crée un nouvel événement dans l'agenda.",
                    parameters: { type: Type.OBJECT, properties: { summary: { type: Type.STRING, description: "Le titre de l'événement." }, startTime: { type: Type.STRING, description: "L'heure de début au format ISO 8601." }, endTime: { type: Type.STRING, description: "L'heure de fin au format ISO 8601." }, location: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['summary', 'startTime', 'endTime'] },
                },
                {
                    name: 'addItemsToList',
                    description: "Ajoute plusieurs éléments à une liste existante (Tâches, Courses, ou une liste personnalisée).",
                    parameters: { 
                        type: Type.OBJECT, 
                        properties: { 
                            listName: { type: Type.STRING, description: "Le nom de la liste de destination (ex: 'Tâches', 'Courses', 'Idées de cadeaux')." },
                            items: { type: Type.ARRAY, description: "Une liste de noms d'éléments à ajouter.", items: { type: Type.STRING } } 
                        }, 
                        required: ['listName', 'items'] 
                    },
                },
                {
                    name: 'createNewCustomList',
                    description: "Crée une nouvelle liste personnalisée et y ajoute des éléments.",
                    parameters: { 
                        type: Type.OBJECT, 
                        properties: { 
                            title: { type: Type.STRING, description: "Le titre de la nouvelle liste." },
                            items: { type: Type.ARRAY, description: "Une liste de noms d'éléments à ajouter à la nouvelle liste.", items: { type: Type.STRING } } 
                        }, 
                        required: ['title', 'items'] 
                    },
                },
            ];

            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction,
                    tools: [{ functionDeclarations: tools }],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } } },
                },
                callbacks: {
                    onopen: () => {
                        sessionPromise.then(session => session.sendRealtimeInput({ text: "Bonjour ! Montrez-moi le texte que vous voulez que j'analyse." }));
                        
                        const source = inputCtx.createMediaStreamSource(stream);
                        audioSourceNodeRef.current = source;
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;

                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                        
                        if (videoRef.current) {
                            const videoEl = videoRef.current;
                            const canvasEl = canvasRef.current!;
                            const ctx = canvasEl.getContext('2d');
                            if (!ctx) return;
                            
                            frameIntervalRef.current = window.setInterval(() => {
                                if (!videoEl.videoWidth) return;
                                canvasEl.width = videoEl.videoWidth;
                                canvasEl.height = videoEl.videoHeight;
                                ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                                canvasEl.toBlob(async (blob) => {
                                    if (blob) {
                                        const base64Data = await blobToBase64(blob);
                                        sessionPromise.then(session => session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
                                    }
                                }, 'image/jpeg', JPEG_QUALITY);
                            }, 1000 / FRAME_RATE);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                             sessionPromise.then(async session => {
                                for (const fc of message.toolCall.functionCalls) {
                                    let resultText = "Action non reconnue.";
                        
                                    switch (fc.name) {
                                        case 'ajouterNoteAvecAnalyse': {
                                            const { texteOriginal, ficheAnalyse } = fc.args as { texteOriginal: string, ficheAnalyse: string };
                                            const finalContent = `${texteOriginal}<hr>${ficheAnalyse}`;
                                            const location = await getCurrentLocation();
                                            const result = organizerRef.current.addNote(finalContent, null, location);
                                            if (result?.newId && location) {
                                                getCityFromCoordinates(location.latitude, location.longitude)
                                                    .then(address => { if (address && result.newId) organizerRef.current.updateNoteAddress(result.newId, address); })
                                                    .catch(e => console.warn("Impossible d'obtenir l'adresse pour la note.", e));
                                            }
                                            resultText = result?.message || `OK, j'ai ajouté la note avec l'analyse.`;
                                            break;
                                        }
                                        case 'checkOffShoppingListItems': {
                                            const { items } = fc.args as { items: string[] };
                                            const checkedItems: string[] = [];
                                            items.forEach(itemName => {
                                                const match = findBestMatchingShoppingItem(itemName);
                                                if (match && !match.completed) {
                                                    organizerRef.current.handleToggleShoppingItem(match.id);
                                                    checkedItems.push(match.item);
                                                }
                                            });
                                            resultText = checkedItems.length > 0 ? `OK, j'ai coché : ${checkedItems.join(', ')}.` : "Je n'ai trouvé aucun article correspondant à cocher.";
                                            break;
                                        }
                                        case 'createContactFromDetails': {
                                            if (!authRef.current.accessToken) { resultText = "Désolé, vous devez être connecté pour créer un contact."; break; }
                                            const { name, email, phone } = fc.args as { name: string, email?: string, phone?: string };
                                            try {
                                                await googlePeopleService.createContact(authRef.current.accessToken, name, email, phone);
                                                resultText = `OK, j'ai créé le contact "${name}".`;
                                            } catch (e) { resultText = `Désolé, je n'ai pas pu créer le contact.`; console.error(e); }
                                            break;
                                        }
                                        case 'checkForCalendarConflicts': {
                                            const { startTime, endTime } = fc.args as { startTime: string, endTime: string };
                                            const startTimeMs = new Date(startTime).getTime();
                                            const endTimeMs = new Date(endTime).getTime();
                                            const conflictingEvents = calendarEventsRef.current.filter(event => {
                                                const eventStart = new Date(event.start?.dateTime || event.start?.date!).getTime();
                                                const eventEnd = new Date(event.end?.dateTime || event.end?.date!).getTime();
                                                return Math.max(startTimeMs, eventStart) < Math.min(endTimeMs, eventEnd);
                                            });
                                            resultText = conflictingEvents.length > 0 ? `Oui, il y a un conflit avec : ${conflictingEvents.map(e => `"${e.summary}"`).join(', ')}.` : "Non, ce créneau est libre.";
                                            break;
                                        }
                                        case 'createCalendarEvent': {
                                            if (!authRef.current.accessToken) { resultText = "Désolé, vous devez être connecté pour créer un événement."; break; }
                                            const { summary, startTime, endTime, location, description } = fc.args as any;
                                            const calendarId = organizerRef.current.defaultCalendarId || 'primary';
                                            try {
                                                await googleCalendarService.createEvent(authRef.current.accessToken, calendarId, { summary, start: { dateTime: startTime }, end: { dateTime: endTime }, location, description });
                                                refreshCalendarRef.current();
                                                resultText = `OK, j'ai ajouté l'événement "${summary}" à votre agenda.`;
                                            } catch (error) { resultText = "Désolé, une erreur est survenue lors de la création de l'événement."; console.error(error); }
                                            break;
                                        }
                                        case 'createEmailFromText': {
                                            const { recipient, subject, body } = fc.args as { recipient?: string, subject?: string, body: string };
                                            let to = '';
                                            if (recipient) {
                                                const contact = findBestMatchingContact(recipient);
                                                to = contact ? contact.email : recipient;
                                            }
                                            setEmailToCompose({ to, cc: '', bcc: '', subject: subject || '', body: `<p>${body.replace(/\n/g, '<br>')}</p>` });
                                            setIsEmailComposerOpen(true);
                                            resultText = "OK, j'ai ouvert l'éditeur d'e-mail.";
                                            break;
                                        }
                                        case 'addItemsToList': {
                                            const { listName, items } = fc.args as { listName: string; items: string[] };
                                            const list = findBestMatchingList(listName);
                                            let addedCount = 0;
                                            if (listName.toLowerCase().includes('tâche') || listName.toLowerCase().includes('todo')) {
                                                items.forEach(item => {
                                                    organizerRef.current.addTodo(item, Priority.Medium);
                                                    addedCount++;
                                                });
                                                resultText = `OK, j'ai ajouté ${addedCount} élément(s) à votre liste de tâches.`;
                                            } else if (listName.toLowerCase().includes('course') || listName.toLowerCase().includes('shopping')) {
                                                items.forEach(item => {
                                                    organizerRef.current.addShoppingItem(item);
                                                    addedCount++;
                                                });
                                                resultText = `OK, j'ai ajouté ${addedCount} élément(s) à votre liste de courses.`;
                                            } else if (list) {
                                                items.forEach(item => {
                                                    organizerRef.current.addCustomListItem(list.id, item);
                                                    addedCount++;
                                                });
                                                resultText = `OK, j'ai ajouté ${addedCount} élément(s) à votre liste "${list.title}".`;
                                            } else {
                                                resultText = `Désolé, je n'ai pas trouvé de liste nommée "${listName}".`;
                                            }
                                            break;
                                        }
                                        case 'createNewCustomList': {
                                            const { title, items } = fc.args as { title: string; items: string[] };
                                            const result = organizerRef.current.addCustomList(title, []);
                                            if (result?.newId) {
                                                items.forEach(item => {
                                                    organizerRef.current.addCustomListItem(result.newId!, item);
                                                });
                                                resultText = `Parfait, j'ai créé la liste "${title}" avec ${items.length} élément(s).`;
                                            } else {
                                                resultText = `Désolé, je n'ai pas pu créer la liste "${title}". Elle existe peut-être déjà.`;
                                            }
                                            break;
                                        }
                                    }
                                    session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: resultText } } });
                                }
                             });
                        }
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputCtx) {
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            const startTime = Math.max(outputCtx.currentTime, nextAudioStartTimeRef.current);
                            source.start(startTime);
                            nextAudioStartTimeRef.current = startTime + audioBuffer.duration;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Video chat session error:", e);
                        setError("La session vidéo a rencontré une erreur.");
                        cleanupResources();
                    },
                    onclose: () => {
                        cleanupResources();
                    },
                },
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error("Failed to get media devices:", err);
            setError("La session audio n'a pas pu être établie.");
            cleanupResources();
        }
    }, [isVideoChatActive, voiceSettings, cleanupResources, findBestMatchingShoppingItem, findBestMatchingContact, findBestMatchingList, setEmailToCompose, setIsEmailComposerOpen]);

    const switchCamera = useCallback(async () => {
        if (videoDevices.length < 2) return;
    
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
    
        await stopVideoSession();
        await new Promise(resolve => setTimeout(resolve, 200)); // Ensure resources are released
    
        startVideoSession(nextDeviceId);

    }, [videoDevices, currentDeviceId, stopVideoSession, startVideoSession]);

    useEffect(() => {
        return () => {
           stopVideoSession();
        };
    }, [stopVideoSession]);

    return { isVideoChatActive, error, startVideoSession, stopVideoSession, videoRef, switchCamera, canSwitchCamera: videoDevices.length > 1 };
};
