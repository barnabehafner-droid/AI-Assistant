import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Blob as GeminiBlob, Type, LiveServerMessage } from '@google/genai';
import { ai } from '../services/aiClient';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { baseFunctionDeclarations, buildSystemInstruction, formatContactsForAI } from '../services/aiConfig';
import { useOrganizerState } from './useOrganizerState';
import { Priority, VoiceSettings, CustomList, NoteItem, Contact, EmailData } from '../types';
import { levenshteinDistance } from '../utils/fuzzyMatching';

type OrganizerProps = ReturnType<typeof useOrganizerState>;

interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media?: GeminiBlob; text?: string }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; } }): void;
}

const FRAME_RATE = 1; // Send 1 frame per second
const JPEG_QUALITY = 0.7;

export const useVideoChat = (
    organizer: OrganizerProps, 
    voiceSettings: VoiceSettings, 
    contacts: Contact[],
    // FIX: Update parameter type to use the shared EmailData interface.
    setEmailToCompose: (email: EmailData | null) => void,
    setIsEmailComposerOpen: (isOpen: boolean) => void
) => {
    const [isVideoChatActive, setIsVideoChatActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameIntervalRef = useRef<number | null>(null);

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const cleanupRef = useRef<(() => void) | null>(null);
    
    const organizerRef = useRef(organizer);
    useEffect(() => {
        organizerRef.current = organizer;
    }, [organizer]);

    useEffect(() => {
        cleanupRef.current = () => {
            if (frameIntervalRef.current) {
                clearInterval(frameIntervalRef.current);
                frameIntervalRef.current = null;
            }
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            
            scriptProcessorRef.current?.disconnect();
            scriptProcessorRef.current = null;
            audioSourceRef.current?.disconnect();
            audioSourceRef.current = null;

            inputAudioContextRef.current?.close().catch(e => console.warn("Input AudioContext close error:", e));
            inputAudioContextRef.current = null;
            outputAudioContextRef.current?.close().catch(e => console.warn("Output AudioContext close error:", e));
            outputAudioContextRef.current = null;
            
            audioSourcesRef.current.forEach(source => source.stop());
            audioSourcesRef.current.clear();
            nextAudioStartTimeRef.current = 0; // FIX: Reset audio start time

            sessionPromiseRef.current = null;

            setIsVideoChatActive(false);
            setError(null);
            setVideoDevices([]);
            setCurrentDeviceId(null);
        };
    }, []);

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

    const findBestMatchingList = useCallback((query: string): CustomList | null => {
        const lists = organizerRef.current.customLists;
        if (lists.length === 0) return null;
        const lowerQuery = query.toLowerCase();
        let bestMatch: CustomList | null = null;
        let minDistance = Infinity;

        for (const list of lists) {
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

    const findBestMatchingNote = useCallback((query: string): NoteItem | null => {
        const notes = organizerRef.current.notes;
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


    const stopVideoSession = useCallback(async () => {
        if (!sessionPromiseRef.current) {
            cleanupRef.current?.();
            return;
        }
        
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (e) {
            console.error("Failed to get session to close it. Forcing cleanup.", e);
            cleanupRef.current?.();
        }
    }, []);

    const startVideoSession = useCallback(async () => {
        if (isVideoChatActive) return;
        setError(null);
        setIsVideoChatActive(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            setVideoDevices(videoInputs);
            const currentTrack = stream.getVideoTracks()[0];
            if (currentTrack) {
                setCurrentDeviceId(currentTrack.getSettings().deviceId || null);
            }

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;
            
            if (!canvasRef.current) {
                canvasRef.current = document.createElement('canvas');
            }
            const canvasEl = canvasRef.current;
            
            const customListNames = organizerRef.current.customLists.map(l => `"${l.title}"`).join(', ');
            const availableLists = `L'utilisateur a une "Liste de courses" et les listes personnalisées suivantes : ${customListNames || 'aucune'}.`;

            const baseInstruction = `Tu es un assistant vocal d'organisation expert pour une session vidéo en direct. Ta mission est d'analyser le flux vidéo pour identifier le texte écrit (OCR) et aider l'utilisateur à ajouter rapidement des éléments à ses listes ou à envoyer des e-mails.
${availableLists}

**CONTEXTE SUPPLÉMENTAIRE :**
Voici la liste des contacts de l'utilisateur :
${formatContactsForAI(contacts)}

**CONDUITE À SUIVRE :**
1.  **Analyse du Texte :** Si tu vois du texte (ex: une liste manuscrite, un document), lis-le et propose de l'ajouter à une liste.
2.  **Formatage pour les Notes :** Si l'utilisateur souhaite créer une note à partir du texte reconnu, tu dois impérativement préserver le formatage visuel. Identifie les listes à puces, les tableaux, le texte en gras ou en italique, et retranscris-les en utilisant les balises HTML appropriées (<ul>, <li>, <table>, <tr>, <td>, <b>, <i>, etc.) lorsque tu utilises l'outil \`ajouterNote\`. Crucial : lorsque vous reconnaissez un tableau, vous devez placer le texte que vous voyez à l'intérieur des balises <td> du tableau HTML. Ne créez pas de tableaux vides.
3.  **Documents Structurés :** Si tu reconnais un document structuré (facture, contrat), après l'avoir capturé dans une note avec le bon formatage HTML, propose de surligner les informations clés (dates, montants) en utilisant l'outil \`surlignerTexteDansNote\`.
4.  **Envoi d'e-mails :** Si l'utilisateur demande d'envoyer un e-mail à quelqu'un, utilise l'outil \`envoyerEmail\`. Tu peux utiliser le nom d'un contact et le système trouvera son adresse.
5.  **Confirmation :** Attends toujours la confirmation de l'utilisateur avant d'utiliser un outil.
6.  **Conversation :** Interagis naturellement avec l'utilisateur.`;


            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);
            
            const tools = baseFunctionDeclarations.filter(tool => 
                ['ajouterTache', 'ajouterArticleCourse', 'ajouterNote', 'ajouterElementListePersonnalisee', 'surlignerTexteDansNote', 'envoyerEmail'].includes(tool.name)
            );

            const speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            };

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    tools: [{ functionDeclarations: tools }], 
                    systemInstruction,
                    speechConfig 
                },
                callbacks: {
                    onopen: () => {
                        sessionPromise.then((session) => {
                            const initialPrompt = "Bonjour ! Montrez-moi ce que vous voulez organiser. Je peux lire du texte à partir d'une liste manuscrite, d'un document ou même d'un e-mail à l'écran.";
                            session.sendRealtimeInput({ text: initialPrompt });
                        });
                        audioSourceRef.current = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        audioSourceRef.current.connect(processor);
                        processor.connect(inputCtx.destination);
                        
                        if (videoRef.current) {
                            const videoEl = videoRef.current;
                            const ctx = canvasEl.getContext('2d');
                            if (!ctx) return;
                            
                            frameIntervalRef.current = window.setInterval(() => {
                                if (!videoEl.videoWidth || !videoEl.videoHeight) return;
                                canvasEl.width = videoEl.videoWidth;
                                canvasEl.height = videoEl.videoHeight;
                                ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                                canvasEl.toBlob(
                                    async (blob) => {
                                        if (blob) {
                                            const base64Data = await blobToBase64(blob);
                                            sessionPromise.then((session) => {
                                                session.sendRealtimeInput({
                                                    media: { data: base64Data, mimeType: 'image/jpeg' }
                                                });
                                            });
                                        }
                                    },
                                    'image/jpeg',
                                    JPEG_QUALITY
                                );
                            }, 1000 / FRAME_RATE);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result = "Action effectuée.";
                                try {
                                    if (fc.name === 'ajouterTache') {
                                        organizerRef.current.addTodo(fc.args.task as string, (fc.args.priority as Priority) || Priority.Medium);
                                        result = `OK, tâche "${fc.args.task}" ajoutée.`;
                                    } else if (fc.name === 'ajouterArticleCourse') {
                                        organizerRef.current.addShoppingItem(fc.args.item as string);
                                        result = `OK, article "${fc.args.item}" ajouté aux courses.`;
                                    } else if (fc.name === 'ajouterNote') {
                                        organizerRef.current.addNote(fc.args.content as string);
                                        result = `OK, note ajoutée.`;
                                    } else if (fc.name === 'ajouterElementListePersonnalisee') {
                                        const { nomListe, element } = fc.args as { nomListe: string; element: string };
                                        const list = findBestMatchingList(nomListe);
                                        if (list) {
                                            organizerRef.current.addCustomListItem(list.id, element);
                                            result = `OK, j'ai ajouté "${element}" à la liste "${list.title}".`;
                                        } else {
                                            result = `Désolé, je n'ai pas trouvé la liste "${nomListe}".`;
                                        }
                                    } else if (fc.name === 'surlignerTexteDansNote') {
                                        const { noteIdentifier, textesASurligner } = fc.args as { noteIdentifier: string; textesASurligner: string[] };
                                        const noteToUpdate = findBestMatchingNote(noteIdentifier);
                                        if (noteToUpdate && textesASurligner && textesASurligner.length > 0) {
                                            let newContent = noteToUpdate.content;
                                            textesASurligner.forEach(text => {
                                                // Basic implementation: replace first occurrence. Could be improved to be more robust.
                                                newContent = newContent.replace(text, `<mark>${text}</mark>`);
                                            });
                                            organizerRef.current.editNote(noteToUpdate.id, newContent);
                                            result = `Parfait, j'ai surligné les informations demandées dans la note.`;
                                        } else {
                                            result = `Désolé, je n'ai pas pu trouver la note ou le texte à surligner.`;
                                        }
// FIX: Update 'envoyerEmail' case to handle 'cc' and 'bcc' from the AI and resolve contacts.
                                    } else if (fc.name === 'envoyerEmail') {
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
                                        
                                        setEmailToCompose({ to: toResult.value, subject: sujet, body: corps, cc: ccResult.value, bcc: bccResult.value });
                                        setIsEmailComposerOpen(true);
                                        result = "J'ai préparé l'e-mail pour vous.";
                                    }
                                } catch (e) { result = "Erreur lors de l'action."; }

                                sessionPromise.then(session => session.sendToolResponse({
                                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                                }));
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
                            };
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Video chat error:", e);
                        setError("Une erreur de connexion est survenue.");
                    },
                    onclose: () => {
                        cleanupRef.current?.();
                    }
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error("Failed to get media devices:", err);
            setError("Impossible d'accéder à la caméra ou au microphone.");
            setIsVideoChatActive(false);
        }
    }, [isVideoChatActive, voiceSettings, findBestMatchingList, findBestMatchingNote, contacts, findBestMatchingContact, setEmailToCompose, setIsEmailComposerOpen]);

    const switchCamera = useCallback(async () => {
        if (videoDevices.length < 2 || !inputAudioContextRef.current || !scriptProcessorRef.current) {
            return;
        }
    
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
    
        streamRef.current?.getTracks().forEach(track => track.stop());
        
        if (audioSourceRef.current) {
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
    
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: true, 
                video: { deviceId: { exact: nextDeviceId } }
            });
            
            streamRef.current = newStream;
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setCurrentDeviceId(nextDeviceId);
    
            const source = inputAudioContextRef.current.createMediaStreamSource(newStream);
            audioSourceRef.current = source;
            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
    
        } catch (err) {
            console.error("Failed to switch camera:", err);
            setError("Impossible de changer de caméra.");
            stopVideoSession();
        }
    }, [videoDevices, currentDeviceId, stopVideoSession]);

    useEffect(() => {
        return () => {
            stopVideoSession();
        };
    }, [stopVideoSession]);

    return { isVideoChatActive, error, startVideoSession, stopVideoSession, videoRef, switchCamera, canSwitchCamera: videoDevices.length > 1 };
};