import React, { useState, useRef, useEffect } from 'react';
import { TodoItem, Priority, Project, FilterState, TodoSortOrder, SelectionState } from '../types';
import { ClipboardDocumentListIcon, CalendarIcon, ChevronDownIcon, RectangleGroupIcon, XMarkIcon, ClipboardDocumentCheckIcon } from './icons';
import { DragItemInfo, ListType } from '../hooks/useOrganizerState';

interface TodoListProps {
  items: TodoItem[];
  projects: Project[];
  onToggle: (id: string) => void;
  onEditPriority: (id: string, newPriority: Priority) => void;
  onOpenDetails: (id: string) => void;
  onDragStart: (itemInfo: DragItemInfo) => void;
  onDragEnd: () => void;
  onDragEnter: (type: ListType, listId?: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (type: ListType, listId?: string, index?: number) => void;
  draggingItem: DragItemInfo | null;
  isDropTarget: boolean;
  sortOrder: TodoSortOrder;
  onSetSortOrder: (order: TodoSortOrder) => void;
  activeFilter: FilterState | null;
  onClearFilter: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selection: SelectionState;
  selectedIds: Set<string>;
  onStartSelection: (type: 'todos' | 'shopping' | 'custom', listId?: string) => void;
  onEndSelection: () => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const priorityOrder: Record<Priority, number> = {
  [Priority.High]: 1,
  [Priority.Medium]: 2,
  [Priority.Low]: 3,
};

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

const getDueDateColor = (dueDate: string | null | undefined): string => {
    if (!dueDate) return 'text-slate-400';
    const today = new Date();
    const dueDateObj = new Date(dueDate);
    today.setHours(0, 0, 0, 0);
    dueDateObj.setHours(0, 0, 0, 0);
    const timeDiff = dueDateObj.getTime() - today.getTime();

    if (timeDiff < 0) return 'text-red-500 font-semibold'; // Overdue
    if (timeDiff === 0) return 'text-orange-500 font-semibold'; // Today
    return 'text-slate-500'; // Future
};


const TodoItemComponent: React.FC<{ 
    item: TodoItem; 
    index: number;
    project: Project | undefined;
    onToggle: (id: string) => void; 
    onEditPriority: (id: string, newPriority: Priority) => void;
    onOpenDetails: (id: string) => void;
    // FIX: Update onDragStart prop type to be a valid DragEventHandler.
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
}> = ({ item, index, project, onToggle, onEditPriority, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection }) => {
    const [isMounted, setIsMounted] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);

    const hasDetails = item.description || (item.subtasks && item.subtasks.length > 0) || item.dueDate;

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handlePriorityChange = () => {
        onEditPriority(item.id, nextPriority[item.priority]);
    };
    
    return (
        <li
            id={`item-${item.id}`}
            ref={itemRef}
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop('todos', undefined, index);
            }}
            onClick={() => isSelectionMode && onToggleSelection(item.id)}
            className={`flex items-center justify-between p-4 rounded-lg shadow-sm transition-all duration-300 ease-out ${isSelectionMode ? 'cursor-pointer' : 'cursor-grab'} ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-slate-50 hover:shadow-md'} ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center gap-3 flex-grow min-w-0">
                {isSelectionMode ? (
                     <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none flex-shrink-0"
                    />
                ) : (
                    <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggle(item.id)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                    />
                )}
                <button disabled={isSelectionMode} onClick={() => onOpenDetails(item.id)} className={`flex-grow text-left truncate flex items-center gap-2 ${item.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                    {hasDetails && <ClipboardDocumentListIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    {project && <RectangleGroupIcon className="w-4 h-4 text-slate-400 flex-shrink-0" title={`Part of project: ${project.title}`} />}
                    {item.task}
                </button>
            </div>
            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {item.dueDate && (
                    <div className={`flex items-center gap-1 text-sm ${getDueDateColor(item.dueDate)}`}>
                        <CalendarIcon className="w-4 h-4" />
                        <span>{new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                )}
                 <button
                    disabled={isSelectionMode}
                    onClick={handlePriorityChange}
                    aria-label={`Changer la priorité, actuellement ${item.priority}`}
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed ${priorityStyles[item.priority]}`}
                >
                    {item.priority}
                </button>
            </div>
        </li>
    );
};


const TodoList: React.FC<TodoListProps> = ({ items, projects, onToggle, onEditPriority, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, sortOrder, onSetSortOrder, activeFilter, onClearFilter, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection }) => {
    
    const [isExpanded, setIsExpanded] = useState(false);
    const isSelectionMode = selection.isActive && selection.type === 'todos';
    const allVisibleItemIds = items.map(i => i.id);

    const handleDragStart = (e: React.DragEvent, item: TodoItem) => {
        if (isSelectionMode && selectedIds.has(item.id)) {
            // Dragging a group
            const dragImage = document.createElement('div');
            dragImage.className = 'absolute -z-10 bg-indigo-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center text-sm';
            dragImage.innerText = `${selectedIds.size}`;
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, -10, -10);
            setTimeout(() => document.body.removeChild(dragImage), 0);

            onDragStart({
                id: 'group',
                type: 'group',
                content: { itemType: 'todos', ids: Array.from(selectedIds) }
            });
        } else {
            // Dragging a single item
            if (isSelectionMode) onEndSelection();
            onDragStart({ id: item.id, type: 'todos', content: item });
        }
    };

    const isFilterActiveForThisList = activeFilter && activeFilter.listType === 'todos';
    const filteredItems = isFilterActiveForThisList 
        ? items.filter(item => activeFilter.itemIds.has(item.id))
        : items;
    
    const sortedItems = [...filteredItems].sort((a, b) => {
        if (isSelectionMode) {
            // Keep original order in selection mode
            return 0;
        }
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        switch (sortOrder) {
            case 'dueDate':
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            case 'alphabetical':
                return a.task.localeCompare(b.task);
            case 'priority':
            default:
                return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
    });

    useEffect(() => {
        if (sortedItems.length <= 10) {
            setIsExpanded(false);
        }
    }, [sortedItems.length, activeFilter]);

    const isTruncated = sortedItems.length > 10 && !isExpanded;
    const itemsToDisplay = isTruncated ? sortedItems.slice(0, 10) : sortedItems;
    const remainingCount = sortedItems.length - 10;

    const sortOptions: { key: TodoSortOrder, label: string }[] = [
        { key: 'priority', label: 'Priorité' },
        { key: 'dueDate', label: 'Date limite' },
        { key: 'alphabetical', label: 'Alphabétique' },
    ];

  return (
    <div 
        className={`bg-white rounded-xl shadow-md p-6 transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
        onDragEnter={() => onDragEnter('todos')}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('todos');
        }}
    >
        <div className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
            <h2 className="text-2xl font-bold text-slate-800">To-Do List</h2>
            <div className="flex items-center gap-2">
                {!isCollapsed && !isSelectionMode && (
                    <>
                        <button onClick={() => onStartSelection('todos')} className="p-1 text-slate-400 hover:text-slate-600">
                           <ClipboardDocumentCheckIcon className="w-5 h-5" />
                        </button>
                        <div className="relative">
                            <select
                                value={sortOrder}
                                onChange={(e) => onSetSortOrder(e.target.value as TodoSortOrder)}
                                className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 pr-8"
                                aria-label="Trier les tâches"
                            >
                                {sortOptions.map(opt => <option key={opt.key} value={opt.key}>Trier par {opt.label}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                                <ChevronDownIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </>
                )}
                {!isCollapsed && isSelectionMode && (
                    <>
                        <button onClick={onSelectAll} className="text-sm font-semibold text-indigo-600">Tout sél.</button>
                        <button onClick={onClearSelection} className="text-sm font-semibold text-indigo-600">Aucun</button>
                        <button onClick={onEndSelection} className="text-sm font-semibold text-slate-600 bg-slate-200 px-2 py-1 rounded-md">Annuler</button>
                    </>
                )}
                <button onClick={onToggleCollapse} className="p-1 text-slate-400 hover:text-slate-600">
                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>
            </div>
      </div>
      {isCollapsed ? (
        <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
            <span>{items.length} tâche(s)</span>
        </div>
      ) : (
        <>
            {isFilterActiveForThisList && (
            <div className="flex items-center justify-between p-2 mb-4 bg-indigo-50 rounded-lg text-sm text-indigo-700 animate-fade-in">
                <span className="font-semibold truncate">Filtre : "{activeFilter.criteria}"</span>
                <button 
                    onClick={onClearFilter} 
                    className="p-1 rounded-full hover:bg-indigo-200 transition-colors"
                    aria-label="Annuler le filtre"
                >
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
            )}
            {sortedItems.length > 0 ? (
                <ul className="space-y-3">
                {itemsToDisplay.map((item, index) => (
                    <TodoItemComponent
                        key={item.id}
                        item={item}
                        index={index}
                        project={projects.find(p => p.id === item.projectId)}
                        onToggle={onToggle}
                        onEditPriority={onEditPriority}
                        onOpenDetails={onOpenDetails}
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        isDragging={draggingItem?.id === item.id || (draggingItem?.type === 'group' && (draggingItem.content.ids as string[]).includes(item.id))}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelection={onToggleSelection}
                    />
                ))}
                {isTruncated && (
                    <li key="show-more">
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="w-full text-center py-3 px-4 text-sm font-semibold text-indigo-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                        >
                            ... et {remainingCount} autre{remainingCount > 1 ? 's' : ''} élément{remainingCount > 1 ? 's' : ''}
                        </button>
                    </li>
                )}
                </ul>
            ) : isFilterActiveForThisList ? (
                <p className="text-slate-500 text-center py-8">Aucune tâche ne correspond à votre filtre.</p>
            ) : (
                <p className="text-slate-500 text-center py-8">All tasks completed! ✨</p>
            )}
        </>
      )}
    </div>
  );
};

export default TodoList;