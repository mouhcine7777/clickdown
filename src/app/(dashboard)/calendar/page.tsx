// src/app/(dashboard)/calendar/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project, User } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
  isWeekend
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  FolderOpen,
  X,
  Flag,
  CheckCircle2,
  AlertCircle,
  Filter,
  User as UserIcon,
  Circle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Zap,
  Target
} from 'lucide-react';

interface TaskWithDetails extends Task {
  project?: Project;
  assignedUsers?: User[];
}

interface DayModalData {
  date: Date;
  tasks: TaskWithDetails[];
}

export default function CalendarPage() {
  const { userData, isManager } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayModalData | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  useEffect(() => {
    loadTasks();
  }, [userData, isManager]);

  const loadTasks = async () => {
    if (!userData) return;

    try {
      // Query tasks
      let q;
      if (isManager) {
        q = query(collection(db, 'tasks'));
      } else {
        q = query(
          collection(db, 'tasks'),
          where('assignedTo', 'array-contains', userData.id)
        );
      }

      const querySnapshot = await getDocs(q);
      
      // First pass: collect all tasks and unique IDs
      const tasksData: any[] = [];
      const projectIds = new Set<string>();
      const userIds = new Set<string>();

      querySnapshot.docs.forEach(taskDoc => {
        const data = taskDoc.data();
        
        // Skip tasks without dates
        if (!data.startDate && !data.endDate && !data.dueDate) return;

        tasksData.push({
          id: taskDoc.id,
          ...data
        });

        // Collect unique project IDs
        if (data.projectId) {
          projectIds.add(data.projectId);
        }

        // Collect unique user IDs
        if (data.assignedTo) {
          const assignees = Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo];
          assignees.forEach((userId: string) => {
            if (userId) userIds.add(userId);
          });
        }
      });

      // Batch fetch all projects at once
      const projectsMap = new Map<string, Project>();
      if (projectIds.size > 0) {
        const projectPromises = Array.from(projectIds).map(async (projectId: string) => {
          try {
            const projectDoc = await getDoc(doc(db, 'projects', projectId));
            if (projectDoc.exists()) {
              const projectData = projectDoc.data();
              return {
                id: projectDoc.id,
                data: {
                  id: projectDoc.id,
                  name: projectData.name || 'Unknown Project',
                  description: projectData.description || '',
                  managerId: projectData.managerId || '',
                  status: projectData.status || 'active',
                  startDate: projectData.startDate?.toDate ? projectData.startDate.toDate() : new Date(),
                  endDate: projectData.endDate?.toDate ? projectData.endDate.toDate() : null,
                  createdAt: projectData.createdAt?.toDate ? projectData.createdAt.toDate() : new Date(),
                  updatedAt: projectData.updatedAt?.toDate ? projectData.updatedAt.toDate() : new Date(),
                } as Project
              };
            }
            return null;
          } catch (error) {
            console.error('Error fetching project:', projectId, error);
            return null;
          }
        });

        const projects = await Promise.all(projectPromises);
        projects.forEach(project => {
          if (project) {
            projectsMap.set(project.id, project.data);
          }
        });
      }

      // Batch fetch all users at once
      const usersMap = new Map<string, User>();
      if (userIds.size > 0) {
        const userPromises = Array.from(userIds).map(async (userId: string) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: userDoc.id,
                data: {
                  id: userDoc.id,
                  email: userData.email || '',
                  name: userData.name || 'Unknown User',
                  role: userData.role || 'user',
                  createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
                } as User
              };
            }
            return null;
          } catch (error) {
            console.error('Error fetching user:', userId, error);
            return null;
          }
        });

        const users = await Promise.all(userPromises);
        users.forEach(user => {
          if (user) {
            usersMap.set(user.id, user.data);
          }
        });
      }

      // Now build the complete tasks list with all related data
      const tasksList: TaskWithDetails[] = tasksData.map(data => {
        const assignedTo = Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo].filter(Boolean);
        
        return {
          id: data.id,
          title: data.title || 'Untitled',
          description: data.description || '',
          projectId: data.projectId || '',
          assignedTo,
          assignedBy: data.assignedBy || '',
          priority: data.priority || 'medium',
          status: data.status || 'todo',
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.dueDate?.toDate ? data.dueDate.toDate() : null),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.dueDate?.toDate ? data.dueDate.toDate() : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          project: data.projectId ? projectsMap.get(data.projectId) : undefined,
          assignedUsers: assignedTo.map((userId: string) => usersMap.get(userId)).filter(Boolean) as User[]
        };
      });

      setTasks(tasksList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setLoading(false);
    }
  };

  const getDaysArray = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => {
      if (!task.startDate && !task.endDate) return false;
      
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.endDate!);
      const taskEnd = task.endDate ? new Date(task.endDate) : new Date(task.startDate!);
      
      // Check if the date falls within the task's date range
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const startOnly = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());
      const endOnly = new Date(taskEnd.getFullYear(), taskEnd.getMonth(), taskEnd.getDate());
      
      const isInRange = dateOnly >= startOnly && dateOnly <= endOnly;
      
      // Apply filters
      if (isInRange && filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (isInRange && filterPriority !== 'all' && task.priority !== filterPriority) return false;
      
      return isInRange;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-gradient-to-r from-red-500 to-pink-500';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-amber-500';
      case 'medium': return 'bg-gradient-to-r from-blue-500 to-cyan-500';
      case 'low': return 'bg-gradient-to-r from-green-500 to-emerald-500';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'in-progress': return <Clock className="h-3 w-3 text-blue-600" />;
      case 'review': return <AlertCircle className="h-3 w-3 text-purple-600" />;
      default: return <Circle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-200';
      case 'in-progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'review': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleDayClick = (date: Date) => {
    const dayTasks = getTasksForDay(date);
    setSelectedDay({ date, tasks: dayTasks });
  };

  const days = viewMode === 'month' ? getDaysArray() : getWeekDays();
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get summary stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
  const todayTasks = getTasksForDay(new Date()).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Calendar
            </h1>
          </div>
          <p className="text-gray-600 ml-11">Visualize your workflow and never miss a deadline</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{todayTasks}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-xl">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedTasks}/{totalTasks}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Urgent Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{urgentTasks}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-xl">
                <Zap className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded-xl">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <button
                  onClick={() => setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))}
                  className="p-2 hover:bg-gray-100 rounded-l-xl border border-gray-200 bg-white transition-all hover:shadow-sm"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
                <div className="px-4 py-2 bg-gray-50 border-y border-gray-200 min-w-[200px] text-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {viewMode === 'month' 
                      ? format(currentDate, 'MMMM yyyy')
                      : `Week of ${format(startOfWeek(currentDate), 'MMM d')}`
                    }
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))}
                  className="p-2 hover:bg-gray-100 rounded-r-xl border border-gray-200 bg-white transition-all hover:shadow-sm"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </button>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all hover:shadow-lg hover:scale-105 font-medium text-sm"
              >
                Today
              </button>
            </div>

            {/* View Mode & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View Mode Toggle */}
              <div className="inline-flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    viewMode === 'month' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    viewMode === 'week' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Week
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white hover:border-gray-300 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white hover:border-gray-300 transition-colors"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
            {weekDays.map(day => (
              <div key={day} className="p-4 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {day.slice(0, 3)}
                </p>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className={`grid grid-cols-7`}>
            {days.map((day, index) => {
              const dayTasks = getTasksForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const isWeekendDay = isWeekend(day);
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.002 }}
                  onMouseEnter={() => setHoveredDay(index)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative border-r border-b border-gray-200 cursor-pointer
                    transition-all duration-200
                    ${viewMode === 'month' ? 'min-h-[120px]' : 'min-h-[180px]'}
                    ${!isCurrentMonth ? 'bg-gray-50/50' : isWeekendDay ? 'bg-gray-50/30' : 'bg-white'}
                    ${isCurrentDay ? 'bg-gradient-to-br from-blue-50 to-cyan-50 ring-2 ring-blue-500 ring-inset' : ''}
                    ${hoveredDay === index ? 'bg-gray-50 shadow-inner z-10' : ''}
                    ${dayTasks.length > 0 ? 'hover:shadow-lg' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Day Number */}
                  <div className="p-2">
                    <div className={`
                      inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold
                      ${isCurrentDay 
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg' 
                        : isCurrentMonth 
                          ? 'text-gray-900' 
                          : 'text-gray-400'
                      }
                    `}>
                      {format(day, 'd')}
                    </div>
                  </div>

                  {/* Tasks Container */}
                  <div className="px-2 pb-2 space-y-1">
                    {/* Show first 2-3 tasks based on view mode */}
                    {dayTasks.slice(0, viewMode === 'month' ? 2 : 4).map((task, taskIndex) => (
                      <motion.div
                        key={task.id}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: taskIndex * 0.02 }}
                        className={`
                          group relative text-xs px-2 py-1 rounded-lg flex items-center gap-1 
                          transition-all duration-200 hover:scale-105 hover:shadow-md
                          ${task.status === 'completed' 
                            ? 'bg-gray-100 text-gray-500 line-through opacity-60' 
                            : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200'
                          }
                        `}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />
                        <span className="truncate flex-1 font-medium">{task.title}</span>
                        {getStatusIcon(task.status)}
                      </motion.div>
                    ))}
                    
                    {/* More Tasks Indicator */}
                    {dayTasks.length > (viewMode === 'month' ? 2 : 4) && (
                      <div className="flex items-center justify-center">
                        <span className="
                          px-2 py-1 text-xs font-semibold text-gray-600 
                          bg-gradient-to-r from-gray-100 to-gray-200 
                          rounded-full border border-gray-300 shadow-sm
                          hover:shadow-md transition-all hover:scale-105
                        ">
                          +{dayTasks.length - (viewMode === 'month' ? 2 : 4)} more
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Task Count Badge */}
                  {dayTasks.length > 0 && (
                    <div className="absolute top-2 right-2">
                      <div className="
                        bg-gradient-to-br from-gray-800 to-gray-900 text-white 
                        text-xs font-bold rounded-full w-6 h-6 
                        flex items-center justify-center shadow-lg
                        ring-2 ring-white
                      ">
                        {dayTasks.length}
                      </div>
                    </div>
                  )}

                  {/* Hover Effect Sparkle */}
                  {hoveredDay === index && dayTasks.length > 0 && (
                    <div className="absolute top-1 right-8">
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Day Details Modal */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setSelectedDay(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
              >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <CalendarIcon className="h-6 w-6" />
                        {format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
                      </h2>
                      <p className="text-gray-300 mt-1">
                        {selectedDay.tasks.length} {selectedDay.tasks.length === 1 ? 'task' : 'tasks'} scheduled
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="p-2 hover:bg-white/20 rounded-xl transition-all"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                  {selectedDay.tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No tasks scheduled for this day</p>
                      <p className="text-gray-400 text-sm mt-2">Click on other days to view their tasks</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedDay.tasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className={`
                            group relative bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 
                            border border-gray-200 hover:shadow-xl transition-all duration-300
                            ${task.status === 'completed' ? 'opacity-75' : ''}
                          `}
                        >
                          {/* Priority Indicator Bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${getPriorityColor(task.priority)}`} />
                          
                          <div className="pl-3">
                            <div className="flex items-start justify-between mb-3">
                              <h3 className={`font-semibold text-lg text-gray-900 ${task.status === 'completed' ? 'line-through' : ''}`}>
                                {task.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className={`
                                  px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1
                                  ${task.priority === 'urgent' ? 'bg-red-100 text-red-700 border border-red-200' :
                                    task.priority === 'high' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                    task.priority === 'medium' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    'bg-green-100 text-green-700 border border-green-200'}
                                `}>
                                  <Flag className="h-3 w-3" />
                                  {task.priority}
                                </span>
                                <span className={`
                                  px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border
                                  ${getStatusBadgeStyle(task.status)}
                                `}>
                                  {getStatusIcon(task.status)}
                                  <span className="ml-1">{task.status.replace('-', ' ')}</span>
                                </span>
                              </div>
                            </div>

                            {task.description && (
                              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              {task.project && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
                                  <FolderOpen className="h-4 w-4" />
                                  <span className="font-medium">{task.project.name}</span>
                                </div>
                              )}
                              
                              {task.assignedUsers && task.assignedUsers.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="flex -space-x-2">
                                    {task.assignedUsers.slice(0, 3).map((user, idx) => (
                                      <div
                                        key={user.id}
                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white"
                                        title={user.name}
                                      >
                                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                      </div>
                                    ))}
                                  </div>
                                  {task.assignedUsers.length > 3 && (
                                    <span className="text-gray-500 text-xs">
                                      +{task.assignedUsers.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1 text-gray-500">
                                <Clock className="h-4 w-4" />
                                {task.startDate && task.endDate && !isSameDay(task.startDate, task.endDate) ? (
                                  <span className="font-medium">
                                    {format(task.startDate, 'h:mm a')} <ArrowRight className="h-3 w-3 inline" /> {format(task.endDate, 'h:mm a')}
                                  </span>
                                ) : task.endDate ? (
                                  <span className="font-medium">Due {format(task.endDate, 'h:mm a')}</span>
                                ) : (
                                  <span className="font-medium">Starts {format(task.startDate!, 'h:mm a')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}