import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';
import { useLiveAudioSession } from './useLiveAudioSession';

type ConversationMessage = {
    speaker: 'user' | 'ai';
    text: string;
};

type SetConversation = Dispatch<SetStateAction<ConversationMessage[]>>;

export const useProjectPlannerChat = (setConversation: SetConversation, voiceSettings: VoiceSettings) => {
    
    const [currentInitialGoal, setCurrentInitialGoal] = useState<string | undefined>();
    
    const handleTurnComplete = useCallback((fullInput: string, fullOutput: string) => {
        if (fullInput) {
            setConversation(prev => [...prev, { speaker: 'user', text: fullInput }]);
        }
        if (fullOutput) {
            setConversation(prev => [...prev, { speaker: 'ai', text: fullOutput }]);
        }
    }, [setConversation]);

    const startSession = useCallback((initialGoal?: string) => {
        setCurrentInitialGoal(initialGoal);
        _startSession(initialGoal);
    }, []);

    let baseInstruction: string;
    if (currentInitialGoal) {
            baseInstruction = `You are a friendly and expert project planning assistant. Your goal is to help a user break down a high-level goal into actionable steps. Start a conversation by asking clarifying questions to understand the project's scope, timeline, constraints, and key components. The initial user goal is: "${currentInitialGoal}"`;
    } else {
        baseInstruction = `You are a friendly and expert project planning assistant. Your goal is to help a user break down a high-level goal into actionable steps. Start the conversation by asking the user what project they want to plan. Once they tell you, ask clarifying questions to understand its scope, timeline, constraints, and key components.`;
    }
    const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);
    
    const { status: chatStatus, isAiSpeaking, startSession: _startSession, stopSession } = useLiveAudioSession(
        {
            systemInstruction,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            },
            enableTranscription: true,
        },
        {
            onTurnComplete: handleTurnComplete,
        }
    );

    return { chatStatus, startSession, stopSession, isSpeaking: isAiSpeaking };
};
