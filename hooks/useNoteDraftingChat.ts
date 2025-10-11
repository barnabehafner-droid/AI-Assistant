import { useState, useCallback } from 'react';
import { draftNoteWithAI } from '../services/geminiService';

export type ChatMessage = {
    speaker: 'user' | 'ai';
    text: string;
};

export const useNoteDraftingChat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startChat = useCallback(() => {
        // Start the conversation with a default AI greeting.
        const firstAIMessage: ChatMessage = {
            speaker: 'ai',
            text: `Bonjour ! J'ai lu votre note. Comment puis-je vous aider à l'améliorer ou à la développer ?`,
        };
        setMessages([firstAIMessage]);
    }, []);

    const sendMessage = useCallback(async (userMessage: string, noteContext: string) => {
        if (!userMessage.trim()) return;

        setError(null);
        const newUserMessage: ChatMessage = { speaker: 'user', text: userMessage };
        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            const aiResponseText = await draftNoteWithAI(noteContext, updatedMessages);
            const newAiMessage: ChatMessage = { speaker: 'ai', text: aiResponseText };
            setMessages(prev => [...prev, newAiMessage]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            // Add an error message to the chat
            const errorAiMessage: ChatMessage = { speaker: 'ai', text: `Désolé, une erreur est survenue: ${errorMessage}` };
            setMessages(prev => [...prev, errorAiMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    const resetChat = useCallback(() => {
        setMessages([]);
        setError(null);
        setIsLoading(false);
    }, []);

    return { messages, sendMessage, isLoading, error, startChat, resetChat };
};