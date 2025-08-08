// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project } from '@/lib/types';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  FolderOpen,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const { userData, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
  });

  useEffect(() => {
    if (!userData) return;

    let unsubscribeTasks: (() => void) | null = null;
    let unsubscribeProjects: (() => void) | null = null;

    const setupTasksListener = async () => {
      try {
        // For tasks, try compound query first, fallback to simple query if index missing
        let tasksQuery;
        
        if (isManager) {
          // Manager sees all tasks - simple query, no compound index needed
          tasksQuery = query(
            collection(db, 'tasks'),
            limit(10)
          );
        } else {
          // Regular user - try compound query first
          try {
            tasksQuery = query(
              collection(db, 'tasks'),
              where('assignedTo', 'array-contains', userData.id),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            
            // Test the query to see if index exists
            await getDocs(tasksQuery);
          } catch (error: any) {
            console.log('Compound query failed, using simple query:', error.message);
            // Fallback to simple query without orderBy
            tasksQuery = query(
              collection(db, 'tasks'),
              where('assignedTo', 'array-contains', userData.id)
            );
          }
        }

        unsubscribeTasks = onSnapshot(
          tasksQuery, 
          (snapshot) => {
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
              } as Task;
            });

            // Sort manually if orderBy wasn't in the query
            tasksList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            // Limit to 10 if we used the fallback query
            tasksList = tasksList.slice(0, 10);
            
            setTasks(tasksList);
            setLoadingTasks(false);

            // Calculate stats
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
        // For projects, try compound query first, fallback if needed
        let projectsQuery;
        
        try {
          projectsQuery = query(
            collection(db, 'projects'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          
          // Test the query
          await getDocs(projectsQuery);
        } catch (error: any) {
          console.log('Projects compound query failed, using simple query:', error.message);
          // Fallback: get all projects and filter/sort manually
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

            // Filter active projects manually if the query was simplified
            projectsList = projectsList.filter(p => p.status === 'active');
            
            // Sort by createdAt manually
            projectsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            // Limit to 5
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

    // Set up both listeners
    setupTasksListener();
    setupProjectsListener();

    // Cleanup function
    return () => {
      if (unsubscribeTasks) unsubscribeTasks();
      if (unsubscribeProjects) unsubscribeProjects();
    };
  }, [userData, isManager]);

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: BarChart3,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      icon: CheckCircle2,
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
    },
    {
      title: 'Pending',
      value: stats.pendingTasks,
      icon: Clock,
      color: 'bg-yellow-500',
      lightColor: 'bg-yellow-100',
    },
    {
      title: 'Urgent',
      value: stats.urgentTasks,
      icon: AlertCircle,
      color: 'bg-red-500',
      lightColor: 'bg-red-100',
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'review': return 'text-purple-600 bg-purple-100';
      case 'todo': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {userData?.name}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your tasks and projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.lightColor} p-3 rounded-lg`}>
                <stat.icon className={`h-6 w-6 ${stat.color} text-white`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
              <Link
                href="/tasks"
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {loadingTasks ? (
              <div className="p-6 text-center">
                <div className="inline-flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                  <span className="text-gray-500">Loading tasks...</span>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No tasks found</p>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(task.status)}`}>
                          {task.status.replace('-', ' ')}
                        </span>
                        {(task.startDate || task.endDate) && (
                          <span className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {task.endDate ? format(task.endDate, 'MMM dd') : format(task.startDate!, 'MMM dd')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Active Projects */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Active Projects</h2>
              <Link
                href="/projects"
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {loadingProjects ? (
              <div className="p-6 text-center">
                <div className="inline-flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                  <span className="text-gray-500">Loading projects...</span>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No active projects</p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{project.name}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500 flex items-center">
                          <FolderOpen className="h-3 w-3 mr-1" />
                          {project.status}
                        </span>
                        {project.endDate && (
                          <span className="text-xs text-gray-500">
                            Due {format(project.endDate, 'MMM dd, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions for Managers */}
      {isManager && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white"
        >
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/projects/new"
              className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center hover:bg-white/30 transition-colors"
            >
              <FolderOpen className="h-8 w-8 mx-auto mb-2" />
              <span className="font-medium">Create Project</span>
            </Link>
            <Link
              href="/tasks/new"
              className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center hover:bg-white/30 transition-colors"
            >
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
              <span className="font-medium">Assign Task</span>
            </Link>
            <Link
              href="/users"
              className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center hover:bg-white/30 transition-colors"
            >
              <Users className="h-8 w-8 mx-auto mb-2" />
              <span className="font-medium">Manage Team</span>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}