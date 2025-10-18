import React from 'react';
import { Project, TodoItem, ShoppingItem, CustomList } from '../types';
import { PlusIcon, TrashIcon, LinkIcon, SparklesIcon } from './icons';

interface ProjectsDashboardProps {
  projects: Project[];
  todos: TodoItem[];
  shoppingList: ShoppingItem[];
  customLists: CustomList[];
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onPlanProjectWithAI: () => void;
  onDeleteProject: (id: string) => void;
  onLinkItems: (project: Project) => void;
  isOnline: boolean;
}

const calculateProjectProgress = (
    project: Project, 
    allTodos: TodoItem[], 
    allShoppingItems: ShoppingItem[], 
    allCustomLists: CustomList[]
): number => {
    let totalItems = 0;
    let completedItems = 0;

    const { todoIds, shoppingItemIds, noteIds, customListItemIds } = project.linkedItemIds;

    // To-Dos
    const linkedTodos = allTodos.filter(item => todoIds.includes(item.id));
    totalItems += linkedTodos.length;
    completedItems += linkedTodos.filter(item => item.completed).length;

    // Shopping Items
    const linkedShopping = allShoppingItems.filter(item => shoppingItemIds.includes(item.id));
    totalItems += linkedShopping.length;
    completedItems += linkedShopping.filter(item => item.completed).length;

    // Custom List Items
    const customItemMap = new Map<string, CustomList>();
    allCustomLists.forEach(list => list.items.forEach(item => customItemMap.set(item.id, list)));
    
    const linkedCustomItems = Object.keys(customListItemIds)
        .map(itemId => {
            const list = customItemMap.get(itemId);
            return list?.items.find(i => i.id === itemId);
        })
        .filter(Boolean);

    totalItems += linkedCustomItems.length;
    completedItems += linkedCustomItems.filter(item => item?.completed).length;

    // Notes don't have a completed status, so they don't count towards progress
    // but they could be counted in total if desired. For now, we exclude them.

    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
};

const ProjectCard: React.FC<{
    project: Project;
    progress: number;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onLinkItems: (e: React.MouseEvent) => void;
}> = ({ project, progress, onSelect, onDelete, onLinkItems }) => {
    return (
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex flex-col group">
            <div onClick={onSelect} className="cursor-pointer p-6 flex-grow">
                <h3 className="text-xl font-bold text-slate-800 truncate">{project.title}</h3>
                <p className="text-slate-600 mt-2 h-20 overflow-hidden text-ellipsis">{project.description || 'Aucune description fournie.'}</p>
            </div>
            <div className="px-6 pb-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-500">Progression</span>
                     <span className="text-sm font-bold text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
             <div className="p-2 border-t border-slate-100 flex justify-end gap-1">
                <button 
                    onClick={onLinkItems} 
                    className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md p-2 transition-colors"
                    aria-label={`Lier des éléments au projet ${project.title}`}
                >
                    <LinkIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={onDelete} 
                    className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md p-2 transition-colors"
                    aria-label={`Supprimer le projet ${project.title}`}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const ProjectsDashboard: React.FC<ProjectsDashboardProps> = ({ projects, todos, shoppingList, customLists, onSelectProject, onCreateProject, onPlanProjectWithAI, onDeleteProject, onLinkItems, isOnline }) => {
  return (
    <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800">Mes Projets</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map(project => (
                <ProjectCard 
                    key={project.id}
                    project={project}
                    progress={calculateProjectProgress(project, todos, shoppingList, customLists)}
                    onSelect={() => onSelectProject(project.id)}
                    onLinkItems={(e) => {
                        e.stopPropagation();
                        onLinkItems(project);
                    }}
                    onDelete={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${project.title}" ? Cela ne supprimera pas les éléments liés.`)) {
                             onDeleteProject(project.id);
                        }
                    }}
                />
            ))}
             <div className="bg-white/80 border-2 border-dashed border-slate-300 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[200px] transition-all duration-200">
                 <button
                    onClick={onCreateProject}
                    className="w-full h-1/2 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-t-lg transition-colors duration-200 group"
                >
                    <PlusIcon className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <span className="mt-2 font-bold text-lg">Créer un nouveau projet</span>
                </button>
                <div className="w-full border-t border-dashed border-slate-300 my-2"></div>
                <button
                    onClick={onPlanProjectWithAI}
                    disabled={!isOnline}
                    className="w-full h-1/2 flex flex-col items-center justify-center text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-b-lg transition-colors duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="w-10 h-10 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    <span className="mt-2 font-bold text-lg">Planifier un projet avec l'IA ✨</span>
                </button>
            </div>
        </div>
        {projects.length === 0 && (
            <div className="text-center py-16">
                 <h2 className="text-2xl font-bold text-slate-700">Aucun projet pour l'instant !</h2>
                 <p className="text-slate-500 mt-2">Cliquez sur "Créer un nouveau projet" pour commencer.</p>
            </div>
        )}
    </div>
  );
};

export default ProjectsDashboard;