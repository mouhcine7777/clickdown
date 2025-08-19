// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project, User } from '@/lib/types';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  FolderOpen,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  Zap,
  Target,
  Activity,
  Plus,
  Sparkles,
  ChevronRight,
  ListTodo,
  Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface TaskWithUser extends Task {
  assignedUsers?: User[];
}

export default function DashboardPage() {
  const { userData, isManager } = useAuth();
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
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

    let unsubscribeTasks: (() => void) | null = null;
    let unsubscribeProjects: (() => void) | null = null;

    const setupTasksListener = async () => {
      try {
        let tasksQuery;
        
        if (isManager) {
          tasksQuery = query(
            collection(db, 'tasks'),
            limit(10)
          );
        } else {
          try {
            tasksQuery = query(
              collection(db, 'tasks'),
              where('assignedTo', 'array-contains', userData.id),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            await getDocs(tasksQuery);
          } catch (error: any) {
            console.log('Compound query failed, using simple query:', error.message);
            tasksQuery = query(
              collection(db, 'tasks'),
              where('assignedTo', 'array-contains', userData.id)
            );
          }
        }

        unsubscribeTasks = onSnapshot(
          tasksQuery, 
          async (snapshot) => {
            let tasksList = snapshot.docs.map(doc => {
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
              } as TaskWithUser;
            });

            // Collect all unique user IDs
            const userIds = new Set<string>();
            tasksList.forEach(task => {
              if (task.assignedTo) {
                task.assignedTo.forEach(userId => userIds.add(userId));
              }
              if (task.assignedBy) {
                userIds.add(task.assignedBy);
              }
            });

            // Fetch all users
            const usersMap = new Map<string, User>();
            for (const userId of userIds) {
              if (!users.has(userId)) {
                try {
                  const userDoc = await getDoc(doc(db, 'users', userId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const user: User = {
                      id: userDoc.id,
                      email: userData.email || '',
                      name: userData.name || 'Unknown User',
                      role: userData.role || 'user',
                      createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
                    };
                    usersMap.set(userId, user);
                  }
                } catch (error) {
                  console.error('Error fetching user:', userId, error);
                }
              } else {
                usersMap.set(userId, users.get(userId)!);
              }
            }
            
            setUsers(usersMap);

            // Add user data to tasks
            tasksList = tasksList.map(task => ({
              ...task,
              assignedUsers: task.assignedTo?.map(userId => usersMap.get(userId)).filter(Boolean) as User[]
            }));

            tasksList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            tasksList = tasksList.slice(0, 10);
            
            setTasks(tasksList);
            setLoadingTasks(false);

            const completed = tasksList.filter(t => t.status === 'completed').length;
            const urgent = tasksList.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
            const pending = tasksList.filter(t => t.status !== 'completed').length;
            
            setStats({
              totalTasks: tasksList.length,
              completedTasks: completed,
              pendingTasks: pending,
              urgentTasks: urgent,
            });
          },
          (error) => {
            console.error('Error fetching tasks:', error);
            setLoadingTasks(false);
          }
        );
      } catch (error) {
        console.error('Error setting up tasks listener:', error);
        setLoadingTasks(false);
      }
    };

    const setupProjectsListener = async () => {
      try {
        let projectsQuery;
        
        try {
          projectsQuery = query(
            collection(db, 'projects'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          await getDocs(projectsQuery);
        } catch (error: any) {
          console.log('Projects compound query failed, using simple query:', error.message);
          projectsQuery = query(collection(db, 'projects'));
        }

        unsubscribeProjects = onSnapshot(
          projectsQuery,
          (snapshot) => {
            let projectsList = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || 'Unknown Project',
                description: data.description || '',
                managerId: data.managerId || '',
                status: data.status || 'active',
                startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
                endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
              } as Project;
            });

            projectsList = projectsList.filter(p => p.status === 'active');
            projectsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            projectsList = projectsList.slice(0, 5);
            
            setProjects(projectsList);
            setLoadingProjects(false);
          },
          (error) => {
            console.error('Error fetching projects:', error);
            setLoadingProjects(false);
          }
        );
      } catch (error) {
        console.error('Error setting up projects listener:', error);
        setLoadingProjects(false);
      }
    };

    setupTasksListener();
    setupProjectsListener();

    return () => {
      if (unsubscribeTasks) unsubscribeTasks();
      if (unsubscribeProjects) unsubscribeProjects();
    };
  }, [userData, isManager]);

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: ListTodo,
      gradient: 'from-blue-600 to-cyan-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      icon: CheckCircle2,
      gradient: 'from-green-600 to-emerald-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'In Progress',
      value: stats.pendingTasks,
      icon: Clock,
      gradient: 'from-amber-600 to-orange-600',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600'
    },
    {
      title: 'Urgent',
      value: stats.urgentTasks,
      icon: Zap,
      gradient: 'from-red-600 to-pink-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
  ];

  const getPriorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700 border-green-200',
      'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
      review: 'bg-purple-100 text-purple-700 border-purple-200',
      todo: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3" />;
      case 'in-progress': return <Activity className="h-3 w-3" />;
      case 'review': return <Clock className="h-3 w-3" />;
      default: return null;
    }
  };

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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {getGreeting()}, {userData?.name?.split(' ')[0]}!
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Here's your workspace overview for {format(new Date(), 'EEEE, MMMM d')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/calendar">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
                >
                  <Calendar className="h-5 w-5 text-gray-700" />
                </motion.button>
              </Link>
              {isManager && (
                <Link href="/analytics">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
                  >
                    <Activity className="h-5 w-5 text-gray-700" />
                  </motion.button>
                </Link>
              )}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tasks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl">
                    <ListTodo className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
                    <p className="text-xs text-gray-500">Your latest assignments</p>
                  </div>
                </div>
                <Link
                  href="/tasks"
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors group"
                >
                  View all 
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {loadingTasks ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center">
                  <ListTodo className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No tasks yet</p>
                  <p className="text-sm text-gray-400 mt-1">Tasks assigned to you will appear here</p>
                </div>
              ) : (
                <>
                  {tasks.slice(0, 3).map((task, index) => (
                    <motion.div 
                      key={task.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 hover:bg-gray-50 transition-all group cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full ${
                          task.priority === 'urgent' ? 'bg-red-500' :
                          task.priority === 'high' ? 'bg-orange-500' :
                          task.priority === 'medium' ? 'bg-blue-500' :
                          'bg-green-500'
                        } group-hover:scale-150 transition-transform`} />
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium border ${getPriorityBadge(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium border ${getStatusBadge(task.status)}`}>
                              {getStatusIcon(task.status)}
                              {task.status.replace('-', ' ')}
                            </span>
                            {(task.startDate || task.endDate) && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {task.endDate ? format(task.endDate, 'MMM dd') : format(task.startDate!, 'MMM dd')}
                              </span>
                            )}
                          </div>
                          {task.assignedUsers && task.assignedUsers.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <Users className="h-3 w-3 text-gray-400" />
                              <div className="flex items-center -space-x-2">
                                {task.assignedUsers.slice(0, 3).map((user, idx) => (
                                  <div
                                    key={user.id}
                                    className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white"
                                    title={user.name}
                                  >
                                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                ))}
                                {task.assignedUsers.length > 3 && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    +{task.assignedUsers.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </motion.div>
                  ))}
                  {tasks.length > 3 && (
                    <Link 
                      href="/tasks"
                      className="block p-4 text-center text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
                    >
                      Show {tasks.length - 3} more tasks →
                    </Link>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Active Projects */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                    <Briefcase className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Active Projects</h2>
                    <p className="text-xs text-gray-500">Currently in progress</p>
                  </div>
                </div>
                <Link
                  href="/projects"
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors group"
                >
                  View all
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {loadingProjects ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : projects.length === 0 ? (
                <div className="p-8 text-center">
                  <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No active projects</p>
                  <p className="text-sm text-gray-400 mt-1">Projects will appear here when created</p>
                </div>
              ) : (
                <>
                  {projects.slice(0, 3).map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        className="block p-4 hover:bg-gray-50 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg group-hover:scale-110 transition-transform">
                            <FolderOpen className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                              {project.name}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                              {project.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium bg-green-100 text-green-700 border border-green-200">
                                <Activity className="h-3 w-3" />
                                {project.status}
                              </span>
                              {project.endDate && (
                                <span className="text-xs text-gray-500 flex items-center">
                                  <Target className="h-3 w-3 mr-1" />
                                  {format(project.endDate, 'MMM dd, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                  {projects.length > 3 && (
                    <Link 
                      href="/projects"
                      className="block p-4 text-center text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
                    >
                      Show {projects.length - 3} more projects →
                    </Link>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions for Managers */}
        {isManager && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl p-8 text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-white/10 to-transparent rounded-full -ml-24 -mb-24" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-6 w-6 text-yellow-400" />
                <h3 className="text-2xl font-bold">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                  href="/projects/new"
                  className="group bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center hover:bg-white/20 transition-all hover:scale-105 border border-white/20"
                >
                  <div className="p-3 bg-white/20 rounded-xl inline-block mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="block font-semibold">Create Project</span>
                  <span className="text-xs text-gray-300 mt-1">Start a new project</span>
                </Link>
                <Link
                  href="/tasks"
                  className="group bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center hover:bg-white/20 transition-all hover:scale-105 border border-white/20"
                >
                  <div className="p-3 bg-white/20 rounded-xl inline-block mb-3 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <span className="block font-semibold">Assign Task</span>
                  <span className="text-xs text-gray-300 mt-1">Create new task</span>
                </Link>
                <Link
                  href="/users"
                  className="group bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center hover:bg-white/20 transition-all hover:scale-105 border border-white/20"
                >
                  <div className="p-3 bg-white/20 rounded-xl inline-block mb-3 group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6" />
                  </div>
                  <span className="block font-semibold">Manage Team</span>
                  <span className="text-xs text-gray-300 mt-1">View team members</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}