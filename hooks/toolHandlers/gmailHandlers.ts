import { ai } from '../../services/aiClient';
import * as googleMailService from '../../services/googleMailService';
import { ToolHandler, ToolHandlerContext } from './types';

export const createGmailHandlers = (context: ToolHandlerContext): Record<string, ToolHandler> => {
    const {
        auth,
        latestSearchResultsRef,
        setEmailSearchResults,
        setIsEmailSearchModalOpen,
        setSelectedEmail,
        setEmailToCompose,
        setIsEmailComposerOpen,
        findBestMatchingContact,
        resolveEmailIdentifier,
        triggerHighlight,
        organizer,
    } = context;

    const rechercherEmails = async (args: { requete: string }): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter à Google pour utiliser les fonctions de messagerie.";
        try {
            const results = await googleMailService.searchEmails(auth.accessToken, args.requete);
            latestSearchResultsRef.current = results;
            setEmailSearchResults(results);
            setIsEmailSearchModalOpen(true);
            if (results.length === 0) {
                return "Je n'ai trouvé aucun e-mail correspondant à votre recherche.";
            }
            return `J'ai trouvé ${results.length} e-mail(s) et les ai affichés à l'écran. Lequel souhaitez-vous que je lise ?`;
        } catch (error) {
            console.error("Email search error:", error);
            return "Désolé, une erreur est survenue lors de la recherche de vos e-mails.";
        }
    };

    const lireEmail = async (args: { requeteRecherche?: string }): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter à Google pour lire des e-mails.";
        try {
            let emailToRead = null;
            if (args.requeteRecherche) {
                const results = await googleMailService.searchEmails(auth.accessToken, args.requeteRecherche, 1);
                if (results.length > 0) {
                    emailToRead = await googleMailService.getEmail(auth.accessToken, results[0].id);
                }
            } else {
                const { emails } = await googleMailService.listInboxMessages(auth.accessToken, 1);
                if (emails.length > 0) {
                    emailToRead = emails[0];
                }
            }

            if (!emailToRead) {
                return args.requeteRecherche ? `Je n'ai trouvé aucun e-mail pour votre recherche "${args.requeteRecherche}".` : "Votre boîte de réception est vide.";
            }

            setSelectedEmail(emailToRead);
            const plainTextBody = emailToRead.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return `Voici un e-mail de ${emailToRead.from}, avec pour sujet "${emailToRead.subject}". Le contenu est : ${plainTextBody}`;
        } catch (error) {
            console.error("Error reading email:", error);
            return "Désolé, une erreur est survenue lors de la lecture de l'e-mail.";
        }
    };
    
    const resumerEmailsNonLus = async (args: { nombre?: number }): Promise<string> => {
        if (!auth.accessToken) {
            return "Veuillez vous connecter à Google pour résumer vos e-mails.";
        }
        try {
            const unreadEmails = await googleMailService.listUnreadInboxMessages(auth.accessToken, args.nombre || 5);
    
            if (unreadEmails.length === 0) {
                return "Vous n'avez aucun e-mail non lu.";
            }
    
            const systemInstruction = `Tu es un assistant qui résume des e-mails pour une lecture vocale. Sois concis et naturel.
    Pour chaque e-mail, mentionne l'expéditeur et le sujet, puis résume le contenu en une phrase. Ne dis pas "le contenu est".
    Par exemple: "Vous avez un e-mail de John Doe au sujet du rapport, il indique que tout est en bonne voie. Ensuite, un e-mail de Jane Smith vous invitant à déjeuner."
    Réponds UNIQUEMENT avec le résumé.`;
    
            const emailsForPrompt = unreadEmails.map(e => `De: ${e.from}\nSujet: ${e.subject}\nExtrait: ${e.snippet}`).join('\n\n---\n\n');
            const contents = `Voici les ${unreadEmails.length} derniers e-mails non lus. Résume-les pour moi :\n\n${emailsForPrompt}`;
    
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents,
                config: { systemInstruction },
            });
    
            return response.text;
    
        } catch (error) {
            console.error("Error summarizing emails:", error);
            return "Désolé, une erreur est survenue lors du résumé de vos e-mails.";
        }
    };

    const envoyerEmail = (args: { destinataire: string, sujet: string, corps: string, cc?: string, bcc?: string }): string => {
        const { destinataire, sujet, corps, cc, bcc } = args;
        const resolveAndJoin = (recipients: string | undefined): { value: string; error?: string } => {
            if (!recipients) return { value: '' };
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const parts = recipients.split(/[,;]/).map(r => r.trim()).filter(Boolean);
            const resolvedEmails: string[] = [];
            for (const part of parts) {
                if (emailRegex.test(part)) {
                    resolvedEmails.push(part);
                    continue;
                }
                const contact = findBestMatchingContact(part);
                if (contact) {
                    resolvedEmails.push(contact.email);
                } else {
                    return { value: '', error: `Désolé, je n'ai pas trouvé de contact ou d'e-mail valide pour "${part}".` };
                }
            }
            return { value: resolvedEmails.join(', ') };
        };
        const toResult = resolveAndJoin(destinataire);
        if (toResult.error) return toResult.error;
        if (!toResult.value) return 'Destinataire manquant.';
        const ccResult = resolveAndJoin(cc);
        if (ccResult.error) return ccResult.error;
        const bccResult = resolveAndJoin(bcc);
        if (bccResult.error) return bccResult.error;

        if (!auth.accessToken) {
            return "Veuillez vous connecter à Google pour envoyer des e-mails.";
        }
        
        setEmailToCompose({ to: toResult.value, subject: sujet, body: corps, cc: ccResult.value, bcc: bccResult.value });
        setIsEmailComposerOpen(true);
        return "J'ai préparé le brouillon pour vous. Vous pouvez le vérifier et l'envoyer.";
    };

    const ajouterContenuEmailAuxNotes = async (args: { identifiantEmail: string }): Promise<string> => {
        if (!auth.accessToken) return "Veuillez vous connecter pour utiliser cette fonction.";
        const emailToAdd = resolveEmailIdentifier(args.identifiantEmail);
        if (!emailToAdd) {
            return "Désolé, je n'ai pas pu identifier l'e-mail que vous voulez ajouter aux notes.";
        }
        try {
            const fullEmail = await googleMailService.getEmail(auth.accessToken, emailToAdd.id);
            // FIX: Use `bodyHtml` instead of `body` which does not exist on FullEmail type.
            const noteContent = `<h3>De : ${fullEmail.from}</h3><h4>Sujet : ${fullEmail.subject}</h4><hr/>${fullEmail.bodyHtml}`;
            const { newId, message } = organizer.addNote(noteContent) || {};
            triggerHighlight(newId);
            return message ? `OK, la note a été créée.` : "Une erreur est survenue lors de la création de la note.";
        } catch (error) {
            return "Désolé, je n'ai pas pu récupérer le contenu de cet e-mail pour l'ajouter aux notes.";
        }
    };

    return {
        rechercherEmails,
        lireEmail,
        resumerEmailsNonLus,
        envoyerEmail,
        ajouterContenuEmailAuxNotes,
    };
};