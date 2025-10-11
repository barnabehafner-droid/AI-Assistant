import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Blob, Type, LiveServerMessage, FunctionResponseScheduling } from '@google/genai';
import { ai } from '../services/aiClient';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { TodoItem, VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';

interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media?: Blob; text?: string }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; scheduling?: FunctionResponseScheduling } }): void;
}

export const useSubtaskGenerationChat = (todo: TodoItem, onAddSubtask: (text: string) => void, voiceSettings: VoiceSettings) => {
    const [chatStatus, setChatStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const isStoppingRef = useRef(false);

    const cleanupLocalResources = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(e => console.warn("Input AudioContext close error:", e));
        outputAudioContextRef.current?.close().catch(e => console.warn("Output AudioContext close error:", e));
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        streamRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;

        setChatStatus('idle');
        setIsAiSpeaking(false);
    }, []);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);

    const stopSession = useCallback(async () => {
        const sessionPromise = sessionPromiseRef.current;
        if (isStoppingRef.current || !sessionPromise) {
            cleanupLocalResources();
            return;
        }
        isStoppingRef.current = true;
        try {
            const session = await sessionPromise;
            session.close();
        } catch (e) {
            console.error("Error closing session, forcing cleanup", e);
            cleanupLocalResources();
        } finally {
            isStoppingRef.current = false;
        }
    }, [cleanupLocalResources]);

    const startSession = useCallback(async () => {
        setChatStatus('connecting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;

            const baseInstruction = `Tu es un expert en gestion de projet vocal et conversationnel. Ta mission est d'aider l'utilisateur à décomposer la tâche principale : "${todo.task}". La description actuelle est : "${todo.description || 'non fournie'}".

Ton processus est le suivant :
1.  **Commence la conversation en posant des questions de clarification pertinentes** pour bien comprendre le contexte de la tâche. Sois curieux et essaie de recueillir les informations qui te manquent pour créer un bon plan. Par exemple, si la tâche est "peindre le plafond de la cuisine", demande des détails comme la superficie, l'état actuel du plafond, ou les matériaux nécessaires.
2.  **Écoute attentivement les réponses de l'utilisateur.**
3.  **Une fois que tu as assez d'informations**, utilise-les pour construire un plan d'action.
4.  **Propose UNE SEULE sous-tâche concrète à la fois**. Par exemple : "OK, merci pour les précisions. La première étape serait de protéger les meubles et le sol. Est-ce qu'on ajoute 'Protéger la cuisine' comme sous-tâche ?".
5.  Si l'utilisateur est d'accord, tu dois **OBLIGATOIREMENT utiliser l'outil 'ajouterSousTache'**.
6.  **Ensuite, propose la sous-tâche suivante de manière logique.** Continue ce cycle jusqu'à ce que le plan te semble complet. Ne demande JAMAIS "Quelle est la prochaine étape ?". Ton rôle est de piloter la planification.`;
            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);

            const ajouterSousTacheTool = {
                name: 'ajouterSousTache',
                description: "Ajoute une nouvelle sous-tâche à la tâche principale.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        texte: {
                            type: Type.STRING,
                            description: 'Le contenu de la sous-tâche à ajouter.',
                        },
                    },
                    required: ['texte'],
                },
            };
            
            const speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            };

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    tools: [{ functionDeclarations: [ajouterSousTacheTool] }], 
                    systemInstruction,
                    speechConfig
                },
                callbacks: {
                    onopen: () => {
                        setChatStatus('listening');
                        
                        sessionPromise.then((session) => {
                             const initialPrompt = `Bonjour ! Je suis l'assistant de planification. Pour vous aider à décomposer la tâche "${todo.task}", pourriez-vous me donner quelques précisions ?`;
                             session.sendRealtimeInput({ text: initialPrompt });
                        });

                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromise.then((session) => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'ajouterSousTache' && fc.args.texte) {
                                    onAddSubtask(fc.args.texte as string);
                                    sessionPromise.then(session => session.sendToolResponse({
                                        functionResponses: { 
                                            id: fc.id, 
                                            name: fc.name, 
                                            response: { result: "OK, sous-tâche ajoutée." },
                                            scheduling: FunctionResponseScheduling.SILENT
                                        }
                                    }));
                                }
                            }
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
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setChatStatus('error');
                    },
                    onclose: () => {
                        cleanupLocalResources();
                    },
                }
            });

            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error('Failed to start subtask generation session:', err);
            setChatStatus('error');
        }
    }, [todo.task, todo.description, onAddSubtask, cleanupLocalResources, voiceSettings]);

    const toggleSession = useCallback(() => {
        if (chatStatus === 'idle' || chatStatus === 'error') {
            startSession();
        } else {
            stopSession();
        }
    }, [chatStatus, startSession, stopSession]);

    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    return {
        chatStatus,
        toggleSession,
        isAiSpeaking,
        audioContext: inputAudioContextRef.current,
        mediaStream: streamRef.current,
    };
};
