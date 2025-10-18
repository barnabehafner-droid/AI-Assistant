import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { TodoItem, Priority, SubtaskItem, Project, VoiceSettings, InfoCard } from '../types';
import { XMarkIcon, TrashIcon, PlusIcon, PencilIcon, CheckIcon, MicrophoneIcon, LoaderIcon, StopIcon, RectangleGroupIcon, ArrowPathIcon, PhoneIcon, GlobeAltIcon, MapPinIcon, ClockIcon, ClipboardDocumentListIcon, InformationCircleIcon } from './icons';
import { useSubtaskGenerationChat } from '../hooks/useSubtaskGenerationChat';
import { ListType } from '../hooks/useOrganizerState';
import AudioVisualizer from './AudioVisualizer';
import RichTextEditor from './RichTextEditor';

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
    onReEnrich: (todoId: string, taskText: string, query: string) => Promise<void>;
    isEnriching: boolean;
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

const getIconForCardType = (type: InfoCard['type']) => {
    switch (type) {
        case 'PHONE': return <PhoneIcon className="w-5 h-5" />;
        case 'WEBSITE': return <GlobeAltIcon className="w-5 h-5" />;
        case 'ADDRESS': return <MapPinIcon className="w-5 h-5" />;
        case 'HOURS': return <ClockIcon className="w-5 h-5" />;
        case 'RECIPE_INGREDIENTS':
        case 'RECIPE_STEPS':
            return <ClipboardDocumentListIcon className="w-5 h-5" />;
        case 'GENERIC_TEXT':
        default:
            return <InformationCircleIcon className="w-5 h-5" />;
    }
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

const TodoDetailModal: React.FC<TodoDetailModalProps> = ({ isOpen, onClose, todo, projects, onNavigateToProject, onEditTitle, onEditPriority, onEditDescription, onAddSubtask, onToggleSubtask, onDeleteSubtask, onEditSubtask, onEditDueDate, onLinkItem, onUnlinkItem, voiceSettings, onReEnrich, isEnriching }) => {
    const [newSubtaskText, setNewSubtaskText] = useState('');
    const [isSearchingAgain, setIsSearchingAgain] = useState(false);
    const [customQuery, setCustomQuery] = useState('');
    const [checkedIngredients, setCheckedIngredients] = useState<Record<number, Set<string>>>({});
    
    useEffect(() => {
        if (isOpen) {
            setCheckedIngredients({});
            setCustomQuery(todo.enrichmentMetadata?.query || todo.task);
            setIsSearchingAgain(false);
        }
    }, [isOpen, todo]);
    
    const handleToggleIngredient = (cardIndex: number, ingredient: string) => {
        setCheckedIngredients(prev => {
            const newChecked = { ...prev };
            const cardSet = new Set(newChecked[cardIndex] || []);
            if (cardSet.has(ingredient)) {
                cardSet.delete(ingredient);
            } else {
                cardSet.add(ingredient);
            }
            newChecked[cardIndex] = cardSet;
            return newChecked;
        });
    };
    
    const handleAddSubtaskForHook = useCallback((text: string) => {
        onAddSubtask(todo.id, text);
    }, [todo.id, onAddSubtask]);

    const { chatStatus, toggleSession, isAiSpeaking, audioContext, mediaStream } = useSubtaskGenerationChat(todo, handleAddSubtaskForHook, voiceSettings);
    
    const titleRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
        }
    }, [todo.task, isOpen]);


    const handleAddSubtask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSubtaskText.trim()) {
            onAddSubtask(todo.id, newSubtaskText.trim());
            setNewSubtaskText('');
        }
    };
    
    const handleCustomEnrich = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customQuery.trim()) return;
        setIsSearchingAgain(false);
        await onReEnrich(todo.id, todo.task, customQuery);
    };

    const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;
    
    if (!isOpen) return null;

    const isSessionActive = chatStatus !== 'idle';
    const showVisualizer = chatStatus === 'listening';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <header className="flex items-start justify-between p-6 border-b">
                     <textarea
                        ref={titleRef}
                        value={todo.task}
                        onChange={(e) => onEditTitle(todo.id, e.target.value)}
                        onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                        rows={1}
                        className="text-2xl font-bold text-slate-800 w-full bg-transparent focus:outline-none focus:bg-slate-100 rounded p-1 -m-1 resize-none overflow-hidden"
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

                    {todo.enrichedData && todo.enrichedData.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-slate-500">Informations (via IA)</h4>
                                <div className="flex items-center gap-2">
                                    {isEnriching && <LoaderIcon className="w-4 h-4" />}
                                    <button onClick={() => setIsSearchingAgain(prev => !prev)} className="text-slate-400 hover:text-indigo-600" aria-label="Rechercher à nouveau">
                                        <ArrowPathIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {isSearchingAgain && (
                                <form onSubmit={handleCustomEnrich} className="mb-4 flex gap-2 animate-fade-in">
                                    <input
                                        type="text"
                                        value={customQuery}
                                        onChange={(e) => setCustomQuery(e.target.value)}
                                        className="flex-grow w-full px-3 py-1.5 text-sm bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                                        placeholder="Modifier la recherche..."
                                        autoFocus
                                    />
                                    <button type="submit" className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Rechercher</button>
                                </form>
                            )}
                            <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                                {todo.enrichedData.map((card, index) => {
                                    const icon = getIconForCardType(card.type);
                                    let contentElement: React.ReactNode;

                                    switch (card.type) {
                                        case 'PHONE':
                                            contentElement = <a href={`tel:${card.content}`} className="text-indigo-600 hover:underline font-medium break-words text-sm">{card.content as string}</a>;
                                            break;
                                        case 'ADDRESS':
                                            contentElement = <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.content as string)}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm break-words">{card.content as string}</a>;
                                            break;
                                        case 'WEBSITE':
                                            let url = card.content as string;
                                            if (!/^https?:\/\//i.test(url)) { url = 'https://' + url; }
                                            contentElement = <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm break-words">{card.content as string}</a>;
                                            break;
                                        case 'HOURS':
                                            const hoursContent = Array.isArray(card.content) ? card.content.join('\n') : card.content;
                                            contentElement = <p className="text-slate-600 text-sm whitespace-pre-wrap break-words">{hoursContent}</p>;
                                            break;
                                        case 'RECIPE_INGREDIENTS':
                                            contentElement = (
                                                <ul className="space-y-2">
                                                    {(card.content as string[]).map((ing, i) => (
                                                        <li key={i} className="flex items-center">
                                                            <input id={`ing-${index}-${i}`} type="checkbox" checked={checkedIngredients[index]?.has(ing) ?? false} onChange={() => handleToggleIngredient(index, ing)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                                            <label htmlFor={`ing-${index}-${i}`} className={`ml-3 text-sm text-slate-700 cursor-pointer ${checkedIngredients[index]?.has(ing) ? 'line-through text-slate-500' : ''}`}>{ing}</label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            );
                                            break;
                                        case 'RECIPE_STEPS':
                                             contentElement = (
                                                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700 pl-2">
                                                    {(card.content as string[]).map((step, i) => <li key={i}>{step}</li>)}
                                                </ol>
                                            );
                                            break;
                                        default: // GENERIC_TEXT
                                            contentElement = <p className="text-slate-600 text-sm break-words">{card.content as string}</p>;
                                            break;
                                    }

                                    return (
                                        <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0 mt-0.5 text-slate-500">{icon}</div>
                                                <div className="min-w-0 flex-grow">
                                                    <p className="font-semibold text-slate-700 mb-1">{card.label}</p>
                                                    {contentElement}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {todo.enrichmentMetadata?.sources && todo.enrichmentMetadata.sources.length > 0 && (
                                <div className="mt-2 text-right">
                                    <p><small className="text-slate-500">Sources: {
                                        todo.enrichmentMetadata.sources.map((source, index) => (
                                            <React.Fragment key={source.uri}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-500 text-xs hover:underline">{source.title || new URL(source.uri).hostname}</a>
                                                {index < todo.enrichmentMetadata.sources.length - 1 && ', '}
                                            </React.Fragment>
                                        ))
                                    }</small></p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <div className="h-48 flex flex-col">
                            <RichTextEditor
                                initialContent={todo.description}
                                onContentChange={(newContent) => onEditDescription(todo.id, newContent)}
                            />
                        </div>
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