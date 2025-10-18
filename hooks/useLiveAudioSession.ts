import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Blob, LiveServerMessage, FunctionDeclaration } from '@google/genai';
import { ai } from '../services/aiClient';
import { createBlob, decodeAudioData, decode } from '../utils/audioHelpers';

// Define the callbacks the hook will use
export interface LiveSessionCallbacks {
    onToolCall?: (functionCalls: NonNullable<LiveServerMessage['toolCall']>['functionCalls']) => void;
    onTranscriptionUpdate?: (input: string, output: string) => void;
    onTurnComplete?: (fullInput: string, fullOutput: string) => void;
    onError?: (error: ErrorEvent) => void;
    onClose?: () => void;
}

export interface LiveSessionConfig {
    systemInstruction: string;
    tools?: FunctionDeclaration[];
    speechConfig: {
        voiceConfig: {
            prebuiltVoiceConfig: {
                voiceName: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';
            };
        };
    };
    enableTranscription?: boolean;
}

export const useLiveAudioSession = (config: LiveSessionConfig, callbacks: LiveSessionCallbacks) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'error'>('idle');
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextAudioStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

    const isStoppingRef = useRef(false);

    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const cleanupLocalResources = useCallback(() => {
        if (wakeLockSentinelRef.current) {
            wakeLockSentinelRef.current.release()
                .then(() => {
                    wakeLockSentinelRef.current = null;
                    console.log('Screen Wake Lock released.');
                })
                .catch(() => {
                    wakeLockSentinelRef.current = null;
                });
        }
        
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioSourceNodeRef.current) {
            audioSourceNodeRef.current.disconnect();
            audioSourceNodeRef.current = null;
        }
        
        inputAudioContextRef.current?.close().catch(e => console.warn("Input AudioContext close error:", e));
        inputAudioContextRef.current = null;
        outputAudioContextRef.current?.close().catch(e => console.warn("Output AudioContext close error:", e));
        outputAudioContextRef.current = null;

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextAudioStartTimeRef.current = 0;

        sessionPromiseRef.current = null;
        setStatus('idle');
        setIsAiSpeaking(false);
        setError(null);
    }, []);

    const stopSession = useCallback(async () => {
        if (isStoppingRef.current) {
            return;
        }
        isStoppingRef.current = true;
    
        // Attempt to gracefully close the remote session first.
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                // session.close() will trigger the onclose callback,
                // which calls cleanupLocalResources again. This is fine
                // as the cleanup function is idempotent.
                session.close();
            } catch (e) {
                console.error("Error sending close signal to session:", e);
            }
        }
    
        // Immediately clean up local resources regardless of server response.
        // This is the critical fix to prevent resource leaks and ensure the mic stops.
        cleanupLocalResources();
        
        isStoppingRef.current = false;
    
    }, [cleanupLocalResources]);

    const startSession = useCallback(async (initialTextOverride?: string) => {
        setStatus('connecting');
        setError(null);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = mediaStream;

            if ('wakeLock' in navigator) {
                try {
                    wakeLockSentinelRef.current = await navigator.wakeLock.request('screen');
                    console.log('Screen Wake Lock acquired.');
                } catch (err) {
                    console.warn('Could not acquire screen wake lock:', err);
                }
            }

            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;

            const connectConfig: any = {
                responseModalities: [Modality.AUDIO],
                systemInstruction: config.systemInstruction,
                speechConfig: config.speechConfig,
            };
            if (config.tools && config.tools.length > 0) {
                connectConfig.tools = [{ functionDeclarations: config.tools }];
            }
            if (config.enableTranscription) {
                connectConfig.inputAudioTranscription = {};
                connectConfig.outputAudioTranscription = {};
            }

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: connectConfig,
                callbacks: {
                    onopen: () => {
                        setStatus('listening');
                        if (initialTextOverride) {
                            sessionPromise.then(session => session.sendRealtimeInput({ text: initialTextOverride }));
                        }
                        
                        const source = inputCtx.createMediaStreamSource(mediaStream);
                        audioSourceNodeRef.current = source;
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;
                        processor.onaudioprocess = (audioEvent) => {
                            const inputData = audioEvent.inputBuffer.getChannelData(0);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            callbacks.onToolCall?.(message.toolCall.functionCalls);
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
                        
                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextAudioStartTimeRef.current = 0;
                        }

                        if (config.enableTranscription) {
                            if (message.serverContent?.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }
                            if (message.serverContent?.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }
                            callbacks.onTranscriptionUpdate?.(currentInputTranscriptionRef.current, currentOutputTranscriptionRef.current);

                            if (message.serverContent?.turnComplete) {
                                callbacks.onTurnComplete?.(currentInputTranscriptionRef.current.trim(), currentOutputTranscriptionRef.current.trim());
                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                            }
                        } else {
                            if (message.serverContent?.turnComplete) {
                                callbacks.onTurnComplete?.('', '');
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setStatus('error');
                        setError('Erreur de connexion. Veuillez réessayer.');
                        console.error('Live session error:', e);
                        callbacks.onError?.(e);
                        cleanupLocalResources();
                    },
                    onclose: () => {
                        callbacks.onClose?.();
                        cleanupLocalResources();
                    },
                },
            });

            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error('Failed to start session:', err);
            setError('Impossible d\'accéder au microphone.');
            setStatus('error');
            cleanupLocalResources();
        }
    }, [config, callbacks, cleanupLocalResources]);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (status === 'listening' && document.visibilityState === 'visible') {
                if ('wakeLock' in navigator) {
                    try {
                        wakeLockSentinelRef.current = await navigator.wakeLock.request('screen');
                        console.log('Screen Wake Lock re-acquired on visibility change.');
                    } catch (err) {
                        console.error('Could not re-acquire screen wake lock:', err);
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [status]);
    
    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    return {
        status,
        isAiSpeaking,
        error,
        startSession,
        stopSession,
        sessionPromise: sessionPromiseRef.current,
        audioContext: inputAudioContextRef.current,
        mediaStream: streamRef.current,
    };
};
