import { useState, useRef, useEffect, useCallback } from 'react';
import { Modality, Type, LiveServerMessage, FunctionResponseScheduling } from '@google/genai';
import { VoiceSettings } from '../types';
import { buildSystemInstruction } from '../services/aiConfig';
import { useLiveAudioSession } from './useLiveAudioSession';

export const useNoteEditingChat = (noteContent: string, onNoteUpdate: (newContent: string) => void, voiceSettings: VoiceSettings) => {
    const [restartPending, setRestartPending] = useState(false);
    const restartNeededRef = useRef(false);

    const noteContentRef = useRef(noteContent);
    useEffect(() => {
        noteContentRef.current = noteContent;
    }, [noteContent]);

    const { status: chatStatus, isAiSpeaking, startSession, stopSession, sessionPromise, audioContext, mediaStream } = useLiveAudioSession(
        {
            systemInstruction: buildSystemInstruction(voiceSettings, `Tu es un assistant de rédaction vocal expert et proactif. Le contenu HTML actuel de la note est fourni ci-dessous. Ton rôle est de guider l'utilisateur pour améliorer ce texte. Au lieu d'attendre des ordres, analyse la note et engage la conversation en posant des questions pertinentes, en suggérant des améliorations (clarification, style, structure) ou en proposant des idées pour développer le sujet. Par exemple, tu pourrais demander "Le premier paragraphe est bien, mais peut-être pourrions-nous ajouter un exemple concret ?" ou "Je vois que vous parlez de [sujet], aimeriez-vous explorer l'aspect [aspect connexe] ?". Lorsque l'utilisateur accepte une modification ou demande un formatage (ex: 'mets ça en gras', 'crée un tableau'), tu dois utiliser l'outil 'modifierNote' avec le NOUVEAU CONTENU HTML COMPLET de la note et confirmer ton action verbalement. Lorsque tu génères un tableau, assure-toi de bien placer le contenu textuel à l'intérieur des balises <td>.\n\nNOTE ACTUELLE (HTML):\n---\n${noteContentRef.current}\n---`),
            tools: [{
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
            }],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceSettings.voiceName } },
            },
        },
        {
            onToolCall: (functionCalls) => {
                for (const fc of functionCalls) {
                    if (fc.name === 'modifierNote' && fc.args.nouveauContenu) {
                        onNoteUpdate(fc.args.nouveauContenu as string);
                        restartNeededRef.current = true;
                        sessionPromise?.then(session => session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result: "OK, la note a été mise à jour." },
                                scheduling: FunctionResponseScheduling.SILENT
                            }
                        }));
                    }
                }
            },
            onClose: () => {
                setRestartPending(false);
                restartNeededRef.current = false;
            },
            onTurnComplete: () => {
                 if (restartNeededRef.current) {
                    restartNeededRef.current = false;
                    setRestartPending(true);
                }
            }
        }
    );

    const toggleSession = useCallback(async () => {
        if (chatStatus === 'idle' || chatStatus === 'error') {
            const initialPrompt = "Bonjour ! J'ai lu votre note. Dites-moi comment je peux vous aider à la modifier ou à l'améliorer.";
            startSession(initialPrompt);
        } else {
            await stopSession();
        }
    }, [chatStatus, startSession, stopSession]);


    useEffect(() => {
        if (restartPending) {
            setRestartPending(false);
            const restart = async () => {
                await stopSession();
                await new Promise(resolve => setTimeout(resolve, 50));
                await startSession();
            };
            restart();
        }
    }, [restartPending, stopSession, startSession]);

    return { 
        chatStatus, 
        toggleSession,
        isAiSpeaking,
        audioContext,
        mediaStream,
    };
};
