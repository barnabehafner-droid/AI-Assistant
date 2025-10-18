import React, { useState, useRef, useEffect } from 'react';
import { CustomList, GenericItem, Project, FilterState, SelectionState } from '../types';
import { TrashIcon, PlusIcon, ClipboardDocumentListIcon, RectangleGroupIcon, XMarkIcon, ChevronDownIcon, ClipboardDocumentCheckIcon, GripVerticalIcon } from './icons';
import { DragItemInfo, ListType } from '../hooks/useOrganizerState';


interface CustomListComponentProps {
  list: CustomList;
  projects: Project[];
  onToggleItem: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, itemText: string, customFields?: Record<string, string>) => void;
  onDeleteList: (listId: string) => void;
  onOpenDetails: (listId: string, itemId: string) => void;
  onDragStart: (itemInfo: DragItemInfo) => void;
  onDragEnd: () => void;
  onDragEnter: (type: ListType, listId?: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (type: ListType, listId?: string, index?: number) => void;
  draggingItem: DragItemInfo | null;
  isDropTarget: boolean;
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
}

const CustomItemComponent: React.FC<{ 
    list: CustomList;
    item: GenericItem; 
    index: number;
    project: Project | undefined;
    onToggle: (listId: string, itemId: string) => void; 
    onOpenDetails: (listId: string, itemId: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onStartSelection: () => void;
}> = ({ list, item, index, project, onToggle, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection, onStartSelection }) => {
    const [isMounted, setIsMounted] = useState(false);
    const longPressTimeout = useRef<number | null>(null);
    const touchStartPos = useRef<{ x: number, y: number } | null>(null);
    
    const hasDetails = !!item.description;

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);
    
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
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop('custom', list.id, index);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => isSelectionMode && onToggleSelection(item.id)}
            className={`flex items-start justify-between p-4 rounded-lg shadow-sm transition-all duration-500 ease-out ${isSelectionMode ? 'cursor-pointer' : 'cursor-grab'} ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-slate-50 hover:shadow-md'} ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="flex items-start gap-3 flex-grow min-w-0">
                 {isSelectionMode ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none flex-shrink-0 mt-1"
                    />
                ) : (
                    <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggle(list.id, item.id)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0 mt-1"
                    />
                )}
                <div className="flex-grow">
                    <button disabled={isSelectionMode} onClick={() => onOpenDetails(list.id, item.id)} className={`w-full text-left flex items-center gap-2 ${item.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {hasDetails && <ClipboardDocumentListIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                        {project && <RectangleGroupIcon className="w-4 h-4 text-slate-400 flex-shrink-0" title={`Part of project: ${project.title}`} />}
                        <span className="truncate">{item.text}</span>
                    </button>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
                        {list.fields.map(field => {
                            const value = item.customFields[field.id];
                            if (!value) return null;
                            return (
                                <div key={field.id} className="flex items-center text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full" title={`${field.name}: ${value}`}>
                                    <span className="font-semibold mr-1">{field.name}:</span>
                                    <span className="truncate">{value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </li>
    );
};

const CustomListComponent: React.FC<CustomListComponentProps> = ({ list, projects, onToggleItem, onAddItem, onDeleteList, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, activeFilter, onClearFilter, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection, isReordering }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelectionMode = selection.isActive && selection.type === 'custom' && selection.listId === list.id;
  const addInputRef = useRef<HTMLInputElement>(null);

  const handleAddItemClick = () => {
    addInputRef.current?.focus();
  };

  const handleDragStart = (e: React.DragEvent, item: GenericItem) => {
    if (isSelectionMode && selectedIds.has(item.id)) {
        const dragImage = document.createElement('div');
        dragImage.className = 'absolute -z-10 bg-indigo-500 text-white font-bold rounded-full w-10 h-10 flex items-center justify-center text-sm';
        dragImage.innerText = `${selectedIds.size}`;
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, -10, -10);
        setTimeout(() => document.body.removeChild(dragImage), 0);

        onDragStart({
            id: 'group',
            type: 'group',
            content: { itemType: 'custom', listId: list.id, ids: Array.from(selectedIds) }
        });
    } else {
        if (isSelectionMode) onEndSelection();
        onDragStart({ id: item.id, type: 'custom', listId: list.id, content: item });
    }
  };

  const isFilterActiveForThisList = activeFilter && activeFilter.listType === 'custom' && activeFilter.listId === list.id;
  const filteredItems = isFilterActiveForThisList
      ? list.items.filter(item => activeFilter.itemIds.has(item.id))
      : list.items;
      
  const sortedItems = [...filteredItems].sort((a, b) => (isSelectionMode ? 0 : a.completed === b.completed ? 0 : a.completed ? 1 : -1));

    useEffect(() => {
        if (sortedItems.length <= 10) {
            setIsExpanded(false);
        }
    }, [sortedItems.length, activeFilter]);

    const isTruncated = sortedItems.length > 10 && !isExpanded;
    const itemsToDisplay = isTruncated ? sortedItems.slice(0, 10) : sortedItems;
    const remainingCount = sortedItems.length - 10;

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('itemText') as HTMLInputElement;
    const text = input.value.trim();
    if (text) {
      onAddItem(list.id, text);
      input.value = '';
    }
  };

  return (
    <div
        className={`bg-white rounded-xl shadow-md p-6 flex flex-col transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''} ${isReordering ? 'widget-reordering-active' : ''}`}
        onDragEnter={() => onDragEnter('custom', list.id)}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('custom', list.id);
        }}
    >
      <header className={`flex items-center justify-between pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
        <div onClick={onToggleCollapse} className="flex items-center gap-2 cursor-pointer">
            {isReordering && !isCollapsed && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
            <h2 className="text-2xl font-bold text-slate-800">{list.title}</h2>
            <ChevronDownIcon className={`w-5 h-5 transition-transform text-slate-400 ${isCollapsed ? '' : 'rotate-180'}`} />
        </div>
        <div className="flex items-center gap-2">
            {!isCollapsed && !isSelectionMode && (
                <button
                    onClick={handleAddItemClick}
                    className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    aria-label="Ajouter un élément"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            )}
            {!isCollapsed && !isSelectionMode && (
                <>
                    <button onClick={() => onStartSelection('custom', list.id)} className="p-1 text-slate-400 hover:text-slate-600">
                        <ClipboardDocumentCheckIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => onDeleteList(list.id)} 
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        aria-label={`Supprimer la liste ${list.title}`}
                    >
                        <TrashIcon />
                    </button>
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
      </header>
        {isCollapsed ? (
            <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
                <span>{list.items.length} élément(s)</span>
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
                <div className="flex-grow">
                    {sortedItems.length > 0 ? (
                        <ul className="space-y-3">
                        {itemsToDisplay.map((item, index) => (
                            <CustomItemComponent 
                                key={item.id}
                                list={list}
                                item={item}
                                index={index}
                                project={projects.find(p => p.id === item.projectId)}
                                onToggle={onToggleItem}
                                onOpenDetails={onOpenDetails}
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={onDragEnd}
                                onDrop={onDrop}
                                isDragging={draggingItem?.id === item.id || (draggingItem?.type === 'group' && (draggingItem.content.ids as string[]).includes(item.id))}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedIds.has(item.id)}
                                onToggleSelection={onToggleSelection}
                                onStartSelection={() => onStartSelection('custom', list.id)}
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
                        <p className="text-slate-500 text-center py-4">Aucun élément ne correspond à votre filtre.</p>
                    ) : (
                        <p className="text-slate-500 text-center py-4">Cette liste est vide.</p>
                    )}
                </div>
                {!isSelectionMode && (
                    <form onSubmit={handleAddSubmit} className="mt-4 flex gap-2">
                        <input
                        ref={addInputRef}
                        type="text"
                        name="itemText"
                        placeholder="Ajouter un élément..."
                        className="flex-grow w-full px-4 py-2 text-base bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                        aria-label={`Ajouter un nouvel élément à ${list.title}`}
                        />
                        <button
                        type="submit"
                        aria-label="Ajouter un élément"
                        className="p-2 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-transform active:scale-95 disabled:bg-indigo-300"
                        >
                        <PlusIcon className="w-5 h-5" />
                        </button>
                    </form>
                )}
            </>
        )}
    </div>
  );
};

export default CustomListComponent;