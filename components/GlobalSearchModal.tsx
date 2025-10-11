import React from 'react';
import { SearchResults } from '../hooks/useGlobalSearch';
import { LoaderIcon, SparklesIcon, XMarkIcon } from './icons';
import { CalendarEvent, Contact, FullEmail, GenericItem, NoteItem, Project, ShoppingItem, TodoItem, CustomList } from '../types';

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    onQueryChange: (query: string) => void;
    results: Partial<SearchResults>;
    isLoading: boolean;
    isAiLoading: boolean;
    onSelectTodo: (id: string) => void;
    onSelectShoppingItem: (id: string) => void;
    onSelectNote: (id: string) => void;
    onSelectCustomItem: (listId: string, itemId: string) => void;
    onSelectProject: (id: string) => void;
    onSelectEmail: (email: FullEmail) => void;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
    isOpen, onClose, query, onQueryChange, results, isLoading, isAiLoading,
    onSelectTodo, onSelectShoppingItem, onSelectNote, onSelectCustomItem, onSelectProject, onSelectEmail
}) => {

    if (!isOpen) return null;

    const hasResults = Object.values(results).some(arr => arr && arr.length > 0);

    const handleSelect = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-60 pt-20" onClick={onClose} aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[70vh] animate-fade-in" onClick={e => e.stopPropagation()}>
                <header className="flex items-center p-4 border-b">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Rechercher dans les listes, projets, e-mails, agenda..."
                        className="w-full bg-transparent text-lg focus:outline-none"
                        autoFocus
                    />
                    <div className="flex items-center gap-4">
                        {(isLoading || isAiLoading) && <LoaderIcon className="w-5 h-5 text-slate-400" />}
                        {/* FIX: The 'title' prop is now supported by the SparklesIcon component. */}
                        {isAiLoading && <SparklesIcon className="w-5 h-5 text-purple-500" title="Recherche améliorée par l'IA" />}
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow overflow-y-auto">
                    {!isLoading && !hasResults && query ? (
                        <p className="p-10 text-center text-slate-500">Aucun résultat trouvé pour "{query}".</p>
                    ) : (
                        <div className="p-4 space-y-4">
                            {results.projects && results.projects.length > 0 && <ResultsSection title="Projets" items={results.projects} onSelect={p => handleSelect(() => onSelectProject(p.id))} render={p => <>{p.title}</>} />}
                            {results.todos && results.todos.length > 0 && <ResultsSection title="Tâches" items={results.todos} onSelect={t => handleSelect(() => onSelectTodo(t.id))} render={t => <>{t.task}</>} />}
                            {results.shopping && results.shopping.length > 0 && <ResultsSection title="Courses" items={results.shopping} onSelect={s => handleSelect(() => onSelectShoppingItem(s.id))} render={s => <>{s.item}</>} />}
                            {results.notes && results.notes.length > 0 && <ResultsSection title="Notes" items={results.notes} onSelect={n => handleSelect(() => onSelectNote(n.id))} render={n => <div className="note-preview" dangerouslySetInnerHTML={{ __html: n.content }} />} />}
                            {/* FIX: Adapt to the flattened custom list item structure for rendering and selection. */}
                            {results.custom && results.custom.length > 0 && <ResultsSection title="Listes Personnalisées" items={results.custom} onSelect={c => handleSelect(() => onSelectCustomItem(c.listId, c.id))} render={c => <><span className="font-semibold">{c.listTitle}:</span> {c.text}</>} />}
                            {results.emails && results.emails.length > 0 && <ResultsSection title="E-mails" items={results.emails} onSelect={e => handleSelect(() => onSelectEmail(e))} render={e => <><span className="font-semibold">{e.from}:</span> {e.subject}</>} />}
                            {results.events && results.events.length > 0 && <ResultsSection title="Agenda" items={results.events} onSelect={() => {}} render={e => <>{e.summary}</>} />}
                            {results.contacts && results.contacts.length > 0 && <ResultsSection title="Contacts" items={results.contacts} onSelect={() => {}} render={c => <>{c.displayName} ({c.email})</>} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ResultsSectionProps<T> {
    title: string;
    items: T[];
    render: (item: T) => React.ReactNode;
    onSelect: (item: T) => void;
}

const ResultsSection = <T extends { id?: string; resourceName?: string }>({ title, items, render, onSelect }: ResultsSectionProps<T>) => (
    <section>
        <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
        <ul className="space-y-1">
            {items.map((item, index) => (
                <li key={(item.id || item.resourceName || index)}>
                    <button onClick={() => onSelect(item)} className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 transition-colors truncate">
                        {render(item)}
                    </button>
                </li>
            ))}
        </ul>
    </section>
);


export default GlobalSearchModal;