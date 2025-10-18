import React, { useRef, useEffect } from 'react';

type ChatStatus = 'idle' | 'connecting' | 'listening' | 'error';

interface AudioVisualizerProps {
    status: ChatStatus;
    isAiSpeaking: boolean;
    audioContext: AudioContext | null;
    mediaStream: MediaStream | null;
    className?: string;
    waveColor?: string;
    pulseColor?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
    status,
    isAiSpeaking,
    audioContext,
    mediaStream,
    className,
    waveColor = '#6366f1', // indigo-500
    pulseColor = '#8b5cf6', // purple-500
}) => {
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
                    // Ignore error if context is already closed
                }
            }
            sourceRef.current = null;
            analyserRef.current = null;
        };
        
        const showVisualizer = status === 'listening';
        if (!showVisualizer) {
            stopAnimation();
            return;
        }

        if (isAiSpeaking) {
            stopAnimation();
            const baseRadius = Math.min(width, height) / 2 * 0.65;
            ctx.strokeStyle = pulseColor;
            ctx.lineWidth = 2.5;

            const drawPulse = (timestamp: number) => {
                ctx.clearRect(0, 0, width, height);
                // Make pulse size relative to canvas width for better scaling
                const pulseAmount = Math.sin(timestamp / 200) * (width / 20) + (width / 15);
                const radius = Math.min(baseRadius, (width / 2) - ctx.lineWidth - pulseAmount);

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + pulseAmount / 2, 0, 2 * Math.PI);
                ctx.stroke();

                animationFrameIdRef.current = requestAnimationFrame(drawPulse);
            };
            drawPulse(performance.now());
        
        } else if (!isAiSpeaking && audioContext && mediaStream) {
            stopAnimation();
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContext.createMediaStreamSource(mediaStream);
            sourceRef.current.connect(analyserRef.current);

            const bufferLength = analyserRef.current.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            
            ctx.strokeStyle = waveColor;
            ctx.lineWidth = 2;

            const drawWave = () => {
                if (!analyserRef.current) return;
                
                analyserRef.current.getByteTimeDomainData(dataArray);
                
                ctx.clearRect(0, 0, width, height);
                ctx.beginPath();

                const sliceWidth = width * 1.0 / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * height / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }

                ctx.lineTo(width, height / 2);
                ctx.stroke();

                animationFrameIdRef.current = requestAnimationFrame(drawWave);
            };
            drawWave();
        } else {
            stopAnimation();
        }

        return stopAnimation;

    }, [status, isAiSpeaking, audioContext, mediaStream, waveColor, pulseColor]);

    const isVisible = status === 'listening';

    return (
        <canvas 
            ref={canvasRef} 
            className={`${className || ''} transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        />
    );
};

export default AudioVisualizer;
