// src/app/(dashboard)/projects/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, Task } from '@/lib/types';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  Search,
  Filter,
  Settings
} from 'lucide-react';

interface ProjectWithStats extends Project {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
}

export default function ProjectsPage() {
  const { userData, isManager } = useAuth();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!userData) return;

    // Query projects - simplified version
    const projectsRef = collection(db, 'projects');
    
    const unsubscribe = onSnapshot(projectsRef, async (snapshot) => {
      try {
        const projectsList = await Promise.all(
          snapshot.docs.map(async (projectDoc) => {
            const data = projectDoc.data();
            
            // Convert timestamps to dates
            const projectData: Project = {
              id: projectDoc.id,
              name: data.name || 'Unnamed Project',
              description: data.description || '',
              managerId: data.managerId || '',
              status: data.status || 'active',
              startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
              endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            };
            
            // Get task statistics for each project
            let totalTasks = 0;
            let completedTasks = 0;
            let activeTasks = 0;
            
            try {
              const tasksQuery = query(
                collection(db, 'tasks'),
                where('projectId', '==', projectDoc.id)
              );
              
              const tasksSnapshot = await getDocs(tasksQuery);
              const tasks = tasksSnapshot.docs.map(doc => doc.data() as Task);
              
              totalTasks = tasks.length;
              completedTasks = tasks.filter((t: Task) => t.status === 'completed').length;
              activeTasks = tasks.filter((t: Task) => t.status !== 'completed').length;
            } catch (error) {
              console.error('Error fetching tasks for project:', projectDoc.id, error);
            }

            return {
              ...projectData,
              totalTasks,
              completedTasks,
              activeTasks,
            };
          })
        );

        // Sort projects by creation date (newest first)
        projectsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setProjects(projectsList);
        setLoading(false);
      } catch (error) {
        console.error('Error processing projects:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error loading projects:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-2">
              Manage and track all your projects in one place
            </p>
          </div>
          {isManager && (
            <Link
              href="/projects/new"
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Project
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="text-gray-900 w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <Link href={`/projects/${project.id}`}>
                <div className="p-6">
                  {/* Project Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span>{getProgressPercentage(project.completedTasks, project.totalTasks)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercentage(project.completedTasks, project.totalTasks)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{project.completedTasks}</p>
                      <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{project.activeTasks}</p>
                      <p className="text-xs text-gray-500">Active</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{project.totalTasks}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {project.endDate ? (
                        <span>Due {format(project.endDate, 'MMM dd')}</span>
                      ) : (
                        <span>No due date</span>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{project.activeTasks} tasks</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}