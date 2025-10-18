import React, { useState, useRef, useEffect } from 'react';
import { BoldIcon, ItalicIcon, UnderlineIcon, ListBulletIcon, ListOrderedIcon, TableCellsIcon } from './icons';

interface RichTextEditorProps {
    initialContent: string;
    onContentChange: (newContent: string) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onContentChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
    const [hoveredTableSize, setHoveredTableSize] = useState({ rows: 0, cols: 0 });
    const tablePickerRef = useRef<HTMLDivElement>(null);
    const [toolbarState, setToolbarState] = useState({
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isUl: false,
        isOl: false,
    });

    // Update editor content if the initial prop changes from outside
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent;
        }
    }, [initialContent]);

    // Handle clicks outside table picker
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isTablePickerOpen && tablePickerRef.current && !tablePickerRef.current.contains(event.target as Node)) {
                setIsTablePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTablePickerOpen]);

    const updateToolbarState = () => {
        if (!editorRef.current) return;
        setToolbarState({
            isBold: document.queryCommandState('bold'),
            isItalic: document.queryCommandState('italic'),
            isUnderline: document.queryCommandState('underline'),
            isUl: document.queryCommandState('insertUnorderedList'),
            isOl: document.queryCommandState('insertOrderedList'),
        });
    };

    // Update toolbar on selection change
    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === editorRef.current) {
                updateToolbarState();
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    const handleToolbarAction = (e: React.MouseEvent, action: () => void) => {
        e.preventDefault();
        editorRef.current?.focus();
        action();
        updateToolbarState();
        if (editorRef.current) {
            onContentChange(editorRef.current.innerHTML);
        }
    };

    const insertTable = (rows: number, cols: number) => {
        if (rows === 0 || cols === 0) return;
        let tableHtml = '<table><tbody>';
        for (let r = 0; r < rows; r++) {
            tableHtml += '<tr>';
            for (let c = 0; c < cols; c++) {
                tableHtml += '<td><br></td>';
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table><p><br></p>';
        
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, tableHtml);
        setIsTablePickerOpen(false);
        if (editorRef.current) {
            onContentChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className="border border-slate-300 rounded-lg flex-grow flex flex-col overflow-hidden">
            <div className="editor-toolbar">
                <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('bold'))} className={toolbarState.isBold ? 'active' : ''} title="Gras"><BoldIcon className="w-5 h-5"/></button>
                <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('italic'))} className={toolbarState.isItalic ? 'active' : ''} title="Italique"><ItalicIcon className="w-5 h-5"/></button>
                <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('underline'))} className={toolbarState.isUnderline ? 'active' : ''} title="Souligné"><UnderlineIcon className="w-5 h-5"/></button>
                <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('insertUnorderedList'))} className={toolbarState.isUl ? 'active' : ''} title="Liste à puces"><ListBulletIcon className="w-5 h-5"/></button>
                <button onMouseDown={(e) => handleToolbarAction(e, () => document.execCommand('insertOrderedList'))} className={toolbarState.isOl ? 'active' : ''} title="Liste numérotée"><ListOrderedIcon className="w-5 h-5"/></button>
                <div className="relative" ref={tablePickerRef}>
                    <button 
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsTablePickerOpen(prev => !prev);
                        }} 
                        title="Insérer un tableau"
                        className={isTablePickerOpen ? 'active' : ''}
                    >
                        <TableCellsIcon className="w-5 h-5"/>
                    </button>
                    {isTablePickerOpen && (
                        <div className="absolute top-full mt-2 left-0 bg-white shadow-lg border rounded-md p-2 z-20">
                            <div className="grid grid-cols-10 gap-1" onMouseLeave={() => setHoveredTableSize({rows: 0, cols: 0})}>
                                {Array.from({ length: 100 }).map((_, i) => {
                                    const row = Math.floor(i / 10);
                                    const col = i % 10;
                                    const isHovered = row < hoveredTableSize.rows && col < hoveredTableSize.cols;
                                    return (
                                        <div
                                            key={i}
                                            className={`w-5 h-5 border border-slate-200 cursor-pointer ${isHovered ? 'bg-indigo-300 border-indigo-400' : 'bg-slate-100 hover:bg-slate-200'}`}
                                            onMouseOver={() => setHoveredTableSize({ rows: row + 1, cols: col + 1 })}
                                            onClick={() => insertTable(hoveredTableSize.rows, hoveredTableSize.cols)}
                                        />
                                    );
                                })}
                            </div>
                            <div className="text-center text-sm text-slate-600 pt-2 h-5">
                                {hoveredTableSize.rows > 0 ? `${hoveredTableSize.rows} x ${hoveredTableSize.cols}` : 'Taille'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
             <div
                ref={editorRef}
                contentEditable={true}
                onInput={() => onContentChange(editorRef.current?.innerHTML || '')}
                onFocus={updateToolbarState}
                onClick={updateToolbarState}
                onKeyUp={updateToolbarState}
                className="editor-content flex-grow"
                aria-label="Contenu éditable"
            />
        </div>
    );
};

export default RichTextEditor;
