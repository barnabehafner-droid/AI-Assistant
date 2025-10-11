import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TodoItem, Priority, SubtaskItem, Project, VoiceSettings } from '../types';
import { XMarkIcon, TrashIcon, PlusIcon, PencilIcon, CheckIcon, MicrophoneIcon, LoaderIcon, StopIcon, RectangleGroupIcon } from './icons';
import { useSubtaskGenerationChat } from '../hooks/useSubtaskGenerationChat';
import { ListType } from '../hooks/useOrganizerState';

interface TodoDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    todo: TodoItem;
    projects: Project[];
    onNavigateToProject: (projectId: string) => void;
    onEditTitle: (id: string, newTitle: string) => void;
    onEditPriority: (id: string, newPriority: Priority) => void;
    onEditDescription: (id: string, newDescription: string) => void;
    onAddSubtask: (todoId: string, text: string) => void;
    onToggleSubtask: (todoId: string, subtaskId: string) => void;
    onDeleteSubtask: (todoId: string, subtaskId: string) => void;
    onEditSubtask: (todoId: string, subtaskId: string, newText: string) => void;
    onEditDueDate: (id: string, dueDate: string | null) => void;
    onLinkItem: (projectId: string, itemType: ListType, itemId: string) => void;
    onUnlinkItem: (itemType: ListType, itemId: string) => void;
    voiceSettings: VoiceSettings;
}

const priorityStyles: Record<Priority, string> = {
    [Priority.High]: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
    [Priority.Medium]: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200',
    [Priority.Low]: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
};

const nextPriority: Record<Priority, Priority> = {
    [Priority.Low]: Priority.Medium,
    [Priority.Medium]: Priority.High,
    [Priority.High]: Priority.Low,
};

const Subtask: React.FC<{
    subtask: SubtaskItem;
    todoId: string;
    onToggle: (todoId: string, subtaskId: string) => void;
    onDelete: (todoId: string, subtaskId: string) => void;
    onEdit: (todoId: string, subtaskId: string, newText: string) => void;
}> = ({ subtask, todoId, onToggle, onDelete, onEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(subtask.text);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== subtask.text) {
            onEdit(todoId, subtask.id, editText.trim());
        }
        setIsEditing(false);
    };

    return (
        <li className="flex items-center gap-2 group py-1">
            <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggle(todoId, subtask.id)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="flex-grow bg-slate-200 rounded px-1 -my-0.5"
                />
            ) : (
                <span className={`flex-grow ${subtask.completed ? 'line-through text-slate-500' : ''}`}>{subtask.text}</span>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-indigo-600"><PencilIcon className="w-4 h-4" /></button>
                 <button onClick={() => onDelete(todoId, subtask.id)} className="text-slate-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
            </div>
        </li>
    );
};

const TodoDetailModal: React.FC<TodoDetailModalProps> = ({ isOpen, onClose, todo, projects, onNavigateToProject, onEditTitle, onEditPriority, onEditDescription, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask, onEditDueDate, onLinkItem, onUnlinkItem, voiceSettings }) => {
    const [newSubtaskText, setNewSubtaskText] = useState('');
    
    const handleAddSubtaskForHook = useCallback((text: string) => {
        onAddSubtask(todo.id, text);
    }, [todo.id, onAddSubtask]);

    const { chatStatus, toggleSession, isAiSpeaking, audioContext, mediaStream } = useSubtaskGenerationChat(todo, handleAddSubtaskForHook, voiceSettings);

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
        
        if (chatStatus === 'listening' && isAiSpeaking) {
            stopAnimation();
            const baseRadius = Math.min(width, height) / 2 * 0.65;
            ctx.strokeStyle = '#a78bfa'; // violet-400
            ctx.lineWidth = 1.5;

            const drawPulse = (timestamp: number) => {
                ctx.clearRect(0, 0, width, height);
                const pulse = Math.sin(timestamp / 200) * 2 + 3;
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
            ctx.lineWidth = 1.5;

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

    const handleAddSubtask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSubtaskText.trim()) {
            onAddSubtask(todo.id, newSubtaskText.trim());
            setNewSubtaskText('');
        }
    };

    const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
    
    if (!isOpen) return null;

    const isSessionActive = chatStatus !== 'idle';
    const showVisualizer = chatStatus === 'listening';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <header className="flex items-start justify-between p-6 border-b">
                     <input
                        type="text"
                        value={todo.task}
                        onChange={(e) => onEditTitle(todo.id, e.target.value)}
                        className="text-2xl font-bold text-slate-800 w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded p-1 -m-1"
                    />
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 ml-4">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">Priorité</label>
                            <button
                                onClick={() => onEditPriority(todo.id, nextPriority[todo.priority])}
                                className={`px-3 py-1 text-sm font-semibold rounded-full border transition-colors duration-150 ${priorityStyles[todo.priority]}`}
                            >
                                {todo.priority}
                            </button>
                        </div>
                        <div>
                            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-500 mb-1">Date limite</label>
                            <input
                                type="date"
                                id="dueDate"
                                value={todo.dueDate || ''}
                                onChange={(e) => onEditDueDate(todo.id, e.target.value || null)}
                                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Projet</label>
                        {project ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => onNavigateToProject(project.id)} className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full px-3 py-1 transition-colors">
                                    <RectangleGroupIcon className="w-4 h-4" />
                                    <span className="font-semibold">{project.title}</span>
                                </button>
                                <button onClick={() => onUnlinkItem('todos', todo.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onLinkItem(e.target.value, 'todos', todo.id);
                                    }
                                }}
                                className="max-w-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            >
                                <option value="" disabled>Lier à un projet...</option>
                                {projects.filter(p => p.id !== todo.projectId).map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <textarea
                            id="description"
                            value={todo.description}
                            onChange={(e) => onEditDescription(todo.id, e.target.value)}
                            placeholder="Ajouter plus de détails..."
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            rows={4}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-slate-500">Sous-tâches ({todo.subtasks.filter(st => st.completed).length} / {todo.subtasks.length})</h4>
                            <button
                                onClick={toggleSession}
                                aria-label="Générer les sous-tâches avec l'IA"
                                className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 overflow-hidden ${
                                    isSessionActive
                                        ? 'bg-red-500 text-white focus:ring-red-400'
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200 focus:ring-purple-400'
                                }`}
                            >
                                <canvas 
                                    ref={canvasRef} 
                                    className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${showVisualizer ? 'opacity-100' : 'opacity-0'}`}
                                />
                                <div className={`flex items-center justify-center transition-opacity duration-300 ${showVisualizer ? 'opacity-0' : 'opacity-100'}`}>
                                    {chatStatus === 'connecting' && <LoaderIcon className="w-4 h-4" />}
                                    {isSessionActive && chatStatus !== 'connecting' && <StopIcon className="w-4 h-4" />}
                                    {(chatStatus === 'idle' || chatStatus === 'error') && <MicrophoneIcon className="w-4 h-4" />}
                                </div>
                            </button>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                           {todo.subtasks.length > 0 && (
                             <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${(todo.subtasks.filter(st => st.completed).length / todo.subtasks.length) * 100}%` }}></div>
                           )}
                        </div>
                        <ul className="space-y-1">
                            {todo.subtasks.map(subtask => (
                                <Subtask 
                                    key={subtask.id}
                                    subtask={subtask}
                                    todoId={todo.id}
                                    onToggle={onToggleSubtask}
                                    onDelete={onDeleteSubtask}
                                    onEdit={onEditSubtask}
                                />
                            ))}
                        </ul>
                         <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                            <input
                                type="text"
                                value={newSubtaskText}
                                onChange={(e) => setNewSubtaskText(e.target.value)}
                                placeholder="Ajouter une sous-tâche..."
                                className="flex-grow w-full px-3 py-1.5 text-base bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                            />
                            <button type="submit" className="p-2 flex items-center justify-center bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                                <PlusIcon className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>

                <footer className="p-4 bg-slate-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                        Fermer
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TodoDetailModal;