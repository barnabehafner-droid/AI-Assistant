import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FullEmail } from '../types';
import { LoaderIcon, PencilIcon, ArrowPathIcon, ChevronDownIcon, MagnifyingGlassIcon } from './icons';
import { DragItemInfo } from '../hooks/useOrganizerState';
import * as googleMailService from '../services/googleMailService';

interface GmailViewProps {
    auth: ReturnType<typeof useAuth>;
    emails: FullEmail[];
    unreadEmails: FullEmail[];
    isLoading: boolean;
    error: string | null;
    onOpenEmail: (emailId: string) => void;
    onCompose: () => void;
    onRefresh: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onDragStart: (itemInfo: DragItemInfo) => void;
    onLoadMore: () => void;
    hasNextPage: boolean;
    isMoreLoading: boolean;
}

// Local helper for mock data when signed out
const createMockEmails = (): FullEmail[] => {
    return [
        { id: 'mock1', from: 'John Doe <john.doe@example.com>', to: 'me', subject: 'Project Update', snippet: 'Here is the latest update on the project...', body: 'Hi team,<br><br>Just wanted to share the latest project update. Things are going well and we are on track.<br><br>Best,<br>John', isRead: false, aiSummary: 'John shares a positive update on project progress.', labelIds: ['INBOX', 'CATEGORY_PERSONAL'] },
        { id: 'mock2', from: 'Jane Smith <jane.smith@example.com>', to: 'me', subject: 'Lunch tomorrow?', snippet: 'Are you free for lunch tomorrow to discuss the new design?', body: 'Hey! Are you free for lunch tomorrow? I would love to discuss the new design concepts with you. Let me know!', isRead: false, aiSummary: 'Jane proposes a lunch meeting tomorrow to discuss new designs.', labelIds: ['INBOX', 'CATEGORY_PERSONAL'] },
        { id: 'mock3', from: 'LinkedIn', to: 'me', subject: 'You appeared in 9 searches this week', snippet: 'See who\'s looking at your profile.', body: 'Your profile is getting attention!', isRead: true, aiSummary: 'LinkedIn weekly search appearance update.', labelIds: ['INBOX', 'CATEGORY_SOCIAL'] },
        { id: 'mock4', from: 'Alerts <alerts@service.com>', to: 'me', subject: 'Security Alert', snippet: 'A new device has signed into your account.', body: 'A new sign-in was detected on a Windows device. If this was not you, please secure your account immediately.', isRead: false, aiSummary: 'A security alert reports a new sign-in from a Windows device.', labelIds: ['INBOX', 'CATEGORY_UPDATES'] },
        { id: 'mock5', from: 'Stack Overflow', to: 'me', subject: '[Stack Overflow] New answers to your question', snippet: 'Your question "How to..." has new answers.', body: 'There are new answers to your question.', isRead: true, aiSummary: 'StackOverflow has new answers for your question.', labelIds: ['INBOX', 'CATEGORY_FORUMS'] },
    ];
};

const EmailItem: React.FC<{
    email: FullEmail;
    onClick: (id: string) => void;
    onDragStart: (itemInfo: DragItemInfo) => void;
}> = ({ email, onClick, onDragStart }) => (
    <button
        key={email.id}
        draggable={true}
        onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            onDragStart({ type: 'email', id: email.id, content: email });
        }}
        onClick={() => onClick(email.id)}
        className={`w-full text-left p-3 rounded-md hover:bg-slate-100 transition-colors cursor-grab ${!email.isRead ? 'bg-indigo-50' : 'bg-slate-50'}`}
    >
        <div className={`flex justify-between items-start gap-2 ${!email.isRead ? 'font-bold' : 'font-semibold'} text-slate-800 text-sm`}>
            <span className="truncate">{email.from}</span>
        </div>
        <p className={`truncate text-sm ${!email.isRead ? 'text-indigo-800 font-semibold' : 'text-slate-600'}`}>{email.subject}</p>
        <p className="text-slate-500 text-xs mt-1 truncate">{email.aiSummary || email.snippet}</p>
    </button>
);


type TabKey = 'primary' | 'social' | 'promotions' | 'updates' | 'forums';

const tabs: { key: TabKey; label: string; category: string | null }[] = [
    { key: 'primary', label: 'Principale', category: 'CATEGORY_PERSONAL' },
    { key: 'social', label: 'Réseaux sociaux', category: 'CATEGORY_SOCIAL' },
    { key: 'promotions', label: 'Promotions', category: 'CATEGORY_PROMOTIONS' },
    { key: 'updates', label: 'Mises à jour', category: 'CATEGORY_UPDATES' },
    { key: 'forums', label: 'Forums', category: 'CATEGORY_FORUMS' },
];

const GmailView: React.FC<GmailViewProps> = ({ auth, emails, unreadEmails, isLoading, error, onOpenEmail, onCompose, onRefresh, isCollapsed, onToggleCollapse, onDragStart, onLoadMore, hasNextPage, isMoreLoading }) => {
    
    const [activeTab, setActiveTab] = useState<TabKey>('primary');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FullEmail[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    
    const categoryLabels = ['CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'];

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;
    
        if (!auth.isLoggedIn) {
            const lowerQuery = query.toLowerCase();
            setSearchResults(createMockEmails().filter(em => 
                em.subject.toLowerCase().includes(lowerQuery) || 
                em.from.toLowerCase().includes(lowerQuery) ||
                em.snippet.toLowerCase().includes(lowerQuery)
            ));
            return;
        }
        
        if (!auth.accessToken) return;
    
        setIsSearching(true);
        setSearchError(null);
        try {
            const results = await googleMailService.searchEmails(auth.accessToken, query, 50);
            setSearchResults(results);
        } catch (err) {
            setSearchError(err instanceof Error ? err.message : 'La recherche a échoué.');
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
        setSearchError(null);
    };


    const getFilteredEmails = () => {
        if (!auth.isLoggedIn) {
            // In mock mode, just distribute them for UI demonstration
            const mockEmails = createMockEmails();
            if (activeTab === 'primary') return mockEmails.filter(e => !e.labelIds?.some(l => categoryLabels.includes(l)));
            const activeCategory = tabs.find(t => t.key === activeTab)?.category;
            return mockEmails.filter(email => email.labelIds?.includes(activeCategory!));
        }

        if (!emails) return [];
        const activeCategory = tabs.find(t => t.key === activeTab)?.category;

        if (activeTab === 'primary') {
            return emails.filter(email => 
                !email.labelIds || 
                !email.labelIds.some(label => categoryLabels.includes(label)) ||
                email.labelIds.includes('CATEGORY_PERSONAL')
            );
        }
        return emails.filter(email => email.labelIds?.includes(activeCategory!));
    };

    const filteredEmails = getFilteredEmails();
    const itemsToDisplay = isCollapsed ? unreadEmails : filteredEmails;

    return (
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
            <header className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
                <h2 className="text-2xl font-bold text-slate-800">Boîte de réception</h2>
                <div className="flex items-center gap-2">
                    {!isCollapsed && auth.isLoggedIn && (
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="flex items-center justify-center w-8 h-8 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                            aria-label="Actualiser la boîte de réception"
                        >
                        {isLoading ? <LoaderIcon className="w-5 h-5"/> : <ArrowPathIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <button
                        onClick={onCompose}
                        className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        aria-label="Nouveau message"
                    >
                        <PencilIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onToggleCollapse} className="p-1 text-slate-400 hover:text-slate-600">
                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                    </button>
                </div>
            </header>
            
            {isCollapsed ? (
                <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
                    {isLoading ? <LoaderIcon className="w-6 h-6 text-slate-400" /> : <span>{unreadEmails.length} non lu(s)</span>}
                </div>
            ) : (
                <>
                    <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher dans les e-mails..."
                            className="flex-grow w-full px-4 py-2 text-base bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                        />
                        <button
                            type="submit"
                            aria-label="Lancer la recherche"
                            className="p-2 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-transform active:scale-95"
                        >
                            <MagnifyingGlassIcon className="w-5 h-5" />
                        </button>
                    </form>

                    {isSearching ? (
                        <div className="flex justify-center items-center h-full py-10">
                            <LoaderIcon className="w-8 h-8 text-indigo-600" />
                        </div>
                    ) : searchResults !== null ? (
                        <div className="flex-grow overflow-y-auto max-h-[450px] pr-2 -mr-2">
                            <div className="flex justify-between items-center mb-2 sticky top-0 bg-white py-2 z-10">
                                <h3 className="font-semibold text-slate-700 truncate">Résultats pour "{searchQuery}"</h3>
                                <button onClick={handleClearSearch} className="text-sm font-semibold text-indigo-600 hover:underline flex-shrink-0 ml-2">
                                    Retour à la boîte de réception
                                </button>
                            </div>
                            {searchError && (
                                <div className="text-center py-10 bg-red-50 text-red-700 rounded-lg p-4">
                                    <p className="font-semibold">Erreur</p>
                                    <p className="text-sm">{searchError}</p>
                                </div>
                            )}
                            {!searchError && searchResults.length > 0 ? (
                                <div className="space-y-2">
                                    {searchResults.map(email => (
                                        <EmailItem key={email.id} email={email} onClick={onOpenEmail} onDragStart={onDragStart} />
                                    ))}
                                </div>
                            ) : (
                                !searchError && <p className="text-center text-slate-500 py-10">Aucun e-mail trouvé.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="border-b border-slate-200">
                                <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`${
                                                activeTab === tab.key
                                                ? 'border-indigo-500 text-indigo-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <div className="flex-grow overflow-y-auto max-h-[450px] pr-2 -mr-2 mt-4">
                                {isLoading && (
                                    <div className="flex justify-center items-center h-full py-10">
                                        <LoaderIcon className="w-8 h-8 text-indigo-600" />
                                    </div>
                                )}
                                
                                {error && auth.isLoggedIn && (
                                    <div className="text-center py-10 bg-red-50 text-red-700 rounded-lg p-4">
                                        <p className="font-semibold">Erreur</p>
                                        <p className="text-sm">{error}</p>
                                    </div>
                                )}

                                {!isLoading && !error && (
                                    <div className="space-y-2">
                                        {itemsToDisplay.length > 0 ? itemsToDisplay.map(email => (
                                            <EmailItem key={email.id} email={email} onClick={onOpenEmail} onDragStart={onDragStart} />
                                        )) : (
                                            <div className="text-center py-10 h-full flex flex-col justify-center items-center">
                                                <p className="text-slate-500">
                                                    {isCollapsed ? "Aucun message non lu." : `Votre onglet "${tabs.find(t => t.key === activeTab)?.label}" est vide.`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {!isLoading && auth.isLoggedIn && hasNextPage && (
                                <div className="mt-4">
                                    <button
                                        onClick={onLoadMore}
                                        disabled={isMoreLoading}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                        {isMoreLoading ? (
                                            <>
                                                <LoaderIcon className="w-4 h-4" />
                                                <span>Chargement...</span>
                                            </>
                                        ) : (
                                            <span>Charger plus</span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {!auth.isLoggedIn && (
                                <div className="text-center text-xs text-slate-400 pt-3 border-t border-slate-100 mt-3">
                                    Données de démonstration. <button onClick={auth.signIn} className="font-semibold text-indigo-500 hover:underline">Connectez-vous</button> pour voir vos e-mails.
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default GmailView;
