import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Blob, Type, LiveServerMessage, FunctionResponseScheduling } from '@google/genai';
import { ai } from '../services/aiClient';
// FIX: The function is `decodeAudioData`, not `decodeModelOutputAudio`.
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';

interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media?: Blob; text?: string }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; scheduling?: FunctionResponseScheduling } }): void;
}

export const useNoteEditingChat = (noteContent: string, onNoteUpdate: (newContent: string) => void, voiceSettings: VoiceSettings) => {
    const [chatStatus, setChatStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const isStoppingRef = useRef(false);
    
    const [restartPending, setRestartPending] = useState(false);
    const restartNeededRef = useRef(false);

    const noteContentRef = useRef(noteContent);
    useEffect(() => {
        noteContentRef.current = noteContent;
    }, [noteContent]);

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

    const stopSession = useCallback(async (sessionPromise: Promise<LiveSession> | null) => {
        if (isStoppingRef.current) return;
        
        if (!sessionPromise) {
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

            const baseInstruction = `Tu es un assistant de rédaction vocal expert et proactif. Le contenu HTML actuel de la note est fourni ci-dessous. Ton rôle est de guider l'utilisateur pour améliorer ce texte. Au lieu d'attendre des ordres, analyse la note et engage la conversation en posant des questions pertinentes, en suggérant des améliorations (clarification, style, structure) ou en proposant des idées pour développer le sujet. Par exemple, tu pourrais demander "Le premier paragraphe est bien, mais peut-être pourrions-nous ajouter un exemple concret ?" ou "Je vois que vous parlez de [sujet], aimeriez-vous explorer l'aspect [aspect connexe] ?". Lorsque l'utilisateur accepte une modification ou demande un formatage (ex: 'mets ça en gras', 'crée un tableau'), tu dois utiliser l'outil 'modifierNote' avec le NOUVEAU CONTENU HTML COMPLET de la note et confirmer ton action verbalement. Lorsque tu génères un tableau, assure-toi de bien placer le contenu textuel à l'intérieur des balises <td>.\n\nNOTE ACTUELLE (HTML):\n---\n${noteContentRef.current}\n---`;
            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);

            const modifierNoteTool = {
                name: 'modifierNote',
                description: "Met à jour le contenu de la note de l'utilisateur avec un nouveau contenu HTML.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        nouveauContenu: {
                            type: Type.STRING,
                            description: 'Le contenu HTML complet et mis à jour de la note.',
                        },
                    },
                    required: ['nouveauContenu'],
                },
            };

            const speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            };
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    tools: [{ functionDeclarations: [modifierNoteTool] }], 
                    systemInstruction,
                    speechConfig,
                },
                callbacks: {
                    onopen: () => {
                        setChatStatus('listening');
                        sessionPromise.then((session) => {
                            const initialPrompt = "Bonjour ! J'ai lu votre note. Dites-moi comment je peux vous aider à la modifier ou à l'améliorer.";
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
                                if (fc.name === 'modifierNote' && fc.args.nouveauContenu) {
                                    onNoteUpdate(fc.args.nouveauContenu as string);
                                    restartNeededRef.current = true;
                                    sessionPromise.then(session => session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: "OK, la note a été mise à jour." },
                                            scheduling: FunctionResponseScheduling.SILENT
                                        }
                                    }));
                                }
                            }
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputCtx) {
                            setIsAiSpeaking(true);
                            // FIX: The function is `decodeAudioData`, not `decodeModelOutputAudio`.
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
                            if (restartNeededRef.current) {
                                restartNeededRef.current = false;
                                setRestartPending(true);
                            }
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

            return { sessionPromise };

        } catch (err) {
            console.error('Failed to start note editing session:', err);
            setChatStatus('error');
            return { sessionPromise: null };
        }
    }, [onNoteUpdate, cleanupLocalResources, voiceSettings]);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);

    const toggleSession = useCallback(async () => {
        if (chatStatus === 'idle' || chatStatus === 'error') {
            const { sessionPromise } = await startSession();
            sessionPromiseRef.current = sessionPromise;
        } else {
            await stopSession(sessionPromiseRef.current);
            sessionPromiseRef.current = null;
        }
    }, [chatStatus, startSession, stopSession]);


    useEffect(() => {
        if (restartPending) {
            setRestartPending(false);
            const restart = async () => {
                await stopSession(sessionPromiseRef.current);
                sessionPromiseRef.current = null;
                await new Promise(resolve => setTimeout(resolve, 50));
                const { sessionPromise } = await startSession();
                sessionPromiseRef.current = sessionPromise;
            };
            restart();
        }
    }, [restartPending, stopSession, startSession]);


    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            stopSession(sessionPromiseRef.current);
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
