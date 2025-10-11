import React, { useState, useEffect, useRef } from 'react';
import { NoteItem, Project, VoiceSettings, NoteHistoryEntry } from '../types';
import { XMarkIcon, MicrophoneIcon, StopIcon, LoaderIcon, RectangleGroupIcon, ArrowUturnLeftIcon, BoldIcon, ItalicIcon, UnderlineIcon, ListBulletIcon, ListOrderedIcon, TableCellsIcon } from './icons';
import { useNoteEditingChat } from '../hooks/useNoteEditingChat';
import { ListType } from '../hooks/useOrganizerState';

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
    const [localContent, setLocalContent] = useState(note.content);
    const [showHistory, setShowHistory] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
    const [hoveredTableSize, setHoveredTableSize] = useState({ rows: 0, cols: 0 });
    const tablePickerRef = useRef<HTMLDivElement>(null);
    const [toolbarState, setToolbarState] = useState({
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isUl: false,
        isOl: false,
    });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);


    useEffect(() => {
        setLocalContent(note.content);
        if (editorRef.current && editorRef.current.innerHTML !== note.content) {
            editorRef.current.innerHTML = note.content;
        }
    }, [note.content]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isTablePickerOpen && tablePickerRef.current && !tablePickerRef.current.contains(event.target as Node)) {
                setIsTablePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTablePickerOpen]);

    const handleNoteUpdate = (newContent: string) => {
        onEdit(note.id, newContent);
    };

    const { chatStatus, toggleSession, isAiSpeaking, audioContext, mediaStream } = useNoteEditingChat(note.content, handleNoteUpdate, voiceSettings);

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
        
        if (chatStatus === 'listening' && isAiSpeaking) {
            stopAnimation();
            const baseRadius = Math.min(width, height) / 2 * 0.65;
            ctx.strokeStyle = '#a78bfa'; // violet-400
            ctx.lineWidth = 2.5;

            const drawPulse = (timestamp: number) => {
                ctx.clearRect(0, 0, width, height);
                const pulse = Math.sin(timestamp / 200) * 4 + 6;
                const radius = baseRadius + pulse;

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.stroke();

                animationFrameIdRef.current = requestAnimationFrame(drawPulse);
            };
            drawPulse(performance.now());
        
        } else if (chatStatus === 'listening' && !isAiSpeaking && audioContext && mediaStream) {
            stopAnimation();
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContext.createMediaStreamSource(mediaStream);
            sourceRef.current.connect(analyserRef.current);

            const bufferLength = analyserRef.current.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            
            ctx.strokeStyle = '#c4b5fd'; // violet-300
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

    }, [chatStatus, isAiSpeaking, audioContext, mediaStream]);


    const handleManualEdit = () => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            if (newContent !== localContent) {
                setLocalContent(newContent);
            }
        }
    };
    
    const handleBlur = () => {
        if (editorRef.current && localContent !== note.content) {
            onEdit(note.id, editorRef.current.innerHTML);
        }
    };

    const handleRevert = (entry: NoteHistoryEntry) => {
        onRevert(note.id, entry);
        setShowHistory(false);
    };
    
    const handleClose = () => {
        if (chatStatus !== 'idle') {
            toggleSession();
        }
        handleBlur();
        onClose();
    };

    const project = note.projectId ? projects.find(p => p.id === note.projectId) : null;

    const updateToolbarState = () => {
        if (!editorRef.current) return;
        setToolbarState({
            isBold: document.queryCommandState('bold'),
            isItalic: document.queryCommandState('italic'),
            isUnderline: document.queryCommandState('underline'),
            isUl: document.queryCommandState('insertUnorderedList'),
            isOl: document.queryCommandState('insertOrderedList'),
        });
    };

    const handleToolbarAction = (e: React.MouseEvent, action: () => void) => {
        e.preventDefault();
        editorRef.current?.focus();
        action();
        updateToolbarState();
        handleManualEdit();
    };
    
    const insertTable = (rows: number, cols: number) => {
        if (rows === 0 || cols === 0) return;
        let tableHtml = '<table><tbody>';
        for (let r = 0; r < rows; r++) {
            tableHtml += '<tr>';
            for (let c = 0; c < cols; c++) {
                tableHtml += '<td><br></td>';
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table><p><br></p>';
        
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, tableHtml);
        setIsTablePickerOpen(false);
        handleManualEdit();
    };

    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === editorRef.current) {
                updateToolbarState();
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

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
                <div className="relative flex-grow h-full flex flex-col">
                    <div className="editor-toolbar">
                        <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('bold'))} className={toolbarState.isBold ? 'active' : ''} title="Gras"><BoldIcon className="w-5 h-5"/></button>
                        <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('italic'))} className={toolbarState.isItalic ? 'active' : ''} title="Italique"><ItalicIcon className="w-5 h-5"/></button>
                        <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('underline'))} className={toolbarState.isUnderline ? 'active' : ''} title="Souligné"><UnderlineIcon className="w-5 h-5"/></button>
                        <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('insertUnorderedList'))} className={toolbarState.isUl ? 'active' : ''} title="Liste à puces"><ListBulletIcon className="w-5 h-5"/></button>
                        <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('insertOrderedList'))} className={toolbarState.isOl ? 'active' : ''} title="Liste numérotée"><ListOrderedIcon className="w-5 h-5"/></button>
                        <div className="relative" ref={tablePickerRef}>
                            <button 
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsTablePickerOpen(prev => !prev);
                                }} 
                                title="Insérer un tableau"
                                className={isTablePickerOpen ? 'active' : ''}
                            >
                                <TableCellsIcon className="w-5 h-5"/>
                            </button>
                            {isTablePickerOpen && (
                                <div className="absolute top-full mt-2 left-0 bg-white shadow-lg border rounded-md p-2 z-20">
                                    <div className="grid grid-cols-10 gap-1" onMouseLeave={() => setHoveredTableSize({rows: 0, cols: 0})}>
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const row = Math.floor(i / 10);
                                            const col = i % 10;
                                            const isHovered = row < hoveredTableSize.rows && col < hoveredTableSize.cols;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`w-5 h-5 border border-slate-200 cursor-pointer ${isHovered ? 'bg-indigo-300 border-indigo-400' : 'bg-slate-100 hover:bg-slate-200'}`}
                                                    onMouseOver={() => setHoveredTableSize({ rows: row + 1, cols: col + 1 })}
                                                    onClick={() => insertTable(hoveredTableSize.rows, hoveredTableSize.cols)}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="text-center text-sm text-slate-600 pt-2 h-5">
                                        {hoveredTableSize.rows > 0 ? `${hoveredTableSize.rows} x ${hoveredTableSize.cols}` : 'Taille'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-grow relative">
                         <div
                            ref={editorRef}
                            contentEditable={true}
                            onInput={handleManualEdit}
                            onBlur={handleBlur}
                            onFocus={updateToolbarState}
                            onClick={updateToolbarState}
                            onKeyUp={updateToolbarState}
                            className="absolute inset-0 editor-content"
                            aria-label="Contenu de la note"
                        />
                    </div>
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
                        <canvas 
                            ref={canvasRef} 
                            className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${showVisualizer ? 'opacity-100' : 'opacity-0'}`}
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