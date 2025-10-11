import { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Modality, Blob, LiveServerMessage } from '@google/genai';
import { ai } from '../services/aiClient';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';
import { VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';

type ConversationMessage = {
    speaker: 'user' | 'ai';
    text: string;
};

type SetConversation = Dispatch<SetStateAction<ConversationMessage[]>>;

export const useProjectPlannerChat = (setConversation: SetConversation, voiceSettings: VoiceSettings) => {
    const [chatStatus, setChatStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [isSpeaking, setIsSpeaking] = useState(false); // AI is generating audio
    
    const sessionPromiseRef = useRef<any>(null); // Using `any` to avoid complex type issues with LiveSession
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const stopSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) { console.error("Error closing session", e); }
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(e => console.warn("Input AudioContext close error:", e));
        outputAudioContextRef.current?.close().catch(e => console.warn("Output AudioContext close error:", e));
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        sessionPromiseRef.current = null;
        setChatStatus('idle');
    }, []);

    const startSession = useCallback(async (initialGoal?: string) => {
        if (chatStatus !== 'idle') {
            await stopSession();
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
        }
        setChatStatus('connecting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;

            let baseInstruction: string;
            if (initialGoal) {
                 baseInstruction = `You are a friendly and expert project planning assistant. Your goal is to help a user break down a high-level goal into actionable steps. Start a conversation by asking clarifying questions to understand the project's scope, timeline, constraints, and key components. The initial user goal is: "${initialGoal}"`;
            } else {
                baseInstruction = `You are a friendly and expert project planning assistant. Your goal is to help a user break down a high-level goal into actionable steps. Start the conversation by asking the user what project they want to plan. Once they tell you, ask clarifying questions to understand its scope, timeline, constraints, and key components.`;
            }

            const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);
            
            const speechConfig = {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            };

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: { 
                    responseModalities: [Modality.AUDIO], 
                    systemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig,
                },
                callbacks: {
                    onopen: () => {
                        setChatStatus('listening');
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((session: any) => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputCtx) {
                            setIsSpeaking(true);
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
                                    setIsSpeaking(false);
                                }
                            };
                        }

                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            if (currentInputTranscriptionRef.current.trim()) {
                                setConversation(prev => [...prev, { speaker: 'user', text: currentInputTranscriptionRef.current.trim() }]);
                            }
                            if (currentOutputTranscriptionRef.current.trim()) {
                                setConversation(prev => [...prev, { speaker: 'ai', text: currentOutputTranscriptionRef.current.trim() }]);
                            }
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setChatStatus('error');
                        stopSession();
                    },
                    onclose: () => {
                        setChatStatus('idle');
                    },
                }
            });
            await sessionPromiseRef.current;
        } catch (err) {
            console.error('Failed to start conversation:', err);
            setChatStatus('error');
        }
    }, [chatStatus, stopSession, setConversation, voiceSettings]);

    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    return { chatStatus, startSession, stopSession, isSpeaking };
};