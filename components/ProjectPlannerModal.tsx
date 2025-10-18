import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, MicrophoneIcon, StopIcon, LoaderIcon, SparklesIcon, PencilIcon } from './icons';
import { useProjectPlannerChat } from '../hooks/useProjectPlannerChat';
import { generatePlanFromConversation } from '../services/geminiService';
import { VoiceSettings, OrganizedData } from '../types';

interface ProjectPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: Update onPlanGenerated prop to accept the full plan object, resolving a type mismatch with App.tsx
  onPlanGenerated: (plan: { title: string; description: string; plan: OrganizedData }) => void;
  voiceSettings: VoiceSettings;
}

type ConversationMessage = {
    speaker: 'user' | 'ai';
    text: string;
};

const ProjectPlannerModal: React.FC<ProjectPlannerModalProps> = ({ isOpen, onClose, onPlanGenerated, voiceSettings }) => {
    const [initialGoal, setInitialGoal] = useState('');
    const [stage, setStage] = useState<'initial' | 'planning' | 'generating'>('initial');
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const { chatStatus, startSession, stopSession, isSpeaking } = useProjectPlannerChat(setConversation, voiceSettings);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [conversation]);

    useEffect(() => {
        // Reset state when modal is closed/opened
        if (isOpen) {
            setInitialGoal('');
            setStage('initial');
            setConversation([]);
            setError(null);
        } else {
            stopSession();
        }
    }, [isOpen, stopSession]);

    const handleStartTextPlanning = () => {
        if (!initialGoal.trim()) {
            setError('Please enter a goal to start planning.');
            return;
        }
        setError(null);
        setConversation([{ speaker: 'user', text: initialGoal }]);
        startSession(initialGoal);
        setStage('planning');
    };

    const handleStartVoicePlanning = () => {
        setError(null);
        setConversation([]);
        startSession(); // Start without an initial text goal
        setStage('planning');
    };

    const handleGeneratePlan = async () => {
        setStage('generating');
        stopSession();
        const historyText = conversation.map(msg => `${msg.speaker.toUpperCase()}: ${msg.text}`).join('\n');
        try {
            const plan = await generatePlanFromConversation(historyText);
            onPlanGenerated(plan);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during plan generation.');
            setStage('planning'); // Go back to planning stage on error
        }
    };
    
    const handleClose = () => {
        stopSession();
        onClose();
    };

    const renderContent = () => {
        switch (stage) {
            case 'initial':
                return (
                    <div className="p-6 text-center">
                        <SparklesIcon className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Let's Plan a New Project!</h3>
                        <p className="text-slate-600 mb-6">Describe your main goal below, or use the voice assistant to break it down conversationally.</p>
                        <textarea
                            value={initialGoal}
                            onChange={(e) => setInitialGoal(e.target.value)}
                            placeholder="e.g., Organize a team offsite event, Plan a 2-week trip to Japan, or Launch a personal blog..."
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            rows={3}
                        />
                        {error && <p className="text-red-500 mt-2">{error}</p>}
                        <div className="mt-6 w-full flex flex-col gap-3">
                            <button
                                onClick={handleStartTextPlanning}
                                disabled={!initialGoal.trim()}
                                className="w-full px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                            >
                                <PencilIcon className="w-5 h-5" />
                                Start with Text
                            </button>
                            <div className="flex items-center gap-2">
                                <hr className="flex-grow border-slate-200"/>
                                <span className="text-slate-500 text-sm font-semibold">OR</span>
                                <hr className="flex-grow border-slate-200"/>
                            </div>
                             <button
                                onClick={handleStartVoicePlanning}
                                className="w-full px-4 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                                Plan with Voice
                            </button>
                        </div>
                    </div>
                );
            case 'planning':
            case 'generating':
                return (
                    <div className="flex flex-col h-full">
                        <div ref={chatContainerRef} className="flex-grow p-6 overflow-y-auto space-y-4">
                            {conversation.map((msg, index) => (
                                <div key={index} className={`flex items-end gap-2 ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.speaker === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-200 text-slate-800 rounded-bl-none'}`}>
                                        <p>{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            {isSpeaking && stage === 'planning' && (
                                <div className="flex items-end gap-2 justify-start">
                                    <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl bg-slate-200 text-slate-800 rounded-bl-none">
                                        <LoaderIcon className="w-5 h-5 text-slate-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-4">
                            {stage === 'generating' ? (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <LoaderIcon />
                                    <span>Generating your plan...</span>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={chatStatus === 'listening' ? stopSession : () => startSession(conversation.map(m => m.text).join('\n'))}
                                        className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${chatStatus === 'listening' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'}`}
                                    >
                                        {chatStatus === 'listening' ? <StopIcon /> : <MicrophoneIcon />}
                                    </button>
                                     <button
                                        onClick={handleGeneratePlan}
                                        className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex-grow"
                                    >
                                        Generate Plan
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col m-4">
                <header className="flex items-center justify-between p-4 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">AI Project Planner</h2>
                    <button onClick={handleClose} className="text-slate-500 hover:text-slate-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                {renderContent()}
            </div>
        </div>
    );
};

export default ProjectPlannerModal;