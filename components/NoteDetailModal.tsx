import React, { useState, useEffect, useRef } from 'react';
import { NoteItem, Project, VoiceSettings, NoteHistoryEntry } from '../types';
import { XMarkIcon, MicrophoneIcon, StopIcon, LoaderIcon, RectangleGroupIcon, ArrowUturnLeftIcon, MapPinIcon } from './icons';
import { useNoteEditingChat } from '../hooks/useNoteEditingChat';
import { ListType } from '../hooks/useOrganizerState';
import AudioVisualizer from './AudioVisualizer';
import RichTextEditor from './RichTextEditor';

interface NoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: NoteItem;
    projects: Project[];
    onNavigateToProject: (projectId: string) => void;
    onEdit: (id: string, newContent: string) => void;
    onRevert: (noteId: string, historyEntry: NoteHistoryEntry) => void;
    onLinkItem: (projectId: string, itemType: ListType, itemId: string) => void;
    onUnlinkItem: (itemType: ListType, itemId: string) => void;
    voiceSettings: VoiceSettings;
}

const timeAgo = (date: string | Date): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " ans";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " mois";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " jours";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " heures";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes";
    return "quelques secondes";
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ isOpen, onClose, note, projects, onNavigateToProject, onEdit, onRevert, onLinkItem, onUnlinkItem, voiceSettings }) => {
    const [showHistory, setShowHistory] = useState(false);

    const handleNoteUpdate = (newContent: string) => {
        onEdit(note.id, newContent);
    };

    const { chatStatus, toggleSession, isAiSpeaking, audioContext, mediaStream } = useNoteEditingChat(note.content, handleNoteUpdate, voiceSettings);

    const handleRevert = (entry: NoteHistoryEntry) => {
        onRevert(note.id, entry);
        setShowHistory(false);
    };
    
    const handleClose = () => {
        if (chatStatus !== 'idle') {
            toggleSession();
        }
        onClose();
    };

    const project = note.projectId ? projects.find(p => p.id === note.projectId) : null;

    if (!isOpen) return null;
    
    const isSessionActive = chatStatus !== 'idle';
    const showVisualizer = chatStatus === 'listening';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl m-4 h-[85vh] flex flex-col transition-all duration-300 ease-in-out">
                <header className="flex items-center justify-between p-4 border-b gap-4">
                     <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-2 font-semibold"
                        aria-label="Toggle note history"
                    >
                        <ArrowUturnLeftIcon className="w-4 h-4 transform -scale-x-100" />
                        Historique
                    </button>
                    <div className="flex-1 flex justify-center">
                        {project ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => onNavigateToProject(project.id)} className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1 transition-colors">
                                    <RectangleGroupIcon className="w-4 h-4" />
                                    <span className="font-semibold">{project.title}</span>
                                </button>
                                <button onClick={() => onUnlinkItem('notes', note.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onLinkItem(e.target.value, 'notes', note.id);
                                    }
                                }}
                                className="max-w-xs p-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            >
                                <option value="" disabled>Lier à un projet...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2 transition-colors"
                        aria-label="Close note details"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="relative flex-grow flex flex-col p-6 min-h-0">
                    {note.address && (
                        <div className="pb-4 mb-4 border-b">
                            <label className="block text-sm font-medium text-slate-500 mb-1">Localisation</label>
                             <a
                                href={`https://www.google.com/maps/search/?api=1&query=${note.latitude},${note.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                            >
                                <MapPinIcon className="w-4 h-4" />
                                <span>{note.address}</span>
                            </a>
                        </div>
                    )}
                    <RichTextEditor 
                        initialContent={note.content}
                        onContentChange={(newContent) => onEdit(note.id, newContent)}
                    />
                    {showHistory && (
                        <div className="absolute top-0 right-0 bottom-0 w-64 bg-slate-50 border-l animate-fade-in-left p-4 overflow-y-auto z-10">
                            <h4 className="font-bold text-slate-700 mb-4">Historique des versions</h4>
                            {note.history && note.history.length > 0 ? (
                                <ul className="space-y-3">
                                    {note.history.map((entry, index) => (
                                        <li key={index} className="text-sm p-2 rounded-md bg-white border hover:shadow-sm">
                                            <p className="text-slate-500 mb-1">Il y a {timeAgo(entry.timestamp)}</p>
                                            <p className="text-slate-700 truncate mb-2">{entry.content}</p>
                                            <button 
                                                onClick={() => handleRevert(entry)}
                                                className="text-indigo-600 font-semibold hover:underline text-xs"
                                            >
                                                Restaurer
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500">Aucun historique disponible.</p>
                            )}
                        </div>
                    )}
                </div>

                <footer className="p-4 bg-slate-50 border-t flex items-center justify-center">
                    <button 
                        onClick={toggleSession} 
                        className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 overflow-hidden ${
                            isSessionActive
                                ? 'bg-red-500 text-white focus:ring-red-400'
                                : 'bg-indigo-600 text-white focus:ring-indigo-400'
                        }`}
                        aria-label={isSessionActive ? "Arrêter l'assistant vocal" : "Démarrer l'assistant vocal"}
                    >
                        <AudioVisualizer
                            status={chatStatus}
                            isAiSpeaking={isAiSpeaking}
                            audioContext={audioContext}
                            mediaStream={mediaStream}
                            className="absolute inset-0 w-full h-full"
                            waveColor="#c4b5fd"
                            pulseColor="#a78bfa"
                        />
                        <div className={`flex items-center justify-center transition-opacity duration-300 ${showVisualizer ? 'opacity-0' : 'opacity-100'}`}>
                            {chatStatus === 'connecting' && <LoaderIcon className="w-8 h-8 text-indigo-200" />}
                            {isSessionActive && chatStatus !== 'connecting' && <StopIcon className="w-8 h-8" />}
                            {(chatStatus === 'idle' || chatStatus === 'error') && <MicrophoneIcon className="w-8 h-8" />}
                        </div>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default NoteDetailModal;