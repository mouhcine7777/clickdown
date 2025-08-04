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
  parseISO
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
  User as UserIcon
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
      const tasksList: TaskWithDetails[] = [];

      for (const taskDoc of querySnapshot.docs) {
        const data = taskDoc.data();
        
        // Skip tasks without dates
        if (!data.startDate && !data.endDate && !data.dueDate) continue;

        const taskData: Task = {
          id: taskDoc.id,
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
        };

        // Fetch project details
        let project: Project | undefined;
        if (taskData.projectId) {
          try {
            const projectDoc = await getDoc(doc(db, 'projects', taskData.projectId));
            if (projectDoc.exists()) {
              const projectData = projectDoc.data();
              project = {
                id: projectDoc.id,
                name: projectData.name || 'Unknown Project',
                description: projectData.description || '',
                managerId: projectData.managerId || '',
                status: projectData.status || 'active',
                startDate: projectData.startDate?.toDate ? projectData.startDate.toDate() : new Date(),
                endDate: projectData.endDate?.toDate ? projectData.endDate.toDate() : null,
                createdAt: projectData.createdAt?.toDate ? projectData.createdAt.toDate() : new Date(),
                updatedAt: projectData.updatedAt?.toDate ? projectData.updatedAt.toDate() : new Date(),
              };
            }
          } catch (error) {
            console.error('Error fetching project:', error);
          }
        }

        // Fetch assigned users
        let assignedUsers: User[] = [];
        if (taskData.assignedTo && taskData.assignedTo.length > 0) {
          try {
            const userPromises = taskData.assignedTo.map(async (userId) => {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                return {
                  id: userDoc.id,
                  email: userData.email || '',
                  name: userData.name || 'Unknown User',
                  role: userData.role || 'user',
                  createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
                } as User;
              }
              return null;
            });
            
            const users = await Promise.all(userPromises);
            assignedUsers = users.filter(Boolean) as User[];
          } catch (error) {
            console.error('Error fetching users:', error);
          }
        }

        tasksList.push({
          ...taskData,
          project,
          assignedUsers
        });
      }

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
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3" />;
      case 'in-progress': return <Clock className="h-3 w-3" />;
      case 'review': return <AlertCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const handleDayClick = (date: Date) => {
    const dayTasks = getTasksForDay(date);
    if (dayTasks.length > 0) {
      setSelectedDay({ date, tasks: dayTasks });
    }
  };

  const days = viewMode === 'month' ? getDaysArray() : getWeekDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar</h1>
        <p className="text-gray-600">View all your tasks and deadlines in one place</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                {viewMode === 'month' 
                  ? format(currentDate, 'MMMM yyyy')
                  : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
                }
              </h2>
              <button
                onClick={() => setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Today
            </button>
          </div>

          {/* View Mode & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Week
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={`grid grid-cols-7 ${viewMode === 'month' ? 'auto-rows-[120px]' : 'auto-rows-[200px]'}`}>
          {days.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                onClick={() => handleDayClick(day)}
                className={`
                  relative p-2 border-r border-b border-gray-200 cursor-pointer
                  hover:bg-gray-50 transition-colors
                  ${!isCurrentMonth ? 'bg-gray-50' : ''}
                  ${isCurrentDay ? 'bg-blue-50' : ''}
                  ${dayTasks.length > 0 ? 'hover:shadow-inner' : ''}
                `}
              >
                {/* Day Number */}
                <div className={`
                  text-sm font-medium mb-1
                  ${isCurrentDay ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                `}>
                  {format(day, 'd')}
                </div>

                {/* Tasks */}
                <div className="space-y-1 overflow-hidden">
                  {dayTasks.slice(0, viewMode === 'month' ? 3 : 5).map((task, taskIndex) => (
                    <div
                      key={task.id}
                      className={`
                        text-xs p-1 rounded flex items-center gap-1
                        ${task.status === 'completed' ? 'bg-gray-100 text-gray-600 line-through' : 'bg-blue-100 text-blue-800'}
                      `}
                    >
                      <div className={`w-1 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                      <span className="truncate flex-1">{task.title}</span>
                      {getStatusIcon(task.status)}
                    </div>
                  ))}
                  
                  {dayTasks.length > (viewMode === 'month' ? 3 : 5) && (
                    <div className="text-xs text-gray-500 font-medium">
                      +{dayTasks.length - (viewMode === 'month' ? 3 : 5)} more
                    </div>
                  )}
                </div>

                {/* Task Count Badge */}
                {dayTasks.length > 0 && (
                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {dayTasks.length}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Urgent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-gray-600">High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-600">Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Low Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-gray-600">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-purple-600" />
            <span className="text-gray-600">Review</span>
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedDay(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-blue-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
                    </h2>
                    <p className="text-blue-100 mt-1">
                      {selectedDay.tasks.length} {selectedDay.tasks.length === 1 ? 'task' : 'tasks'} due
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                <div className="space-y-4">
                  {selectedDay.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`
                        bg-gray-50 rounded-lg p-4 border border-gray-200
                        ${task.status === 'completed' ? 'opacity-75' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'line-through' : ''}`}>
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`
                            px-2 py-1 rounded-full text-xs font-medium
                            ${task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'}
                          `}>
                            <Flag className="h-3 w-3 inline mr-1" />
                            {task.priority}
                          </span>
                          <span className={`
                            px-2 py-1 rounded-full text-xs font-medium
                            ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              task.status === 'review' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'}
                          `}>
                            {getStatusIcon(task.status)}
                            <span className="ml-1">{task.status.replace('-', ' ')}</span>
                          </span>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {task.project && (
                          <div className="flex items-center">
                            <FolderOpen className="h-4 w-4 mr-1" />
                            {task.project.name}
                          </div>
                        )}
                        
                        {task.assignedUsers && task.assignedUsers.length > 0 && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {task.assignedUsers.map(user => user.name).join(', ')}
                          </div>
                        )}
                        
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {task.startDate && task.endDate && !isSameDay(task.startDate, task.endDate) ? (
                            <span>
                              {format(task.startDate, 'h:mm a')} - {format(task.endDate, 'h:mm a')}
                            </span>
                          ) : task.endDate ? (
                            <span>Due {format(task.endDate, 'h:mm a')}</span>
                          ) : (
                            <span>Starts {format(task.startDate!, 'h:mm a')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}