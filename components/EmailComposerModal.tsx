import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, UserPlusIcon } from './icons';
import { Contact, EmailData } from '../types';
import RichTextEditor from './RichTextEditor';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: (emailData: EmailData) => void;
  onSend: (emailData: EmailData) => void;
  initialEmail: EmailData | null;
  contacts: Contact[];
}

// Define RecipientInput outside the main component to prevent re-creation on render
interface RecipientInputProps {
  field: 'to' | 'cc' | 'bcc';
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenContacts: () => void;
}

const RecipientInput: React.FC<RecipientInputProps> = ({ field, label, value, onChange, onOpenContacts }) => {
  return (
    <div>
      <label htmlFor={`email-${field}`} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          id={`email-${field}`}
          name={field}
          type="text"
          value={value}
          onChange={onChange}
          autoComplete="off"
          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
        />
        <button
          type="button"
          onClick={onOpenContacts}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-indigo-600"
          aria-label="Ouvrir le carnet d'adresses"
        >
          <UserPlusIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};


const EmailComposerModal: React.FC<EmailComposerModalProps> = ({ isOpen, onSend, initialEmail, contacts, onClose }) => {
  const [emailData, setEmailData] = useState<EmailData>({ to: '', cc: '', bcc: '', subject: '', body: '' });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  
  const composerRef = useRef<HTMLDivElement>(null);

  const [showContactPickerFor, setShowContactPickerFor] = useState<'to' | 'cc' | 'bcc' | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');


  useEffect(() => {
    if (isOpen) {
      const initial = initialEmail || { to: '', cc: '', bcc: '', subject: '', body: '' };
      setEmailData(initial);
      setShowCc(!!initial.cc);
      setShowBcc(!!initial.bcc);
    }
  }, [isOpen, initialEmail]);


  const handleSelectContact = (contact: Contact) => {
    if (showContactPickerFor) {
      setEmailData(prev => {
        const currentRecipients = prev[showContactPickerFor];
        const newRecipient = contact.email;
        // Logic to handle adding to an existing list of emails
        const newValue = currentRecipients
          ? `${currentRecipients.trim().replace(/,$/, '')}, ${newRecipient}`
          : newRecipient;
        return { ...prev, [showContactPickerFor]: newValue };
      });
    }
    setShowContactPickerFor(null);
    setContactSearchQuery('');
  };

  const filteredContacts = showContactPickerFor
    ? contacts.filter(c =>
        c.displayName.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearchQuery.toLowerCase())
      )
    : [];

  if (!isOpen) {
    return null;
  }

  const handleSend = () => onSend(emailData);
  const handleCloseAndDraft = () => onClose(emailData);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div ref={composerRef} className="bg-white rounded-xl shadow-2xl w-full max-w-3xl m-4 flex flex-col max-h-[90vh] relative">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Composer un e-mail</h2>
          <button onClick={handleCloseAndDraft} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto space-y-4 flex-grow flex flex-col">
          <div className="flex items-baseline">
            <div className="flex-grow">
              <RecipientInput field="to" label="À" value={emailData.to} onChange={handleInputChange} onOpenContacts={() => setShowContactPickerFor('to')} />
            </div>
            <div className="pl-2 flex-shrink-0 self-start pt-8">
              <button type="button" onClick={() => setShowCc(s => !s)} className="text-sm text-slate-500 hover:text-slate-800 px-1">Cc</button>
              <button type="button" onClick={() => setShowBcc(s => !s)} className="text-sm text-slate-500 hover:text-slate-800 px-1">Cci</button>
            </div>
          </div>
          {showCc && <RecipientInput field="cc" label="Cc" value={emailData.cc} onChange={handleInputChange} onOpenContacts={() => setShowContactPickerFor('cc')} />}
          {showBcc && <RecipientInput field="bcc" label="Cci" value={emailData.bcc} onChange={handleInputChange} onOpenContacts={() => setShowContactPickerFor('bcc')} />}
          <div>
            <label htmlFor="email-subject" className="block text-sm font-medium text-slate-700 mb-1">Sujet</label>
            <input
              id="email-subject"
              name="subject"
              type="text"
              value={emailData.subject}
              onChange={handleInputChange}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            />
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <label className="block text-sm font-medium text-slate-700 mb-1">Corps</label>
            <RichTextEditor
                initialContent={emailData.body}
                onContentChange={(newBody) => setEmailData(prev => ({...prev, body: newBody}))}
            />
          </div>
        </div>
        <footer className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={handleCloseAndDraft} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
            Fermer (Brouillon)
          </button>
          <button onClick={handleSend} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            Envoyer
          </button>
        </footer>

        {showContactPickerFor && (
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-start justify-center pt-20 z-10 rounded-xl">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 flex flex-col max-h-[60vh]">
              <header className="p-4 border-b">
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={e => setContactSearchQuery(e.target.value)}
                  placeholder="Rechercher un contact..."
                  className="w-full bg-slate-100 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </header>
              <ul className="overflow-y-auto flex-grow">
                {filteredContacts.length > 0 ? filteredContacts.map(contact => (
                  <li key={contact.resourceName}>
                    <button onClick={() => handleSelectContact(contact)} className="w-full text-left p-3 hover:bg-slate-100 transition-colors">
                      <div className="font-semibold text-slate-800">{contact.displayName}</div>
                      <div className="text-sm text-slate-500">{contact.email}</div>
                    </button>
                  </li>
                )) : (
                  <li className="p-4 text-center text-slate-500">Aucun contact trouvé.</li>
                )}
              </ul>
               <footer className="p-2 border-t flex justify-end">
                <button onClick={() => { setShowContactPickerFor(null); setContactSearchQuery(''); }} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md">
                  Fermer
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailComposerModal;