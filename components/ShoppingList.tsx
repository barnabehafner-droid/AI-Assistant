import React, { useState, useEffect } from 'react';
import { ShoppingItem, Project, FilterState, SelectionState } from '../types';
import { ClipboardDocumentListIcon, RectangleGroupIcon, XMarkIcon, ChevronDownIcon, ClipboardDocumentCheckIcon } from './icons';
import { DragItemInfo, ListType } from '../hooks/useOrganizerState';


interface ShoppingListProps {
  items: ShoppingItem[];
  projects: Project[];
  onToggle: (id: string) => void;
  onOpenDetails: (id: string) => void;
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
}

const ShoppingItemComponent: React.FC<{ 
    item: ShoppingItem;
    index: number;
    project: Project | undefined;
    onToggle: (id: string) => void;
    onOpenDetails: (id: string) => void;
    // FIX: Update onDragStart prop type to be a valid DragEventHandler.
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
}> = ({ item, index, project, onToggle, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection }) => {
    const [isMounted, setIsMounted] = useState(false);

    const hasDetails = item.quantity || item.store || item.description;

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

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
                onDrop('shopping', undefined, index);
            }}
            onClick={() => isSelectionMode && onToggleSelection(item.id)}
            className={`flex items-center justify-between p-4 rounded-lg shadow-sm transition-all duration-500 ease-out ${isSelectionMode ? 'cursor-pointer' : 'cursor-grab'} ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-slate-50 hover:shadow-md'} ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${isDragging ? 'opacity-50' : ''}`}
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
                    {item.item}
                </button>
            </div>
        </li>
    );
};

const ShoppingList: React.FC<ShoppingListProps> = ({ items, projects, onToggle, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, activeFilter, onClearFilter, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection }) => {
  
  const [isExpanded, setIsExpanded] = useState(false);
  const isSelectionMode = selection.isActive && selection.type === 'shopping';

  const handleDragStart = (e: React.DragEvent, item: ShoppingItem) => {
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
            content: { itemType: 'shopping', ids: Array.from(selectedIds) }
        });
    } else {
        if (isSelectionMode) onEndSelection();
        onDragStart({ id: item.id, type: 'shopping', content: item });
    }
  };

  const isFilterActiveForThisList = activeFilter && activeFilter.listType === 'shopping';
  const filteredItems = isFilterActiveForThisList
      ? items.filter(item => activeFilter.itemIds.has(item.id))
      : items;

  const sortedItems = [...filteredItems].sort((a, b) => (isSelectionMode ? 0 : a.completed === b.completed ? 0 : a.completed ? 1 : -1));

    useEffect(() => {
        if (sortedItems.length <= 10) {
            setIsExpanded(false);
        }
    }, [sortedItems.length, activeFilter]);

    const isTruncated = sortedItems.length > 10 && !isExpanded;
    const itemsToDisplay = isTruncated ? sortedItems.slice(0, 10) : sortedItems;
    const remainingCount = sortedItems.length - 10;

  return (
    <div
        className={`bg-white rounded-xl shadow-md p-6 transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
        onDragEnter={() => onDragEnter('shopping')}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('shopping');
        }}
    >
        <div className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
            <h2 className="text-2xl font-bold text-slate-800">Shopping List</h2>
            <div className="flex items-center gap-2">
                 {!isCollapsed && !isSelectionMode && (
                    <button onClick={() => onStartSelection('shopping')} className="p-1 text-slate-400 hover:text-slate-600">
                        <ClipboardDocumentCheckIcon className="w-5 h-5" />
                    </button>
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
            <span>{items.length} article(s)</span>
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
                <ShoppingItemComponent
                    key={item.id}
                    item={item}
                    index={index}
                    project={projects.find(p => p.id === item.projectId)}
                    onToggle={onToggle}
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
            <p className="text-slate-500 text-center py-8">Aucun article ne correspond à votre filtre.</p>
        ) : (
            <p className="text-slate-500 text-center py-8">Your shopping list is empty! 🛒</p>
        )}
        </>
      )}
    </div>
  );
};

export default ShoppingList;