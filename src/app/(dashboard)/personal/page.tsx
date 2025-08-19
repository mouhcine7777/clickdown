// src/app/(dashboard)/personal/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus,
  CheckCircle2, 
  Circle,
  Trash2,
  Edit3,
  Save,
  X,
  User,
  Target,
  Calendar,
  Sparkles,
  ListTodo,
  Clock,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Palette,
  Briefcase,
  Heart,
  Home,
  BookOpen,
  Dumbbell,
  Code,
  Camera,
  Music,
  Plane,
  Star,
  Lightbulb
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface PersonalTodo {
  id: string;
  title: string;
  description?: string;
  userId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
}

interface PersonalProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PROJECT_COLORS = [
  { name: 'Blue', value: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  { name: 'Green', value: 'green', bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700' },
  { name: 'Red', value: 'red', bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-700' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700' },
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700' },
  { name: 'Teal', value: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700' },
];

const PROJECT_ICONS = [
  { name: 'Briefcase', value: 'briefcase', icon: Briefcase },
  { name: 'Heart', value: 'heart', icon: Heart },
  { name: 'Home', value: 'home', icon: Home },
  { name: 'Book', value: 'book', icon: BookOpen },
  { name: 'Fitness', value: 'fitness', icon: Dumbbell },
  { name: 'Code', value: 'code', icon: Code },
  { name: 'Camera', value: 'camera', icon: Camera },
  { name: 'Music', value: 'music', icon: Music },
  { name: 'Travel', value: 'travel', icon: Plane },
  { name: 'Creative', value: 'creative', icon: Palette },
  { name: 'Goals', value: 'goals', icon: Target },
  { name: 'Ideas', value: 'ideas', icon: Lightbulb },
];

export default function PersonalSpacePage() {
  const { userData } = useAuth();
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showQuickProjectForm, setShowQuickProjectForm] = useState(false);
  const [quickProject, setQuickProject] = useState({
    name: '',
    color: 'blue',
    icon: 'briefcase'
  });
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as PersonalTodo['priority'],
    dueDate: '',
    projectId: ''
  });
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    color: 'blue',
    icon: 'briefcase'
  });

  // Get current time for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!userData) return;

    // Listen to projects
    const projectsQuery = query(
      collection(db, 'personalProjects'),
      where('userId', '==', userData.id)
    );

    const unsubscribeProjects = onSnapshot(
      projectsQuery,
      (snapshot) => {
        const projectsList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            color: data.color || 'blue',
            icon: data.icon || 'briefcase',
            userId: data.userId || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          } as PersonalProject;
        });

        projectsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setProjects(projectsList);
      },
      (error) => {
        console.error('Error fetching projects:', error);
        toast.error('Failed to load projects');
      }
    );

    // Listen to todos
    const todosQuery = query(
      collection(db, 'personalTodos'),
      where('userId', '==', userData.id)
    );

    const unsubscribeTodos = onSnapshot(
      todosQuery,
      (snapshot) => {
        const todosList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            userId: data.userId || '',
            completed: data.completed || false,
            priority: data.priority || 'medium',
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            projectId: data.projectId || null,
          } as PersonalTodo;
        });

        todosList.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        setTodos(todosList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching personal todos:', error);
        setLoading(false);
        toast.error('Failed to load your personal todos');
      }
    );

    return () => {
      unsubscribeProjects();
      unsubscribeTodos();
    };
  }, [userData]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !newProject.name.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'personalProjects'), {
        name: newProject.name.trim(),
        description: newProject.description.trim(),
        color: newProject.color,
        icon: newProject.icon,
        userId: userData.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewProject({ name: '', description: '', color: 'blue', icon: 'briefcase' });
      setShowProjectForm(false);
      setExpandedProjects(prev => new Set([...prev, docRef.id]));
      toast.success('Project created!');
    } catch (error) {
      console.error('Error adding project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleAddQuickProject = async () => {
    if (!userData || !quickProject.name.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'personalProjects'), {
        name: quickProject.name.trim(),
        description: '',
        color: quickProject.color,
        icon: quickProject.icon,
        userId: userData.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Auto-select the newly created project
      setNewTodo(prev => ({ ...prev, projectId: docRef.id }));
      setQuickProject({ name: '', color: 'blue', icon: 'briefcase' });
      setShowQuickProjectForm(false);
      setExpandedProjects(prev => new Set([...prev, docRef.id]));
      toast.success('Project created and selected!');
    } catch (error) {
      console.error('Error adding quick project:', error);
      toast.error('Failed to create project');
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !newTodo.title.trim()) return;

    try {
      await addDoc(collection(db, 'personalTodos'), {
        title: newTodo.title.trim(),
        description: newTodo.description.trim(),
        userId: userData.id,
        completed: false,
        priority: newTodo.priority,
        dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
        projectId: newTodo.projectId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewTodo({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '' });
      setShowAddForm(false);
      toast.success('Task added!');
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Failed to add task');
    }
  };

  const handleToggleComplete = async (todo: PersonalTodo) => {
    try {
      await updateDoc(doc(db, 'personalTodos', todo.id), {
        completed: !todo.completed,
        updatedAt: serverTimestamp(),
      });
      toast.success(todo.completed ? 'Task marked as incomplete' : 'Task completed!');
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteDoc(doc(db, 'personalTodos', todoId));
      toast.success('Task deleted');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      // Delete all tasks in this project
      const projectTodos = todos.filter(t => t.projectId === projectId);
      await Promise.all(projectTodos.map(todo => deleteDoc(doc(db, 'personalTodos', todo.id))));
      
      // Delete the project
      await deleteDoc(doc(db, 'personalProjects', projectId));
      toast.success('Project and all its tasks deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleEditTodo = async (todo: PersonalTodo, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateDoc(doc(db, 'personalTodos', todo.id), {
        title: newTitle.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      toast.success('Task updated');
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update task');
    }
  };

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getProjectColor = (colorName: string) => {
    return PROJECT_COLORS.find(c => c.value === colorName) || PROJECT_COLORS[0];
  };

  const getProjectIcon = (iconName: string) => {
    return PROJECT_ICONS.find(i => i.value === iconName)?.icon || Briefcase;
  };

  // Organize todos by project
  const unassignedTodos = todos.filter(t => !t.projectId);
  const projectTodos = projects.map(project => ({
    project,
    todos: todos.filter(t => t.projectId === project.id)
  }));

  const completedTodos = todos.filter(t => t.completed).length;
  const pendingTodos = todos.filter(t => !t.completed).length;
  const urgentTodos = todos.filter(t => t.priority === 'urgent' && !t.completed).length;

  const statCards = [
    {
      title: 'Projects',
      value: projects.length,
      icon: Folder,
      gradient: 'from-purple-600 to-pink-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Total Tasks',
      value: todos.length,
      icon: ListTodo,
      gradient: 'from-blue-600 to-cyan-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Completed',
      value: completedTodos,
      icon: CheckCircle2,
      gradient: 'from-green-600 to-emerald-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Urgent',
      value: urgentTodos,
      icon: Target,
      gradient: 'from-red-600 to-pink-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
  ];

  const renderTodoItem = (todo: PersonalTodo, index: number) => (
    <motion.div
      key={todo.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 hover:bg-gray-50 transition-all group ${todo.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => handleToggleComplete(todo)}
          className={`mt-1 p-1 rounded-full transition-all hover:scale-110 ${
            todo.completed 
              ? 'text-green-600 hover:text-green-700' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {todo.completed ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
        
        <div className="flex-1">
          {editingId === todo.id ? (
            <input
              type="text"
              defaultValue={todo.title}
              autoFocus
              onBlur={(e) => handleEditTodo(todo, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEditTodo(todo, e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                }
              }}
              className="text-gray-900 w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <h3 
              className={`font-medium group-hover:text-blue-600 transition-colors cursor-pointer ${
                todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
              }`}
              onClick={() => setEditingId(todo.id)}
            >
              {todo.title}
            </h3>
          )}
          
          {todo.description && (
            <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
              {todo.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium border ${getPriorityBadge(todo.priority)}`}>
              {todo.priority}
            </span>
            {todo.dueDate && (
              <span className={`text-xs flex items-center ${
                todo.completed ? 'text-gray-400' : 
                todo.dueDate < new Date() ? 'text-red-500' : 'text-gray-500'
              }`}>
                <Calendar className="h-3 w-3 mr-1" />
                {format(todo.dueDate, 'MMM dd, yyyy')}
              </span>
            )}
            <span className="text-xs text-gray-400">
              Created {format(todo.createdAt, 'MMM dd')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditingId(todo.id)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit3 className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
          <button
            onClick={() => handleDeleteTodo(todo.id)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                  <User className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Personal Space
                </h1>
              </div>
              <p className="text-gray-600 text-lg">
                {getGreeting()}, {userData?.name?.split(' ')[0]}! Organize your life with projects and tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowProjectForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <FolderPlus className="h-5 w-5" />
                New Project
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <Plus className="h-5 w-5" />
                Add Task
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Project Form */}
        <AnimatePresence>
          {showProjectForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Project</h3>
                <button
                  onClick={() => setShowProjectForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAddProject} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Project name..."
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Project description (optional)..."
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PROJECT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewProject(prev => ({ ...prev, color: color.value }))}
                          className={`w-full h-12 rounded-lg border-2 transition-all ${
                            newProject.color === color.value 
                              ? 'border-gray-900 scale-105' 
                              : 'border-gray-200 hover:border-gray-400'
                          } ${color.bg}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PROJECT_ICONS.map((iconOption) => {
                        const IconComponent = iconOption.icon;
                        return (
                          <button
                            key={iconOption.value}
                            type="button"
                            onClick={() => setNewProject(prev => ({ ...prev, icon: iconOption.value }))}
                            className={`w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center ${
                              newProject.icon === iconOption.value 
                                ? 'border-gray-900 bg-gray-100 scale-105' 
                                : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <IconComponent className="h-5 w-5 text-gray-600" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Save className="h-4 w-4" />
                    Create Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Task Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add New Task</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Task title..."
                    value={newTodo.title}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Description (optional)..."
                    value={newTodo.description}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                    <div className="relative">
                      <select
                        value={newTodo.projectId}
                        onChange={(e) => {
                          if (e.target.value === 'create-new') {
                            setShowQuickProjectForm(true);
                          } else {
                            setNewTodo(prev => ({ ...prev, projectId: e.target.value }));
                          }
                        }}
                        className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No Project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                        <option value="create-new" className="text-blue-600 font-medium">
                          + Create New Project
                        </option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, priority: e.target.value as PersonalTodo['priority'] }))}
                      className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (optional)</label>
                    <input
                      type="date"
                      value={newTodo.dueDate}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Quick Project Creation Form */}
                <AnimatePresence>
                  {showQuickProjectForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-gray-200 pt-4 mt-4"
                    >
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Project Creation</h4>
                      <div className="space-y-3">
                        <div>
                          <input
                            type="text"
                            placeholder="Project name..."
                            value={quickProject.name}
                            onChange={(e) => setQuickProject(prev => ({ ...prev, name: e.target.value }))}
                            className="text-gray-900 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                            <div className="grid grid-cols-4 gap-1">
                              {PROJECT_COLORS.slice(0, 8).map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  onClick={() => setQuickProject(prev => ({ ...prev, color: color.value }))}
                                  className={`w-full h-8 rounded-md border transition-all ${
                                    quickProject.color === color.value 
                                      ? 'border-gray-900 scale-105' 
                                      : 'border-gray-200 hover:border-gray-400'
                                  } ${color.bg}`}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                            <div className="grid grid-cols-4 gap-1">
                              {PROJECT_ICONS.slice(0, 8).map((iconOption) => {
                                const IconComponent = iconOption.icon;
                                return (
                                  <button
                                    key={iconOption.value}
                                    type="button"
                                    onClick={() => setQuickProject(prev => ({ ...prev, icon: iconOption.value }))}
                                    className={`w-full h-8 rounded-md border transition-all flex items-center justify-center ${
                                      quickProject.icon === iconOption.value 
                                        ? 'border-gray-900 bg-gray-100 scale-105' 
                                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    <IconComponent className="h-3 w-3 text-gray-600" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleAddQuickProject}
                            disabled={!quickProject.name.trim()}
                            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-3 w-3" />
                            Create & Select
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuickProjectForm(false);
                              setQuickProject({ name: '', color: 'blue', icon: 'briefcase' });
                            }}
                            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Save className="h-4 w-4" />
                    Add Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Projects and Tasks */}
        <div className="space-y-6">
          {/* Project-based Tasks */}
          {projectTodos.map(({ project, todos: projectTaskList }) => {
            const completedInProject = projectTaskList.filter(t => t.completed).length;
            const totalInProject = projectTaskList.length;
            const projectColor = getProjectColor(project.color);
            const ProjectIcon = getProjectIcon(project.icon);
            const isExpanded = expandedProjects.has(project.id);

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                {/* Project Header */}
                <div 
                  className={`p-6 ${projectColor.light} border-b border-gray-100 cursor-pointer`}
                  onClick={() => toggleProjectExpansion(project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 ${projectColor.bg} rounded-xl`}>
                        <ProjectIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${projectColor.light} ${projectColor.text}`}>
                            {totalInProject} tasks
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-gray-600 mt-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`${projectColor.bg} h-2 rounded-full transition-all`}
                                style={{ 
                                  width: totalInProject > 0 ? `${(completedInProject / totalInProject) * 100}%` : '0%' 
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {completedInProject}/{totalInProject} completed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                      </button>
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Project Tasks */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-gray-100">
                        {projectTaskList.length === 0 ? (
                          <div className="p-8 text-center">
                            <ListTodo className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 mb-2">No tasks in this project yet</p>
                            <button
                              onClick={() => {
                                setNewTodo(prev => ({ ...prev, projectId: project.id }));
                                setShowAddForm(true);
                              }}
                              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all mx-auto"
                            >
                              <Plus className="h-4 w-4" />
                              Add First Task
                            </button>
                          </div>
                        ) : (
                          projectTaskList.map((todo, index) => renderTodoItem(todo, index))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Unassigned Tasks */}
          {unassignedTodos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300"
            >
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl">
                      <ListTodo className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Unassigned Tasks</h2>
                      <p className="text-xs text-gray-500">Tasks not assigned to any project</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {unassignedTodos.filter(t => t.completed).length}/{unassignedTodos.length} completed
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {unassignedTodos.map((todo, index) => renderTodoItem(todo, index))}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading your projects and tasks...</p>
            </div>
          ) : projects.length === 0 && todos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="flex justify-center gap-4 mb-6">
                  <div className="p-4 bg-purple-100 rounded-2xl">
                    <Folder className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="p-4 bg-blue-100 rounded-2xl">
                    <ListTodo className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Your Personal Space!</h3>
                <p className="text-gray-600 mb-6">
                  Organize your life with projects and tasks. Create your first project to get started, or add some quick tasks.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowProjectForm(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <FolderPlus className="h-5 w-5" />
                    Create Your First Project
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Plus className="h-5 w-5" />
                    Add Quick Task
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick Stats Section */}
        {(todos.length > 0 || projects.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl p-8 text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-white/10 to-transparent rounded-full -ml-24 -mb-24" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <Star className="h-6 w-6 text-yellow-400" />
                <h3 className="text-2xl font-bold">Personal Progress</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-300">Overall Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{projects.length}</div>
                  <div className="text-sm text-gray-300">Active Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{pendingTodos}</div>
                  <div className="text-sm text-gray-300">Pending Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{urgentTodos}</div>
                  <div className="text-sm text-gray-300">Urgent Items</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}