

import React, { useState, useRef, useEffect } from 'react';
import { Project, NoteItem, FullEmail, CalendarEvent, SelectionState, ShoppingSortOrder } from '../types';
import { useOrganizerState, DragItemInfo, ListType } from '../hooks/useOrganizerState';
import { ArrowLeftIcon, Cog6ToothIcon, EyeIcon, EyeSlashIcon } from './icons';
import TodoList from './TodoList';
import ShoppingList from './ShoppingList';
import NotesList from './NotesList';
import CustomListComponent from './CustomListComponent';

interface DragAndDropProps {
    onDragStart: (itemInfo: DragItemInfo) => void;
    onDragEnd: () => void;
    onDragEnter: (type: ListType, listId?: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (type: ListType, listId?: string, index?: number) => void;
    draggingItem: DragItemInfo | null;
}

interface ProjectDetailViewProps {
  project: Project;
  organizerState: ReturnType<typeof useOrganizerState>;
  onOpenTodoDetails: (id: string) => void;
  onOpenShoppingDetails: (id: string) => void;
  onOpenNoteDetails: (id: string) => void;
  onOpenCustomItemDetails: (listId: string, itemId: string) => void;
  dragAndDropProps: DragAndDropProps;
  onBack: () => void;
  gmailEmails: FullEmail[];
  calendarEvents: CalendarEvent[];
  onOpenEmail: (emailId: string) => void;
  onOpenEvent: (event: CalendarEvent | null) => void;
  onAddTodo: () => void;
  onAddShoppingItem: () => void;
  onAddNote: () => void;
  onSetShoppingSortOrder: (order: ShoppingSortOrder) => void;
  onCategorizeItems: () => void;
  isCategorizing: boolean;
  enrichingTodoIds: Set<string>;
  mapsApiLoaded: boolean;
}

const VisibilitySettings: React.FC<{
    project: Project;
    onUpdate: (settings: Parameters<ReturnType<typeof useOrganizerState>['updateProjectVisibility']>[1]) => void;
}> = ({ project, onUpdate }) => {
    const hiddenItemTypes = project.hiddenItemTypes || {};
    
    const visibilityOptions: { key: keyof Project['hiddenItemTypes'], label: string }[] = [
        { key: 'todos', label: 'Tâches' },
        { key: 'shopping', label: 'Courses' },
        { key: 'notes', label: 'Notes' },
        { key: 'customLists', label: 'Listes personnalisées' },
    ];
    
    return (
        <div className="p-4 space-y-4">
            <h4 className="text-sm font-semibold text-slate-600">Visibilité</h4>
            <div className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100">
                <label htmlFor="hide-in-main-view" className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <EyeSlashIcon className="w-4 h-4" />
                    Cacher ce projet dans la vue principale
                </label>
                <input
                    id="hide-in-main-view"
                    type="checkbox"
                    checked={project.isHiddenInMainView ?? false}
                    onChange={e => onUpdate({ isHiddenInMainView: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
            </div>
            <div className="pt-2">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cacher les types d'éléments dans la vue principale</h5>
                {visibilityOptions.map(({ key, label }) => (
                     <div key={key} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100">
                        <label htmlFor={`hide-${key}`} className="text-sm font-medium text-slate-800">{label}</label>
                        <input
                            id={`hide-${key}`}
                            type="checkbox"
                            checked={hiddenItemTypes[key] ?? false}
                            onChange={e => onUpdate({ hiddenItemTypes: { ...hiddenItemTypes, [key]: e.target.checked } })}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
    project,
    organizerState,
    onOpenTodoDetails,
    onOpenShoppingDetails,
    onOpenNoteDetails,
    onOpenCustomItemDetails,
    dragAndDropProps,
    onBack,
    gmailEmails,
    calendarEvents,
    onOpenEmail,
    onOpenEvent,
    onAddTodo,
    onAddShoppingItem,
    onAddNote,
    onSetShoppingSortOrder,
    onCategorizeItems,
    isCategorizing,
    enrichingTodoIds,
    mapsApiLoaded,
}) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    // FIX: Add local state to track the drop target within this view, as it's not passed down from App.tsx.
    const [dropTarget, setDropTarget] = useState<{ type: ListType, listId?: string } | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // FIX: Remove 'showUndoToast' from destructuring as it does not exist on organizerState.
    const { todos, shoppingList, notes, customLists, editShoppingItemDetails } = organizerState;
    
    // Filter items linked to this project
    const linkedTodos = todos.filter(item => project.linkedItemIds.todoIds.includes(item.id));
    const linkedShopping = shoppingList.filter(item => project.linkedItemIds.shoppingItemIds.includes(item.id));
    const linkedNotes = notes.filter(item => project.linkedItemIds.noteIds.includes(item.id));
    const linkedCustomLists = customLists.map(list => ({
        ...list,
        items: list.items.filter(item => project.linkedItemIds.customListItemIds[item.id] === list.id)
    })).filter(list => list.items.length > 0);
    const linkedEmails = gmailEmails.filter(email => project.linkedItemIds.linkedEmailIds?.includes(email.id));
    const linkedEvents = calendarEvents.filter(event => project.linkedItemIds.linkedEventIds?.includes(event.id));
    
    const selectionProps = {
        selection: organizerState.selection,
        selectedIds: organizerState.selectedIds,
        onStartSelection: organizerState.startSelectionMode,
        onEndSelection: organizerState.endSelectionMode,
        onToggleSelection: organizerState.toggleItemSelected,
        onSelectAll: organizerState.selectAllInList,
        onClearSelection: organizerState.clearSelection,
    };
    
    // FIX: Enhance the passed drag-and-drop props with wrappers that update the local dropTarget state.
    const enhancedDragAndDropProps = {
        ...dragAndDropProps,
        onDragEnter: (type: ListType, listId?: string) => {
            setDropTarget({ type, listId });
            dragAndDropProps.onDragEnter(type, listId);
        },
        onDragEnd: () => {
            setDropTarget(null);
            dragAndDropProps.onDragEnd();
        },
    };

    return (
        <div className="animate-fade-in max-w-7xl mx-auto">
            <header className="flex items-start justify-between mb-8">
                <div className="flex items-start gap-4">
                    <button onClick={onBack} className="flex-shrink-0 mt-2 p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold text-slate-800">{project.title}</h1>
                        <p className="text-slate-600 mt-2">{project.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={settingsRef}>
                        <button onClick={() => setIsSettingsOpen(prev => !prev)} className="w-14 h-14 flex items-center justify-center rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400" aria-label="Project settings">
                            <Cog6ToothIcon className="w-6 h-6" />
                        </button>
                         {isSettingsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl z-20 border">
                                <VisibilitySettings project={project} onUpdate={(settings) => organizerState.updateProjectVisibility(project.id, settings)} />
                            </div>
                         )}
                    </div>
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Lists */}
                {/* FIX: Pass the isDropTarget prop to each list component, calculated from the new local state. */}
                {/* FIX: Pass missing 'enrichingTodoIds' prop to TodoList. */}
                {linkedTodos.length > 0 && <TodoList items={linkedTodos} projects={[]} onToggle={id => organizerState.handleToggleTodo(id)} onEditPriority={(id, p) => organizerState.editTodoPriority(id, p)} onOpenDetails={onOpenTodoDetails} {...enhancedDragAndDropProps} isDropTarget={dropTarget?.type === 'todos'} sortOrder={organizerState.todoSortOrder} onSetSortOrder={o => organizerState.setTodoSortOrder(o)} activeFilter={null} onClearFilter={() => {}} isCollapsed={false} onToggleCollapse={() => {}} {...selectionProps} onAddItem={onAddTodo} enrichingTodoIds={enrichingTodoIds} />}
                {/* FIX: Pass editShoppingItemDetails directly to onEditDetails. This fixes the type error by removing the undefined 'showUndoToast' function call. */}
                {linkedShopping.length > 0 && <ShoppingList items={linkedShopping} projects={[]} onToggle={id => organizerState.handleToggleShoppingItem(id)} onOpenDetails={onOpenShoppingDetails} {...enhancedDragAndDropProps} isDropTarget={dropTarget?.type === 'shopping'} activeFilter={null} onClearFilter={() => {}} isCollapsed={false} onToggleCollapse={() => {}} {...selectionProps} onAddItem={onAddShoppingItem} shoppingSortOrder={organizerState.shoppingSortOrder} onSetShoppingSortOrder={onSetShoppingSortOrder} onCategorizeItems={onCategorizeItems} isCategorizing={isCategorizing} onEditDetails={editShoppingItemDetails} />}
                {linkedNotes.length > 0 && <NotesList items={linkedNotes} projects={[]} onOpenDetails={onOpenNoteDetails} {...enhancedDragAndDropProps} isDropTarget={dropTarget?.type === 'notes'} isCollapsed={false} onToggleCollapse={() => {}} {...selectionProps} onAddItem={onAddNote} />}
                {linkedCustomLists.map(list => <CustomListComponent key={list.id} list={list} projects={[]} onAddItem={(lId, text) => organizerState.addCustomListItem(lId, text)} onDeleteList={lId => organizerState.deleteCustomList(lId)} onToggleItem={(lId, iId) => organizerState.toggleCustomListItem(lId, iId)} onOpenDetails={onOpenCustomItemDetails} {...enhancedDragAndDropProps} isDropTarget={dropTarget?.type === 'custom' && dropTarget.listId === list.id} activeFilter={null} onClearFilter={() => {}} isCollapsed={false} onToggleCollapse={() => {}} {...selectionProps} />)}

                {/* Linked External Items */}
                {(linkedEmails.length > 0 || linkedEvents.length > 0) && (
                    <div className="md:col-span-2 lg:col-span-1 space-y-8">
                        {linkedEmails.length > 0 && (
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4">E-mails liés</h2>
                                <ul className="space-y-2">
                                    {linkedEmails.map(email => (
                                        <li key={email.id}>
                                            <button onClick={() => onOpenEmail(email.id)} className="w-full text-left p-2 rounded-md hover:bg-slate-100 transition-colors">
                                                <div className="font-semibold text-slate-700 text-sm truncate">{email.from}</div>
                                                <div className="text-indigo-700 text-sm truncate">{email.subject}</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                         {linkedEvents.length > 0 && (
                            <div className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4">Événements liés</h2>
                                <ul className="space-y-2">
                                    {linkedEvents.map(event => (
                                         <li key={event.id}>
                                            <button onClick={() => onOpenEvent(event)} className="w-full text-left p-2 rounded-md hover:bg-slate-100 transition-colors">
                                                 <div className="font-semibold text-slate-700 text-sm truncate">{event.summary}</div>
                                                 <div className="text-indigo-700 text-xs truncate">
                                                     {event.start.dateTime ? new Date(event.start.dateTime).toLocaleString() : new Date(event.start.date!).toLocaleDateString()}
                                                 </div>
                                            </button>
                                         </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};