// src/app/(dashboard)/analytics/GanttAnalytics.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Task, Project, User } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  Filter,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle2,
  Activity,
  Users,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  TrendingUp
} from 'lucide-react';

interface GanttAnalyticsProps {
  dateRange: string;
}

interface GanttItem {
  id: string;
  title: string;
  type: 'project' | 'task';
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  status: string;
  priority?: string;
  assignedTo?: string[];
  parentId?: string;
  children?: GanttItem[];
  expanded?: boolean;
}

export default function GanttAnalytics({ dateRange }: GanttAnalyticsProps) {
  const { userData, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ganttData, setGanttData] = useState<GanttItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) return;

      try {
        // Fetch projects
        const projectsSnapshot = await getDocs(query(collection(db, 'projects'), orderBy('startDate', 'asc')));
        const projectsList = projectsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
          } as Project;
        });
        setProjects(projectsList);

        // Fetch tasks
        const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), orderBy('startDate', 'asc')));
        const tasksList = tasksSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
          } as Task;
        });
        setTasks(tasksList);

        // Fetch users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setUsers(usersList);

        // Build Gantt data structure
        buildGanttData(projectsList, tasksList);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData, showOnlyActive]); // Add showOnlyActive to dependencies

  const buildGanttData = (projectsList: Project[], tasksList: Task[]) => {
    const ganttItems: GanttItem[] = [];

    projectsList.forEach(project => {
      const projectTasks = tasksList.filter(task => task.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const totalTasks = projectTasks.length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const projectItem: GanttItem = {
        id: project.id,
        title: project.name,
        type: 'project',
        startDate: project.startDate,
        endDate: project.endDate || new Date(project.startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        progress,
        status: project.status,
        expanded: true,
        children: projectTasks.map(task => ({
          id: task.id,
          title: task.title,
          type: 'task',
          startDate: task.startDate || null,
          endDate: task.endDate || new Date((task.startDate || new Date()).getTime() + 7 * 24 * 60 * 60 * 1000),
          progress: task.status === 'completed' ? 100 : task.status === 'in-progress' ? 50 : 0,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignedTo,
          parentId: project.id
        }))
      };

      if (!showOnlyActive || project.status === 'active') {
        ganttItems.push(projectItem);
      }
    });

    // Add orphan tasks
    const orphanTasks = tasksList.filter(task => !task.projectId);
    if (orphanTasks.length > 0 && !showOnlyActive) {
      ganttItems.push({
        id: 'no-project',
        title: 'Unassigned Tasks',
        type: 'project',
        startDate: new Date(),
        endDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
        progress: 0,
        status: 'active',
        expanded: true,
        children: orphanTasks.map(task => ({
          id: task.id,
          title: task.title,
          type: 'task',
          startDate: task.startDate || null,
          endDate: task.endDate || new Date((task.startDate || new Date()).getTime() + 7 * 24 * 60 * 60 * 1000),
          progress: task.status === 'completed' ? 100 : task.status === 'in-progress' ? 50 : 0,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignedTo,
          parentId: 'no-project'
        }))
      });
    }

    setGanttData(ganttItems);
  };

  const toggleExpand = (projectId: string) => {
    setGanttData(prev => prev.map(item => 
      item.id === projectId ? { ...item, expanded: !item.expanded } : item
    ));
  };

  // Calculate date range
  const getDateRange = () => {
    let minDate = new Date();
    let maxDate = new Date();

    ganttData.forEach(project => {
      if (project.startDate && project.startDate < minDate) minDate = project.startDate;
      if (project.endDate && project.endDate > maxDate) maxDate = project.endDate;
      
      project.children?.forEach(task => {
        if (task.startDate && task.startDate < minDate) minDate = task.startDate;
        if (task.endDate && task.endDate > maxDate) maxDate = task.endDate;
      });
    });

    // Add padding
    minDate = new Date(minDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    maxDate = new Date(maxDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    return { minDate, maxDate };
  };

  const { minDate, maxDate } = getDateRange();
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  // Generate timeline headers with better formatting
  const getTimelineHeaders = () => {
    const headers = [];
    const currentDate = new Date(minDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const isToday = currentDate.toDateString() === today.toDateString();
        headers.push({
          label: currentDate.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
          date: new Date(currentDate),
          startDate: new Date(currentDate),
          endDate: new Date(currentDate),
          isToday
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (viewMode === 'week') {
      const weeks = Math.ceil(totalDays / 7);
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const isCurrentWeek = today >= weekStart && today <= weekEnd;
        headers.push({
          label: `${weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
          date: new Date(weekStart),
          startDate: weekStart,
          endDate: weekEnd,
          isToday: isCurrentWeek
        });
        currentDate.setDate(currentDate.getDate() + 7);
      }
    } else {
      const months = Math.ceil(totalDays / 30);
      for (let i = 0; i < months; i++) {
        const monthStart = new Date(currentDate);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const isCurrentMonth = today >= monthStart && today <= monthEnd;
        headers.push({
          label: currentDate.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
          date: new Date(currentDate),
          startDate: monthStart,
          endDate: monthEnd,
          isToday: isCurrentMonth
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return headers;
  };

  // Helper functions
  const calculatePosition = (startDate: Date | null, endDate: Date | null) => {
    if (!startDate) return { left: '0%', width: '0%' };
    
    const start = Math.floor((startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const end = endDate ? Math.floor((endDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) : start + 1;
    
    const left = (start / totalDays) * 100;
    const width = ((end - start) / totalDays) * 100;

    return { 
      left: `${Math.max(0, left)}%`, 
      width: `${Math.max(1, width)}%` 
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'active': return 'bg-blue-500';
      case 'on-hold': return 'bg-yellow-500';
      case 'review': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500';
      case 'high': return 'border-orange-500';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-gray-300';
    }
  };

  const getUserInitials = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return '?';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-pink-500'];
    return colors[index % colors.length];
  };

  const timelineHeaders = getTimelineHeaders();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {/* View Mode */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ZoomOut className="h-4 w-4 text-gray-600" />
              </button>
              <span className="text-xs font-medium text-gray-600 w-12 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ZoomIn className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            {/* Filter */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active only</span>
            </label>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-gray-600">In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-400 rounded-full" />
              <span className="text-gray-600">To Do</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="flex">
          {/* Left Panel - Task List */}
          <div className="w-80 border-r border-gray-200 flex-shrink-0 z-10 bg-white">
            <div className="h-12 bg-gray-50 border-b border-gray-200 px-4 flex items-center">
              <span className="text-sm font-semibold text-gray-700">Projects & Tasks</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              {ganttData.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No projects or tasks to display</p>
                </div>
              ) : (
                ganttData.map(project => (
                  <div key={project.id}>
                    <div
                      className={`flex items-center px-2 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        selectedItem === project.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedItem(project.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(project.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded mr-2"
                      >
                        {project.expanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      <FolderOpen className="h-4 w-4 text-blue-500 mr-2" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {project.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {project.children?.length || 0} tasks · {project.progress}% complete
                        </p>
                      </div>
                    </div>

                    <AnimatePresence>
                      {project.expanded && project.children?.map(task => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`flex items-center px-8 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                            selectedItem === task.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedItem(task.id)}
                        >
                          <div className="flex-1 flex items-center gap-2">
                            {task.status === 'completed' ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : task.status === 'in-progress' ? (
                              <Activity className="h-3 w-3 text-blue-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-gray-400" />
                            )}
                            <p className="text-sm text-gray-700 truncate">{task.title}</p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Timeline */}
          <div className="flex-1 overflow-x-auto relative">
            <div className="h-12 bg-gray-50 border-b border-gray-200 flex sticky top-0 z-10" style={{ width: `${zoomLevel}%`, minWidth: '100%' }}>
              {timelineHeaders.map((header, index) => (
                <div
                  key={index}
                  className={`flex-1 px-2 flex items-center justify-center text-xs font-medium border-r border-gray-200 ${
                    header.isToday ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-600'
                  }`}
                  style={{ minWidth: viewMode === 'day' ? '100px' : viewMode === 'week' ? '180px' : '200px' }}
                >
                  {header.label}
                </div>
              ))}
            </div>

            <div className="relative" style={{ width: `${zoomLevel}%`, minWidth: '100%' }}>
              {/* Grid Lines with alternating colors */}
              <div className="absolute inset-0 flex pointer-events-none">
                {timelineHeaders.map((header, index) => (
                  <div
                    key={index}
                    className={`flex-1 border-r ${
                      index % 2 === 0 ? 'bg-gray-50/30' : 'bg-white'
                    } ${header.isToday ? 'bg-red-50/20' : ''} border-gray-200`}
                    style={{ minWidth: viewMode === 'day' ? '100px' : viewMode === 'week' ? '180px' : '200px' }}
                  />
                ))}
              </div>



              {/* Gantt Bars */}
              {ganttData.map(project => (
                <div key={project.id}>
                  <div className="relative h-11 border-b border-gray-100 group">
                    <div
                      className="absolute top-2 h-7 rounded-md overflow-hidden shadow-sm border border-gray-300 flex items-center hover:shadow-md transition-shadow cursor-pointer"
                      style={{...calculatePosition(project.startDate, project.endDate), minWidth: '30px', zIndex: 5}}
                      onClick={() => setSelectedItem(project.id)}
                      title={`${project.title} - ${project.progress}% complete`}
                    >
                      <div className={`h-full ${getStatusColor(project.status)} relative flex-1`}>
                        <div
                          className="h-full bg-white/30"
                          style={{ width: `${100 - project.progress}%`, marginLeft: `${project.progress}%` }}
                        />
                        {/* Add project title inside bar if wide enough */}
                        <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                          <span className="text-xs text-white font-medium truncate">
                            {project.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {project.expanded && project.children?.map(task => {
                    const position = calculatePosition(task.startDate, task.endDate);
                    return (
                      <div key={task.id} className="relative h-11 border-b border-gray-100 group">
                        <div
                          className={`absolute top-3 h-5 rounded border-2 overflow-hidden ${getPriorityColor(task.priority)} flex items-center shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                          style={{...position, minWidth: '20px', zIndex: 5}}
                          onClick={() => setSelectedItem(task.id)}
                          title={`${task.title} - ${task.status}`}
                        >
                          <div className={`h-full ${getStatusColor(task.status)} opacity-80 relative flex-1`}>
                            <div
                              className="h-full bg-white/40"
                              style={{ width: `${100 - task.progress}%`, marginLeft: `${task.progress}%` }}
                            />
                          </div>
                          {task.assignedTo && task.assignedTo.length > 0 && (
                            <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 flex -space-x-2">
                              {task.assignedTo.slice(0, 3).map((userId, idx) => (
                                <div
                                  key={userId}
                                  className={`w-5 h-5 rounded-full ${getUserColor(idx)} flex items-center justify-center text-white border-2 border-white shadow-sm`}
                                  style={{ fontSize: '8px' }}
                                  title={users.find(u => u.id === userId)?.name}
                                >
                                  <span className="font-bold">{getUserInitials(userId)}</span>
                                </div>
                              ))}
                              {task.assignedTo.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs border-2 border-white shadow-sm">
                                  +{task.assignedTo.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Projects',
            value: projects.length,
            icon: FolderOpen,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
          },
          {
            label: 'Total Tasks',
            value: tasks.length,
            icon: Layers,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
          },
          {
            label: 'On Track',
            value: ganttData.filter(p => p.progress >= 50).length,
            icon: TrendingUp,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
          },
          {
            label: 'At Risk',
            value: tasks.filter(t => {
              if (!t.endDate || t.status === 'completed') return false;
              return new Date(t.endDate) < new Date();
            }).length,
            icon: AlertCircle,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}