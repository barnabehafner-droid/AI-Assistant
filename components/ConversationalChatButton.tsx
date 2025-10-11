import React, { useEffect, useRef } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon, LoaderIcon } from './icons';

type ChatStatus = 'idle' | 'connecting' | 'listening' | 'error';

interface ConversationalChatButtonProps {
    status: ChatStatus;
    onClick: () => void;
    audioContext: AudioContext | null;
    mediaStream: MediaStream | null;
    isAiSpeaking: boolean;
}

const ConversationalChatButton: React.FC<ConversationalChatButtonProps> = ({ status, onClick, audioContext, mediaStream, isAiSpeaking }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);

        const { width, height } = rect;
        const centerX = width / 2;
        const centerY = height / 2;

        const stopAnimation = () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
            ctx.clearRect(0, 0, width, height);
            if (sourceRef.current && analyserRef.current) {
                try {
                    sourceRef.current.disconnect(analyserRef.current);
                } catch (e) {
                    // This can throw an error if the context is already closed, which is fine.
                }
                sourceRef.current = null;
                analyserRef.current = null;
            }
        };
        
        if (status === 'listening' && isAiSpeaking) {
            stopAnimation();
            const baseRadius = Math.min(width, height) / 2 * 0.65;
            ctx.strokeStyle = '#8b5cf6'; // purple-500
            ctx.lineWidth = 2.5;

            const drawPulse = (timestamp: number) => {
                ctx.clearRect(0, 0, width, height);
                const pulse = Math.sin(timestamp / 200) * 3 + 4;
                const radius = baseRadius + pulse;

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.stroke();

                animationFrameIdRef.current = requestAnimationFrame(drawPulse);
            };
            drawPulse(performance.now());
        
        } else if (status === 'listening' && !isAiSpeaking && audioContext && mediaStream) {
            stopAnimation();
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContext.createMediaStreamSource(mediaStream);
            sourceRef.current.connect(analyserRef.current);

            // Use fftSize for time domain data.
            const bufferLength = analyserRef.current.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            
            ctx.strokeStyle = '#6366f1'; // indigo-500
            ctx.lineWidth = 2;

            const drawWave = () => {
                if (!analyserRef.current) return;
                
                // Get time domain data (waveform)
                analyserRef.current.getByteTimeDomainData(dataArray);
                
                ctx.clearRect(0, 0, width, height);
                ctx.beginPath();

                const sliceWidth = width * 1.0 / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0; // Normalize to range around 1.0, where 128 is 0 amplitude
                    const y = v * height / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                // End the line at the middle-right edge for a complete look
                ctx.lineTo(width, height / 2);
                ctx.stroke();

                animationFrameIdRef.current = requestAnimationFrame(drawWave);
            };
            drawWave();
            
        } else {
            stopAnimation();
        }

        return stopAnimation;

    }, [status, isAiSpeaking, audioContext, mediaStream]);

    
    const isSessionActive = status !== 'idle';
    const showVisualizer = status === 'listening';

    return (
        <button
            onClick={onClick}
            className={`relative w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 overflow-hidden ${
                isSessionActive
                ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400' 
                : 'bg-white text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500'
            }`}
            aria-label={isSessionActive ? "Arrêter le chat" : "Démarrer le chat"}
        >
            <canvas 
                ref={canvasRef} 
                className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${showVisualizer ? 'opacity-100' : 'opacity-0'}`}
            />
            
            <div className={`flex items-center justify-center transition-opacity duration-300 ${showVisualizer ? 'opacity-0' : 'opacity-100'}`}>
                 {isSessionActive ? (
                    <XMarkIcon className="w-6 h-6" />
                ) : (
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                )}
            </div>
             {status === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <LoaderIcon className="w-6 h-6 text-indigo-600" />
                </div>
            )}
        </button>
    );
};

export default ConversationalChatButton;