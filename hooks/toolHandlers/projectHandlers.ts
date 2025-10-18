import { Priority } from '../../types';
import { ToolHandler, ToolHandlerContext } from './types';

export const createProjectHandlers = (context: ToolHandlerContext): Record<string, ToolHandler> => {
    const { organizer, restartNeededAfterTurnRef, setProjectToNavigateTo, findBestMatchingItem, findBestMatchingList, triggerHighlight, currentProjectId } = context;

    const creerProjet = (args: { titre: string, description?: string }): string => {
        organizer.addProject(args.titre, args.description || '');
        restartNeededAfterTurnRef.current = true;
        return `OK, j'ai créé le projet "${args.titre}".`;
    };

    const supprimerProjet = (args: { nomProjet: string }): string => {
        const projectToDelete = organizer.findProjectByName(args.nomProjet);
        if (projectToDelete) {
            organizer.deleteProject(projectToDelete.id);
            restartNeededAfterTurnRef.current = true;
            return `OK, j'ai supprimé le projet "${projectToDelete.title}".`;
        }
        return `Désolé, je n'ai pas trouvé de projet nommé "${args.nomProjet}".`;
    };

    const afficherDetailsProjet = (args: { nomProjet: string }): string => {
        const projectToShow = organizer.findProjectByName(args.nomProjet);
        if (projectToShow) {
            setProjectToNavigateTo(projectToShow.id);
            return `OK, j'affiche le projet "${projectToShow.title}".`;
        }
        return `Désolé, je n'ai pas trouvé de projet nommé "${args.nomProjet}".`;
    };

    const lierElementAProjet = (args: { nomElement: string, nomProjet?: string }): string => {
        const targetProject = args.nomProjet ? organizer.findProjectByName(args.nomProjet) : (currentProjectId ? organizer.projects.find(p => p.id === currentProjectId) : null);
        if (!targetProject) {
            return args.nomProjet ? `Désolé, je n'ai pas trouvé le projet "${args.nomProjet}".` : "Veuillez spécifier un projet ou naviguer vers un projet pour lier cet élément.";
        }
        const itemToLink = findBestMatchingItem(args.nomElement);
        if (!itemToLink) {
            return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.nomElement}".`;
        }
        organizer.linkItemToProject(targetProject.id, itemToLink.type, itemToLink.id);
        triggerHighlight(itemToLink.id);
        return `OK, j'ai lié "${itemToLink.text}" au projet "${targetProject.title}".`;
    };

    const delierElementDeProjet = (args: { nomElement: string }): string => {
        const itemToUnlink = findBestMatchingItem(args.nomElement);
        if (!itemToUnlink) {
            return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.nomElement}".`;
        }
        organizer.unlinkItemFromProject(itemToUnlink.type, itemToUnlink.id);
        triggerHighlight(itemToUnlink.id);
        return `OK, j'ai délié "${itemToUnlink.text}" de son projet.`;
    };

    const ajouterEtLierElementAProjet = (args: {
        nomProjet: string;
        typeElement: 'tache' | 'course' | 'note' | 'elementPersonnalise';
        contenu: string;
        priorite?: Priority;
        nomListePersonnalisee?: string;
    }): string => {
        const project = organizer.findProjectByName(args.nomProjet);
        if (!project) {
            return `Désolé, je n'ai pas pu trouver le projet "${args.nomProjet}".`;
        }
    
        let newId: string | undefined;
        let itemTypeForLink: any;
        let confirmationText = '';
    
        if (args.typeElement === 'tache') {
            newId = organizer.addTodo(args.contenu, args.priorite || Priority.Medium)?.newId;
            itemTypeForLink = 'todos';
            confirmationText = `la tâche "${args.contenu}"`;
        } else if (args.typeElement === 'course') {
            newId = organizer.addShoppingItem(args.contenu)?.newId;
            itemTypeForLink = 'shopping';
            confirmationText = `l'article "${args.contenu}"`;
        } else if (args.typeElement === 'note') {
            newId = organizer.addNote(args.contenu)?.newId;
            itemTypeForLink = 'notes';
            confirmationText = `la note`;
        } else if (args.typeElement === 'elementPersonnalise' && args.nomListePersonnalisee) {
            const list = findBestMatchingList(args.nomListePersonnalisee);
            if (list) {
                newId = organizer.addCustomListItem(list.id, args.contenu)?.newId;
                itemTypeForLink = 'custom';
                confirmationText = `l'élément "${args.contenu}" dans la liste "${list.title}"`;
            } else {
                return `Je n'ai pas trouvé la liste personnalisée "${args.nomListePersonnalisee}", donc je n'ai pas pu ajouter l'élément.`;
            }
        }
    
        if (newId && itemTypeForLink) {
            organizer.linkItemToProject(project.id, itemTypeForLink, newId);
            triggerHighlight(newId);
            return `Parfait, j'ai ajouté ${confirmationText} et je l'ai lié au projet "${project.title}".`;
        }
        
        return "Désolé, une erreur s'est produite lors de la création de l'élément.";
    };
    
    return {
        creerProjet,
        supprimerProjet,
        afficherDetailsProjet,
        lierElementAProjet,
        delierElementDeProjet,
        ajouterEtLierElementAProjet,
    };
};
