// src/app/(dashboard)/tasks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project, User } from '@/lib/types';
import CreateTaskForm from './CreateTaskForm';
import EditTaskModal from './EditTaskModal';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays, isAfter, isBefore, isToday, isTomorrow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Plus,
  Filter,
  Search,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  ChevronRight,
  Flag,
  User as UserIcon,
  FolderOpen,
  MoreVertical,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Timer,
  Users as UsersIcon,
  Activity
} from 'lucide-react';

interface ProjectWithTasks {
  project: Project;
  tasks: Task[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
  };
}

export default function TasksPage() {
  const { userData, isManager } = useAuth();
  const [projectsWithTasks, setProjectsWithTasks] = useState<ProjectWithTasks[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  useEffect(() => {
    loadProjectsAndTasks();
  }, [userData, isManager]);

  // Utility function to calculate project stats
  const calculateProjectStats = (tasks: Task[]) => {
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const overdue = tasks.filter(t => 
      t.endDate && t.status !== 'completed' && isBefore(t.endDate, new Date())
    ).length;

    return {
      total: tasks.length,
      completed,
      inProgress,
      todo,
      overdue
    };
  };

  const loadProjectsAndTasks = async () => {
    if (!userData) {
      console.log('No user data');
      return;
    }

    try {
      console.log('Loading projects and tasks...');
      
      // First, get all projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate ? doc.data().startDate.toDate() : new Date(),
        endDate: doc.data().endDate?.toDate ? doc.data().endDate.toDate() : null,
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : new Date(),
      })) as Project[];

      // Then, get tasks
      let tasksQuery;
      if (isManager) {
        tasksQuery = query(collection(db, 'tasks'));
      } else {
        tasksQuery = query(
          collection(db, 'tasks'),
          where('assignedTo', 'array-contains', userData.id)
        );
      }

      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled',
          description: data.description || '',
          projectId: data.projectId || '',
          assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo].filter(Boolean),
          assignedBy: data.assignedBy || '',
          priority: data.priority || 'medium',
          status: data.status || 'todo',
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.dueDate?.toDate ? data.dueDate.toDate() : null),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.dueDate?.toDate ? data.dueDate.toDate() : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        } as Task;
      });

      // Group tasks by project
      const projectTasksMap = new Map<string, Task[]>();
      allTasks.forEach(task => {
        if (!projectTasksMap.has(task.projectId)) {
          projectTasksMap.set(task.projectId, []);
        }
        projectTasksMap.get(task.projectId)!.push(task);
      });

      // Create ProjectWithTasks array
      const projectsData: ProjectWithTasks[] = projects
        .filter(project => projectTasksMap.has(project.id))
        .map(project => {
          const tasks = projectTasksMap.get(project.id) || [];
          return {
            project,
            tasks,
            stats: calculateProjectStats(tasks)
          };
        })
        .sort((a, b) => b.tasks.length - a.tasks.length); // Sort by number of tasks

      setProjectsWithTasks(projectsData);
      // Expand all projects by default
      setExpandedProjects(new Set(projectsData.map(p => p.project.id)));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      
      // Update local state and recalculate stats
      setProjectsWithTasks(prev => 
        prev.map(pwt => {
          const updatedTasks = pwt.tasks.map(task => 
            task.id === taskId ? { ...task, status: newStatus } : task
          );
          
          return {
            ...pwt,
            tasks: updatedTasks,
            stats: calculateProjectStats(updatedTasks)
          };
        })
      );
      
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Circle className="h-4 w-4" />;
      case 'in-progress': return <Clock className="h-4 w-4 animate-pulse" />;
      case 'review': return <AlertCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Zap className="h-3 w-3" />;
      case 'high': return <TrendingUp className="h-3 w-3" />;
      case 'medium': return <Target className="h-3 w-3" />;
      case 'low': return <Activity className="h-3 w-3" />;
      default: return <Flag className="h-3 w-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100 border-green-200';
      case 'in-progress': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'review': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'todo': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getProjectHealth = (stats: ProjectWithTasks['stats']) => {
    if (stats.total === 0) return 'neutral';
    const completionRate = stats.completed / stats.total;
    const overdueRate = stats.overdue / stats.total;
    
    if (overdueRate > 0.3) return 'critical';
    if (overdueRate > 0.1) return 'warning';
    if (completionRate > 0.7) return 'excellent';
    if (completionRate > 0.5) return 'good';
    return 'neutral';
  };

  const getProjectHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'neutral': return 'bg-gray-400';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getDateInfo = (task: Task) => {
    if (!task.endDate) return null;
    
    const today = new Date();
    const endDate = new Date(task.endDate);
    const daysLeft = differenceInDays(endDate, today);
    
    if (task.status === 'completed') return null;
    
    if (isToday(endDate)) return { text: 'Due today', color: 'text-orange-600' };
    if (isTomorrow(endDate)) return { text: 'Due tomorrow', color: 'text-yellow-600' };
    if (daysLeft < 0) return { text: `${Math.abs(daysLeft)} days overdue`, color: 'text-red-600' };
    if (daysLeft <= 3) return { text: `${daysLeft} days left`, color: 'text-orange-600' };
    return { text: format(endDate, 'MMM dd'), color: 'text-gray-500' };
  };

  const filteredProjectsWithTasks = projectsWithTasks
    .map(pwt => ({
      ...pwt,
      tasks: pwt.tasks.filter(task => {
        const matchesSearch = searchQuery === '' || 
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        
        return matchesSearch && matchesStatus && matchesPriority;
      })
    }))
    .filter(pwt => pwt.tasks.length > 0);

  const statusOptions = ['todo', 'in-progress', 'review', 'completed'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalTasks = filteredProjectsWithTasks.reduce((sum, pwt) => sum + pwt.tasks.length, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              Task Management
            </h1>
            <p className="text-gray-600 mt-2">
              {totalTasks} tasks across {filteredProjectsWithTasks.length} projects
            </p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by title or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters and View Mode */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Projects and Tasks */}
      {filteredProjectsWithTasks.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white rounded-2xl shadow-sm"
        >
          <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No tasks found</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or create a new task</p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {filteredProjectsWithTasks.map((projectData, projectIndex) => {
            const isExpanded = expandedProjects.has(projectData.project.id);
            const health = getProjectHealth(projectData.stats);
            
            return (
              <motion.div
                key={projectData.project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: projectIndex * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Project Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleProject(projectData.project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-1 h-12 rounded-full ${getProjectHealthColor(health)}`} />
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                          <FolderOpen className="h-5 w-5 text-gray-600" />
                          {projectData.project.name}
                          <span className="text-sm font-normal text-gray-500">
                            ({projectData.stats.total} tasks)
                          </span>
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">{projectData.project.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Project Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-gray-600">{projectData.stats.completed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-gray-600">{projectData.stats.inProgress}</span>
                        </div>
                        {projectData.stats.overdue > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="text-red-600 font-medium">{projectData.stats.overdue}</span>
                          </div>
                        )}
                      </div>
                      
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{Math.round((projectData.stats.completed / projectData.stats.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(projectData.stats.completed / projectData.stats.total) * 100}%` }}
                        transition={{ duration: 0.5, delay: projectIndex * 0.1 }}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Tasks Grid/List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-gray-200"
                    >
                      <div className={`p-6 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}`}>
                        {projectData.tasks.map((task, taskIndex) => {
                          const dateInfo = getDateInfo(task);
                          
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: taskIndex * 0.05 }}
                              className={`
                                relative group
                                ${viewMode === 'grid' 
                                  ? 'bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-all hover:shadow-md' 
                                  : 'bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all flex items-center justify-between'
                                }
                                ${task.status === 'completed' ? 'opacity-60' : ''}
                              `}
                            >
                              {viewMode === 'grid' ? (
                                // Grid View
                                <>
                                  <div className="flex items-start justify-between mb-3">
                                    <h3 className={`font-medium text-gray-900 flex-1 pr-2 ${task.status === 'completed' ? 'line-through' : ''}`}>
                                      {task.title}
                                    </h3>
                                    <button
                                      onClick={() => handleEditTask(task)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                    >
                                      <Edit className="h-4 w-4 text-gray-600" />
                                    </button>
                                  </div>
                                  
                                  {task.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  <div className="space-y-2">
                                    {/* Priority and Status */}
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                                        {getPriorityIcon(task.priority)}
                                        {task.priority}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(task.status)}`}>
                                        {getStatusIcon(task.status)}
                                        <span className="hidden sm:inline">{task.status.replace('-', ' ')}</span>
                                      </span>
                                    </div>

                                    {/* Date and Assignees */}
                                    <div className="flex items-center justify-between text-xs">
                                      {dateInfo && (
                                        <span className={`flex items-center gap-1 ${dateInfo.color}`}>
                                          <Timer className="h-3 w-3" />
                                          {dateInfo.text}
                                        </span>
                                      )}
                                      {task.assignedTo.length > 0 && (
                                        <span className="flex items-center gap-1 text-gray-500">
                                          <UsersIcon className="h-3 w-3" />
                                          {task.assignedTo.length}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status Dropdown */}
                                  <div className="mt-3 relative">
                                    <select
                                      value={task.status}
                                      onChange={(e) => updateTaskStatus(task.id, e.target.value as Task['status'])}
                                      className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                    >
                                      {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                          {status.replace('-', ' ')}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </>
                              ) : (
                                // List View
                                <>
                                  <div className="flex-1 flex items-center gap-4">
                                    <div className="flex-1">
                                      <h3 className={`font-medium text-gray-900 ${task.status === 'completed' ? 'line-through' : ''}`}>
                                        {task.title}
                                      </h3>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                                          {task.description}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                                        {getPriorityIcon(task.priority)}
                                        <span className="hidden sm:inline">{task.priority}</span>
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(task.status)}`}>
                                        {getStatusIcon(task.status)}
                                        <span className="hidden sm:inline">{task.status.replace('-', ' ')}</span>
                                      </span>
                                      {dateInfo && (
                                        <span className={`text-xs ${dateInfo.color}`}>
                                          {dateInfo.text}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleEditTask(task)}
                                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                      <Edit className="h-4 w-4 text-gray-600" />
                                    </button>
                                    <select
                                      value={task.status}
                                      onChange={(e) => updateTaskStatus(task.id, e.target.value as Task['status'])}
                                      className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                    >
                                      {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                          {status.replace('-', ' ')}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="h-4 w-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Task Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateTaskForm 
            onClose={() => setShowCreateForm(false)}
            onSuccess={async () => {
              await loadProjectsAndTasks(); // Reload data to get the new task
              setShowCreateForm(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {showEditModal && selectedTask && (
          <EditTaskModal
            task={selectedTask}
            onClose={() => setShowEditModal(false)}
            onSuccess={async () => {
              await loadProjectsAndTasks(); // Reload data to get updated task
              setShowEditModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}