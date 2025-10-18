import React, { useState } from 'react';
import RichTextEditor from './RichTextEditor';
import { UserProfile } from '../types';

interface ConversationComposerProps {
    onSend: (body: string) => void;
    userProfile: UserProfile | null;
    isSending: boolean;
}

const getInitials = (name: string) => {
    if (!name) return '?';
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export const ConversationComposer: React.FC<ConversationComposerProps> = ({ onSend, userProfile, isSending }) => {
    const [body, setBody] = useState('');

    const handleSend = () => {
        if (body.trim()) {
            onSend(body);
            setBody('');
        }
    };

    return (
        <div className="flex-shrink-0 p-2 sm:p-4 bg-white border-t border-slate-200 flex items-start gap-2 sm:gap-4">
            {userProfile?.picture ? (
                <img src={userProfile.picture} alt="Your profile" className="w-10 h-10 rounded-full flex-shrink-0" />
            ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {getInitials(userProfile?.name || '')}
                </div>
            )}
            <div className="flex-grow min-w-0 border border-slate-300 rounded-lg flex flex-col h-32">
                <RichTextEditor
                    initialContent={body}
                    onContentChange={setBody}
                />
            </div>
            <div className="flex flex-col gap-2">
                <button
                    onClick={handleSend}
                    disabled={isSending || !body.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
                >
                    {isSending ? 'Envoi...' : 'Envoyer'}
                </button>
            </div>
        </div>
    );
};