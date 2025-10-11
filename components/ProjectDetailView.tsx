import React, { useState, useRef, useEffect } from 'react';
import { Project, NoteItem, FullEmail, CalendarEvent, SelectionState } from '../types';
import { useOrganizerState, DragItemInfo, ListType } from '../hooks/useOrganizerState';
import { ArrowLeftIcon, Cog6ToothIcon, EyeIcon, EyeSlashIcon } from './icons';
import TodoList from './TodoList';
import ShoppingList from './ShoppingList';
import NotesList from './NotesList';
import CustomListComponent from './CustomListComponent';
import ConversationalChatButton from './ConversationalChatButton';

interface DragAndDropProps {
    onDragStart: (itemInfo: DragItemInfo) => void;
    onDragEnd: () => void;
    onDragEnter: (type: ListType, listId?: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (type: ListType, listId?: string, index?: number) => void;
    draggingItem: DragItemInfo | null;
}

type ChatButtonProps = {
    status: 'idle' | 'connecting' | 'listening' | 'error';
    onClick: () => void;
    audioContext: AudioContext | null;
    mediaStream: MediaStream | null;
    isAiSpeaking: boolean;
};

interface ProjectDetailViewProps {
  project: Project;
  organizerState: ReturnType<typeof useOrganizerState>;
  onOpenTodoDetails: (id: string) => void;
  onOpenShoppingDetails: (id: string) => void;
  onOpenNoteDetails: (id: string) => void;
  onOpenCustomItemDetails: (listId: string, itemId: string) => void;
  dragAndDropProps: DragAndDropProps;
  onBack: () => void;
  chatButtonProps: ChatButtonProps;
  gmailEmails: FullEmail[];
  calendarEvents: CalendarEvent[];
  onOpenEmail: (emailId: string) => void;
  onOpenEvent: (event: CalendarEvent | null) => void;
}

const VisibilitySettings: React.FC<{
    project: Project;
    onUpdate: (settings: Parameters<ReturnType<typeof useOrganizerState>['updateProjectVisibility']>[1]) => void;
}> = ({ project, onUpdate }) => {
    const hiddenItemTypes = project.hiddenItemTypes || {};
    return (
        <div className="p-4 space-y-4">
            <h4 className="text-sm font-semibold text-slate-600">Paramètres de Visibilité</h4>
            <div className="flex items-center justify-between p-2 bg-slate-100 rounded-md">
                <label htmlFor="hide-project" className="text-sm font-medium text-slate-800">Masquer le projet dans la vue principale</label>
                <button onClick={() => onUpdate({ isHiddenInMainView: !project.isHiddenInMainView })}>
                    {project.isHiddenInMainView ? <EyeSlashIcon className="w-5 h-5 text-red-500" /> : <EyeIcon className="w-5 h-5 text-green-500" />}
                </button>
            </div>
            {!project.isHiddenInMainView && (
                <div>
                    <p className="text-xs text-slate-500 mb-2">Masquer des types d'éléments spécifiques dans la vue principale :</p>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm p-1">
                            <label>Tâches</label>
                            <button onClick={() => onUpdate({ hiddenItemTypes: { todos: !hiddenItemTypes.todos } })}>
                                {hiddenItemTypes.todos ? <EyeSlashIcon className="w-5 h-5 text-slate-500" /> : <EyeIcon className="w-5 h-5 text-slate-400" />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-sm p-1">
                            <label>Courses</label>
                             <button onClick={() => onUpdate({ hiddenItemTypes: { shopping: !hiddenItemTypes.shopping } })}>
                                {hiddenItemTypes.shopping ? <EyeSlashIcon className="w-5 h-5 text-slate-500" /> : <EyeIcon className="w-5 h-5 text-slate-400" />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-sm p-1">
                            <label>Notes</label>
                             <button onClick={() => onUpdate({ hiddenItemTypes: { notes: !hiddenItemTypes.notes } })}>
                                {hiddenItemTypes.notes ? <EyeSlashIcon className="w-5 h-5 text-slate-500" /> : <EyeIcon className="w-5 h-5 text-slate-400" />}
                            </button>
                        </div>
                         <div className="flex items-center justify-between text-sm p-1">
                            <label>Listes personnalisées</label>
                             <button onClick={() => onUpdate({ hiddenItemTypes: { customLists: !hiddenItemTypes.customLists } })}>
                                {hiddenItemTypes.customLists ? <EyeSlashIcon className="w-5 h-5 text-slate-500" /> : <EyeIcon className="w-5 h-5 text-slate-400" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  organizerState,
  onOpenTodoDetails,
  onOpenShoppingDetails,
  onOpenNoteDetails,
  onOpenCustomItemDetails,
  dragAndDropProps,
  onBack,
  chatButtonProps,
  gmailEmails,
  calendarEvents,
  onOpenEmail,
  onOpenEvent,
}) => {
    const {
        todos, shoppingList, notes, customLists, projects,
        handleToggleTodo, editTodoPriority,
        handleToggleShoppingItem,
        addCustomListItem, deleteCustomList, toggleCustomListItem,
        todoSortOrder, setTodoSortOrder,
        activeFilter, clearFilter,
        updateProjectVisibility
    } = organizerState;

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    
    const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>({});
    const handleToggleWidget = (widgetId: string) => {
        setCollapsedWidgets(prev => ({
            ...prev,
            [widgetId]: !prev[widgetId]
        }));
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const { draggingItem, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop } = dragAndDropProps;

    const linkedTodos = todos.filter(item => item.projectId === project.id);
    const linkedShoppingItems = shoppingList.filter(item => item.projectId === project.id);
    const linkedNotes = notes.filter(note => note.projectId === project.id);
    
    const linkedEmails = gmailEmails.filter(email => project.linkedItemIds.linkedEmailIds?.includes(email.id));
    const linkedEvents = calendarEvents.filter(event => project.linkedItemIds.linkedEventIds?.includes(event.id));
    
    // Group custom list items by their original list
    const linkedCustomListsGrouped = customLists.map(list => {
        const linkedItemsInList = list.items.filter(item => item.projectId === project.id);
        return {
            ...list,
            items: linkedItemsInList
        };
    }).filter(list => list.items.length > 0);
    
    // FIX: Provide dummy selection props as this view doesn't use selection mode.
    const selectionProps = {
        selection: { isActive: false, type: null } as SelectionState,
        selectedIds: new Set<string>(),
        onStartSelection: () => {},
        onEndSelection: () => {},
        onToggleSelection: () => {},
        onSelectAll: () => {},
        onClearSelection: () => {},
    };

    return (
        <div className="animate-fade-in space-y-8">
            <header className="flex justify-between items-start">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-semibold p-2 -ml-2">
                    <ArrowLeftIcon className="w-5 h-5"/>
                    Retour aux Projets
                </button>
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-800">{project.title}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={settingsRef}>
                        <button onClick={() => setIsSettingsOpen(prev => !prev)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full">
                            <Cog6ToothIcon className="w-6 h-6"/>
                        </button>
                        {isSettingsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border z-10">
                                <VisibilitySettings project={project} onUpdate={(settings) => updateProjectVisibility(project.id, settings)} />
                            </div>
                        )}
                    </div>
                    <ConversationalChatButton {...chatButtonProps} />
                </div>
            </header>
            
            {project.description && <p className="text-slate-600 text-lg max-w-3xl mx-auto text-center -mt-4">{project.description}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {linkedEmails.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">E-mails Liés</h2>
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {linkedEmails.map(email => (
                                <li key={email.id}>
                                    <button onClick={() => onOpenEmail(email.id)} className="w-full text-left p-3 rounded-md hover:bg-slate-100 transition-colors bg-slate-50">
                                        <div className="font-semibold text-slate-800 text-sm truncate">{email.from}</div>
                                        <p className="truncate text-sm text-indigo-800 font-semibold">{email.subject}</p>
                                        <p className="text-slate-500 text-xs mt-1 truncate">{email.aiSummary || email.snippet}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 {linkedEvents.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-2">Événements Liés</h2>
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {linkedEvents.map(event => (
                                <li key={event.id}>
                                    <button onClick={() => onOpenEvent(event)} className="w-full text-left p-3 rounded-md hover:bg-slate-100 transition-colors bg-slate-50">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <span style={{ backgroundColor: event.backgroundColor }} className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"></span>
                                                <span className="font-bold text-slate-800 text-sm truncate">{event.summary}</span>
                                            </div>
                                            <span className="text-xs text-indigo-600 font-semibold flex-shrink-0">{new Date(event.start.dateTime || event.start.date!).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {linkedTodos.length > 0 && (
                    <TodoList 
                        items={linkedTodos}
                        projects={projects}
                        onToggle={handleToggleTodo}
                        onEditPriority={editTodoPriority}
                        onOpenDetails={onOpenTodoDetails}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        draggingItem={draggingItem}
                        isDropTarget={false}
                        sortOrder={todoSortOrder}
                        onSetSortOrder={setTodoSortOrder}
                        activeFilter={activeFilter}
                        onClearFilter={clearFilter}
                        isCollapsed={!!collapsedWidgets['todos']}
                        onToggleCollapse={() => handleToggleWidget('todos')}
                        {...selectionProps}
                    />
                )}
                 {linkedShoppingItems.length > 0 && (
                    <ShoppingList
                        items={linkedShoppingItems}
                        projects={projects}
                        onToggle={handleToggleShoppingItem}
                        onOpenDetails={onOpenShoppingDetails}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        draggingItem={draggingItem}
                        isDropTarget={false}
                        activeFilter={activeFilter}
                        onClearFilter={clearFilter}
                        isCollapsed={!!collapsedWidgets['shopping']}
                        onToggleCollapse={() => handleToggleWidget('shopping')}
                        {...selectionProps}
                    />
                )}
                {linkedNotes.length > 0 && (
                     <NotesList
                        items={linkedNotes}
                        projects={projects}
                        onOpenDetails={onOpenNoteDetails}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        draggingItem={draggingItem}
                        isDropTarget={false}
                        isCollapsed={!!collapsedWidgets['notes']}
                        onToggleCollapse={() => handleToggleWidget('notes')}
                        {...selectionProps}
                   />
                )}
                {linkedCustomListsGrouped.map(list => (
                     <CustomListComponent 
                        key={list.id} 
                        list={list}
                        projects={projects}
                        onAddItem={addCustomListItem}
                        onDeleteList={deleteCustomList}
                        onToggleItem={toggleCustomListItem}
                        onOpenDetails={onOpenCustomItemDetails}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragEnter={onDragEnter}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        draggingItem={draggingItem}
                        isDropTarget={false}
                        activeFilter={activeFilter}
                        onClearFilter={clearFilter}
                        isCollapsed={!!collapsedWidgets[`custom_${list.id}`]}
                        onToggleCollapse={() => handleToggleWidget(`custom_${list.id}`)}
                        {...selectionProps}
                    />
                ))}
            </div>
             {(linkedTodos.length + linkedShoppingItems.length + linkedNotes.length + linkedCustomListsGrouped.length + linkedEmails.length + linkedEvents.length) === 0 && (
                <div className="text-center py-16 bg-white rounded-xl shadow-md">
                    <h2 className="text-2xl font-bold text-slate-700">Ce projet est vide !</h2>
                    <p className="text-slate-500 mt-2">Retournez au tableau de bord et cliquez sur "Lier des éléments" pour commencer.</p>
                </div>
            )}
        </div>
    );
};

export default ProjectDetailView;