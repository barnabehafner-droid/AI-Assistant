import React, { useState, useEffect, useRef } from 'react';
import { NoteItem, Project, SelectionState } from '../types';
import { DragItemInfo, ListType } from '../hooks/useOrganizerState';
import { RectangleGroupIcon, ChevronDownIcon, ClipboardDocumentCheckIcon, GripVerticalIcon, PlusIcon, MapPinIcon } from './icons';

const NoteItemComponent: React.FC<{ 
    item: NoteItem; 
    index: number;
    project: Project | undefined;
    onOpenDetails: (id: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onStartSelection: () => void;
}> = ({ item, index, project, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection, onStartSelection }) => {
    const [isMounted, setIsMounted] = useState(false);
    const isDraggingRef = useRef(false);
    const longPressTimeout = useRef<number | null>(null);
    const touchStartPos = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleDragStartInternal = (e: React.DragEvent) => {
        isDraggingRef.current = true;
        onDragStart(e);
    };

    const handleDragEndInternal = () => {
        setTimeout(() => { isDraggingRef.current = false; }, 50);
        onDragEnd();
    };
    
    const handleClick = () => {
        if (isSelectionMode) {
            onToggleSelection(item.id);
        } else if (!isDraggingRef.current) {
            onOpenDetails(item.id);
        }
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
            draggable={!isSelectionMode}
            onDragStart={handleDragStartInternal}
            onDragEnd={handleDragEndInternal}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop('notes', undefined, index);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={handleClick}
            className={`p-4 border-l-4 rounded-r-lg shadow-sm transition-all duration-300 ease-out cursor-pointer hover:shadow-md ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-yellow-50 border-yellow-300'} ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'} ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="w-full text-left flex items-start gap-3 pointer-events-none">
                {isSelectionMode && (
                     <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                )}
                {project && <RectangleGroupIcon className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-1" title={`Part of project: ${project.title}`} />}
                <div 
                    className="text-yellow-900 note-preview"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                />
            </div>
            {item.address && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 pl-1">
                    <MapPinIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{item.address}</span>
                </div>
            )}
        </li>
    );
};

interface NotesListProps {
  items: NoteItem[];
  projects: Project[];
  onOpenDetails: (id: string) => void;
  onDragStart: (itemInfo: DragItemInfo) => void;
  onDragEnd: () => void;
  onDragEnter: (type: ListType, listId?: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (type: ListType, listId?: string, index?: number) => void;
  draggingItem: DragItemInfo | null;
  isDropTarget: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selection: SelectionState;
  selectedIds: Set<string>;
  onStartSelection: (type: 'todos' | 'shopping' | 'custom' | 'notes', listId?: string) => void;
  onEndSelection: () => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isReordering?: boolean;
  onAddItem: () => void;
}

const NotesList: React.FC<NotesListProps> = ({ items, projects, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection, isReordering, onAddItem }) => {
  const isSelectionMode = selection.isActive && selection.type === 'notes';

  const handleDragStart = (e: React.DragEvent, item: NoteItem) => {
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
            content: { itemType: 'notes', ids: Array.from(selectedIds) }
        });
    } else {
        if (isSelectionMode) onEndSelection();
        onDragStart({ id: item.id, type: 'notes', content: item });
    }
  };

  return (
    <div
        className={`bg-white rounded-xl shadow-md p-6 transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''} ${isReordering ? 'widget-reordering-active' : ''}`}
        onDragEnter={() => onDragEnter('notes')}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('notes');
        }}
    >
      <div className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
        <div onClick={onToggleCollapse} className="flex items-center gap-2 cursor-pointer">
            {isReordering && !isCollapsed && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
            <h2 className="text-2xl font-bold text-slate-800">Notes</h2>
            <ChevronDownIcon className={`w-5 h-5 transition-transform text-slate-400 ${isCollapsed ? '' : 'rotate-180'}`} />
        </div>
         <div className="flex items-center gap-2">
            {!isCollapsed && !isSelectionMode && (
                <button
                    onClick={onAddItem}
                    className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    aria-label="Ajouter une note"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            )}
            {!isCollapsed && !isSelectionMode && (
                <button onClick={() => onStartSelection('notes')} className="p-1 text-slate-400 hover:text-slate-600">
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
        </div>
      </div>
      {isCollapsed ? (
        <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
            <span>{items.length} note(s)</span>
        </div>
      ) : (
        <>
            {items.length > 0 ? (
                <ul className="space-y-3">
                {items.map((item, index) => (
                    <NoteItemComponent 
                        key={item.id}
                        item={item}
                        index={index}
                        project={projects.find(p => p.id === item.projectId)}
                        onOpenDetails={onOpenDetails}
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        isDragging={draggingItem?.id === item.id || (draggingItem?.type === 'group' && (draggingItem.content.ids as string[]).includes(item.id))}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(item.id)}
                        onToggleSelection={onToggleSelection}
                        onStartSelection={() => onStartSelection('notes')}
                    />
                ))}
                </ul>
            ) : (
                <p className="text-slate-500 text-center py-8">No notes yet. Jot something down! 📝</p>
            )}
        </>
      )}
    </div>
  );
};

export default NotesList;