import { useState, useRef, useEffect, useCallback } from 'react';
import { Type, LiveServerMessage, FunctionResponseScheduling } from '@google/genai';
import { TodoItem, VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';
import { useLiveAudioSession } from './useLiveAudioSession';

export const useSubtaskGenerationChat = (todo: TodoItem, onAddSubtask: (text: string) => void, voiceSettings: VoiceSettings) => {

    const { status: chatStatus, isAiSpeaking, startSession, stopSession, sessionPromise, audioContext, mediaStream } = useLiveAudioSession(
        {
            systemInstruction: buildSystemInstruction(voiceSettings, `Tu es un expert en gestion de projet vocal et conversationnel. Ta mission est d'aider l'utilisateur à décomposer la tâche principale : "${todo.task}". La description actuelle est : "${todo.description || 'non fournie'}".

Ton processus est le suivant :
1.  **Commence la conversation en posant des questions de clarification pertinentes** pour bien comprendre le contexte de la tâche. Sois curieux et essaie de recueillir les informations qui te manquent pour créer un bon plan. Par exemple, si la tâche est "peindre le plafond de la cuisine", demande des détails comme la superficie, l'état actuel du plafond, ou les matériaux nécessaires.
2.  **Écoute attentivement les réponses de l'utilisateur.**
3.  **Une fois que tu as assez d'informations**, utilise-les pour construire un plan d'action.
4.  **Propose UNE SEULE sous-tâche concrète à la fois**. Par exemple : "OK, merci pour les précisions. La première étape serait de protéger les meubles et le sol. Est-ce qu'on ajoute 'Protéger la cuisine' comme sous-tâche ?".
5.  Si l'utilisateur est d'accord, tu dois **OBLIGATOIREMENT utiliser l'outil 'ajouterSousTache'**.
6.  **Ensuite, propose la sous-tâche suivante de manière logique.** Continue ce cycle jusqu'à ce que le plan te semble complet. Ne demande JAMAIS "Quelle est la prochaine étape ?". Ton rôle est de piloter la planification.`),
            tools: [{
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
            }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            },
        },
        {
            onToolCall: (functionCalls) => {
                 for (const fc of functionCalls) {
                    if (fc.name === 'ajouterSousTache' && fc.args.texte) {
                        onAddSubtask(fc.args.texte as string);
                        sessionPromise?.then(session => session.sendToolResponse({
                            functionResponses: { 
                                id: fc.id, 
                                name: fc.name, 
                                response: { result: "OK, sous-tâche ajoutée." },
                                scheduling: FunctionResponseScheduling.SILENT
                            }
                        }));
                    }
                }
            },
        }
    );
    
    const toggleSession = useCallback(() => {
        if (chatStatus === 'idle' || chatStatus === 'error') {
            const initialPrompt = `Bonjour ! Je suis l'assistant de planification. Pour vous aider à décomposer la tâche "${todo.task}", pourriez-vous me donner quelques précisions ?`;
            startSession(initialPrompt);
        } else {
            stopSession();
        }
    }, [chatStatus, startSession, stopSession, todo.task]);

    return {
        chatStatus,
        toggleSession,
        isAiSpeaking,
        audioContext,
        mediaStream,
    };
};
