import React, { useState, useRef, useEffect } from 'react';
import { TodoItem, Priority, Project, FilterState, TodoSortOrder, SelectionState } from '../types';
import { ClipboardDocumentListIcon, CalendarIcon, ChevronDownIcon, RectangleGroupIcon, XMarkIcon, ClipboardDocumentCheckIcon, GripVerticalIcon, PlusIcon, SortIcon, CheckIcon, SparklesIcon } from './icons';
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
  isReordering?: boolean;
  onAddItem: () => void;
  enrichingTodoIds: Set<string>;
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
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onStartSelection: () => void;
    isEnriching: boolean;
}> = ({ item, index, project, onToggle, onEditPriority, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection, onStartSelection, isEnriching }) => {
    const [isMounted, setIsMounted] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);
    const longPressTimeout = useRef<number | null>(null);
    const touchStartPos = useRef<{ x: number, y: number } | null>(null);

    const hasDetails = item.description || (item.subtasks && item.subtasks.length > 0) || item.dueDate;

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handlePriorityChange = () => {
        onEditPriority(item.id, nextPriority[item.priority]);
    };
    
    const handleTouchStart = (e: React.TouchEvent) => {
        if (isSelectionMode) return;

        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        
        longPressTimeout.current = window.setTimeout(() => {
            onStartSelection();
            onToggleSelection(item.id);
            longPressTimeout.current = null;
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!longPressTimeout.current || !touchStartPos.current) return;

        const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

        if (deltaX > 10 || deltaY > 10) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
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
                    {isEnriching && <SparklesIcon className="w-4 h-4 text-purple-500 flex-shrink-0 animate-sparkle-pulse" title="L'IA enrichit cette tâche..." />}
                    {hasDetails && !isEnriching && <ClipboardDocumentListIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
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


const TodoList: React.FC<TodoListProps> = ({ items, projects, onToggle, onEditPriority, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, sortOrder, onSetSortOrder, activeFilter, onClearFilter, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection, isReordering, onAddItem, enrichingTodoIds }) => {
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const isSelectionMode = selection.isActive && selection.type === 'todos';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setIsSortMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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
        className={`bg-white rounded-xl shadow-md p-6 transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''} ${isReordering ? 'widget-reordering-active' : ''}`}
        onDragEnter={() => onDragEnter('todos')}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('todos');
        }}
    >
        <div className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
            <div onClick={onToggleCollapse} className="flex items-center gap-2 cursor-pointer">
                {isReordering && !isCollapsed && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
                <h2 className="text-2xl font-bold text-slate-800">To-Do List</h2>
                <ChevronDownIcon className={`w-5 h-5 transition-transform text-slate-400 ${isCollapsed ? '' : 'rotate-180'}`} />
            </div>
            <div className="flex items-center gap-2">
                {!isCollapsed && !isSelectionMode && (
                    <button
                        onClick={onAddItem}
                        className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        aria-label="Ajouter une tâche"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                )}
                {!isCollapsed && !isSelectionMode && (
                    <>
                        <button onClick={() => onStartSelection('todos')} className="p-1 text-slate-400 hover:text-slate-600">
                           <ClipboardDocumentCheckIcon className="w-5 h-5" />
                        </button>
                        <div className="relative" ref={sortMenuRef}>
                            <button
                                onClick={() => setIsSortMenuOpen(prev => !prev)}
                                className="flex items-center justify-center w-8 h-8 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                                aria-label="Trier les tâches"
                            >
                                <SortIcon className="w-5 h-5" />
                            </button>
                            {isSortMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 border">
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500">Trier par</div>
                                    {sortOptions.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => {
                                                onSetSortOrder(opt.key);
                                                setIsSortMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center hover:bg-slate-100 ${sortOrder === opt.key ? 'text-indigo-600' : 'text-slate-700'}`}
                                        >
                                            <span>{opt.label}</span>
                                            {sortOrder === opt.key && <CheckIcon className="w-4 h-4 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
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
                        onStartSelection={() => onStartSelection('todos')}
                        isEnriching={enrichingTodoIds.has(item.id)}
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