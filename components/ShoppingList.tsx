import React, { useState, useEffect, useRef } from 'react';
import { ShoppingItem, Project, FilterState, SelectionState, ShoppingSortOrder } from '../types';
import { ClipboardDocumentListIcon, RectangleGroupIcon, XMarkIcon, ChevronDownIcon, ClipboardDocumentCheckIcon, GripVerticalIcon, PlusIcon, SortIcon, CheckIcon, SparklesIcon, LoaderIcon } from './icons';
import { DragItemInfo, ListType } from '../hooks/useOrganizerState';
import { getCurrentLocation } from '../utils/location';
import { suggestStoreType } from '../services/geminiService';
import { findNearbyStore } from '../services/googleMapsService';


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
  isReordering?: boolean;
  onAddItem: () => void;
  // FIX: Add missing props to support sorting and AI categorization.
  shoppingSortOrder: ShoppingSortOrder;
  onSetShoppingSortOrder: (order: ShoppingSortOrder) => void;
  onCategorizeItems: () => void;
  isCategorizing: boolean;
  onEditDetails: (id: string, details: Partial<Pick<ShoppingItem, 'store'>>) => void;
}

const ShoppingItemComponent: React.FC<{ 
    item: ShoppingItem;
    index: number;
    project: Project | undefined;
    onToggle: (id: string) => void;
    onOpenDetails: (id: string) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (type: ListType, listId: string | undefined, index?: number) => void;
    isDragging: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onStartSelection: () => void;
    onEditDetails: (id: string, details: Partial<Pick<ShoppingItem, 'store'>>) => void;
}> = ({ item, index, project, onToggle, onOpenDetails, onDragStart, onDragEnd, onDrop, isDragging, isSelectionMode, isSelected, onToggleSelection, onStartSelection, onEditDetails }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [isFindingStore, setIsFindingStore] = useState(false);
    const longPressTimeout = useRef<number | null>(null);
    const touchStartPos = useRef<{ x: number, y: number } | null>(null);

    const hasDetails = item.quantity || item.store || item.description;

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleFindNearby = async () => {
        setIsFindingStore(true);
        try {
            const location = await getCurrentLocation();
            if (!location) {
                alert("Impossible d'obtenir votre position. Veuillez activer la géolocalisation.");
                return;
            }
            const storeType = await suggestStoreType(item.item);
            const place = await findNearbyStore(location.latitude, location.longitude, storeType, item.item);
            if (place && place.name) {
                onEditDetails(item.id, { store: place.name });
            } else {
                alert(`Aucun magasin trouvé à proximité pour "${item.item}".`);
            }
        } catch (error) {
            console.error("Error finding nearby store:", error);
            alert("Une erreur est survenue lors de la recherche d'un magasin.");
        } finally {
            setIsFindingStore(false);
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
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop('shopping', undefined, index);
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
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
             <div className="flex items-center gap-2 ml-2">
                {!item.store && !item.completed && (
                    <button
                        onClick={handleFindNearby}
                        disabled={isFindingStore}
                        className="p-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
                        title="Trouver un magasin à proximité avec l'IA"
                    >
                        {isFindingStore ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                    </button>
                )}
                {item.store && <div className="text-sm text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md truncate max-w-[100px]">{item.store}</div>}
            </div>
        </li>
    );
};

const ShoppingList: React.FC<ShoppingListProps> = ({ items, projects, onToggle, onOpenDetails, onDragStart, onDragEnd, onDragEnter, onDragOver, onDrop, draggingItem, isDropTarget, activeFilter, onClearFilter, isCollapsed, onToggleCollapse, selection, selectedIds, onStartSelection, onEndSelection, onToggleSelection, onSelectAll, onClearSelection, isReordering, onAddItem, shoppingSortOrder, onSetShoppingSortOrder, onCategorizeItems, isCategorizing, onEditDetails }) => {
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const isSelectionMode = selection.isActive && selection.type === 'shopping';

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

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (isSelectionMode) return 0;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    switch (shoppingSortOrder) {
        case 'store':
            const storeA = a.store || '';
            const storeB = b.store || '';
            if (storeA === storeB) {
                const aisleA = a.aisle || '';
                const aisleB = b.aisle || '';
                if (aisleA === aisleB) {
                    return a.item.localeCompare(b.item);
                }
                return aisleA.localeCompare(aisleB);
            }
            if (!storeA) return 1;
            if (!storeB) return -1;
            return storeA.localeCompare(storeB);
        case 'default':
        default:
            return 0; // Keep original add order for 'default'
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

    const sortOptions: { key: ShoppingSortOrder, label: string }[] = [
        { key: 'default', label: 'Défaut' },
        { key: 'store', label: 'Magasin' },
    ];

  return (
    <div
        className={`bg-white rounded-xl shadow-md p-6 transition-all duration-200 ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''} ${isReordering ? 'widget-reordering-active' : ''}`}
        onDragEnter={() => onDragEnter('shopping')}
        onDragOver={onDragOver}
        onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop('shopping');
        }}
    >
        <div className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
            <div onClick={onToggleCollapse} className="flex items-center gap-2 cursor-pointer">
                {isReordering && !isCollapsed && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
                <h2 className="text-2xl font-bold text-slate-800">Shopping List</h2>
                <ChevronDownIcon className={`w-5 h-5 transition-transform text-slate-400 ${isCollapsed ? '' : 'rotate-180'}`} />
            </div>
            <div className="flex items-center gap-2">
                 {!isCollapsed && !isSelectionMode && (
                    <button
                        onClick={onAddItem}
                        className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        aria-label="Ajouter un article"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                )}
                 {!isCollapsed && !isSelectionMode && (
                    <>
                        <button
                            onClick={onCategorizeItems}
                            disabled={isCategorizing}
                            className="flex items-center justify-center w-8 h-8 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                            aria-label="Catégoriser les articles avec l'IA"
                        >
                            {isCategorizing ? <LoaderIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={() => onStartSelection('shopping')} className="p-1 text-slate-400 hover:text-slate-600">
                            <ClipboardDocumentCheckIcon className="w-5 h-5" />
                        </button>
                        <div className="relative" ref={sortMenuRef}>
                            <button
                                onClick={() => setIsSortMenuOpen(prev => !prev)}
                                className="flex items-center justify-center w-8 h-8 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                                aria-label="Trier les articles"
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
                                                onSetShoppingSortOrder(opt.key);
                                                setIsSortMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center hover:bg-slate-100 ${shoppingSortOrder === opt.key ? 'text-indigo-600' : 'text-slate-700'}`}
                                        >
                                            <span>{opt.label}</span>
                                            {shoppingSortOrder === opt.key && <CheckIcon className="w-4 h-4 text-indigo-600" />}
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
                    onStartSelection={() => onStartSelection('shopping')}
                    onEditDetails={onEditDetails}
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