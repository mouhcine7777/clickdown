// src/app/(dashboard)/projects/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, Task, User } from '@/lib/types';
import CreateTaskForm from '../../tasks/CreateTaskForm';
import EditTaskModal from '../../tasks/EditTaskModal';
import EditProjectModal from '../EditProjectModal';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Edit,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  Users,
  MoreVertical,
  Trash2,
  Archive,
  Settings
} from 'lucide-react';

interface TaskWithUsers extends Task {
  assignedUsers?: User[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userData, isManager } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  
  const projectId = params.id as string;

  useEffect(() => {
    if (!projectId) {
      router.push('/projects');
      return;
    }

    // Fetch project details
    const fetchProject = async () => {
      try {
        console.log('Fetching project:', projectId);
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        
        if (projectDoc.exists()) {
          const data = projectDoc.data();
          console.log('Project data:', data);
          
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
          
          setProject(projectData);
        } else {
          toast.error('Project not found');
          router.push('/projects');
        }
      } catch (error) {
        console.error('Error loading project:', error);
        toast.error('Failed to load project');
        router.push('/projects');
      }
    };

    fetchProject();

    // Subscribe to tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('projectId', '==', projectId));

    const unsubscribe = onSnapshot(tasksQuery, async (snapshot) => {
      try {
        console.log('Tasks snapshot received:', snapshot.size, 'tasks');
        
        const tasksList = await Promise.all(
          snapshot.docs.map(async (taskDoc) => {
            const data = taskDoc.data();
            
            const taskData: Task = {
              id: taskDoc.id,
              title: data.title || 'Untitled Task',
              description: data.description || '',
              projectId: data.projectId || '',
              assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo].filter(Boolean),
              assignedBy: data.assignedBy || '',
              priority: data.priority || 'medium',
              status: data.status || 'todo',
              dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            };
            
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
            
            return {
              ...taskData,
              assignedUsers
            };
          })
        );

        console.log('Processed tasks:', tasksList);
        setTasks(tasksList);
        setLoading(false);
      } catch (error) {
        console.error('Error processing tasks:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error loading tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId, router]);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showMenu && !target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);



  const updateProjectStatus = async (newStatus: Project['status']) => {
    if (!project || !isManager) return;

    try {
      await updateDoc(doc(db, 'projects', project.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
      setProject({ ...project, status: newStatus });
      setEditingStatus(false);
      toast.success('Project status updated');
    } catch (error) {
      toast.error('Failed to update project status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
    
    return { total, completed, inProgress, todo, urgent };
  };

  const stats = getTaskStats();
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {editingStatus && isManager ? (
                <select
                  value={project.status}
                  onChange={(e) => updateProjectStatus(e.target.value as Project['status'])}
                  onBlur={() => setEditingStatus(false)}
                  className="px-3 py-1 text-sm font-medium rounded-full border focus:ring-2 focus:ring-blue-500"
                  autoFocus
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                </select>
              ) : (
                <button
                  onClick={() => isManager && setEditingStatus(true)}
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(project.status)} ${isManager ? 'cursor-pointer hover:opacity-80' : ''}`}
                  disabled={!isManager}
                >
                  {project.status}
                </button>
              )}
            </div>
            
            <p className="text-gray-600 mb-4">{project.description}</p>
            
            {project.endDate && (
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-1" />
                Due {format(project.endDate, 'MMM dd, yyyy')}
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            {isManager && (
              <>
                <div className="relative menu-container">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-600" />
                  </button>
                  
                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Project
                      </button>
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Project
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Task
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h2>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.todo}</div>
            <div className="text-sm text-gray-500">To Do</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-gray-500">Urgent</div>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Project Tasks</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {tasks.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No tasks yet. Add your first task to get started.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      {task.assignedUsers && task.assignedUsers.length > 0 && (
                        <div className="flex items-center text-gray-500">
                          <Users className="h-4 w-4 mr-1" />
                          <span className="text-xs">
                            {task.assignedUsers.length === 1 
                              ? task.assignedUsers[0].name
                              : `${task.assignedUsers.length} assignees`
                            }
                          </span>
                        </div>
                      )}
                      
                      {task.dueDate && (
                        <div className="flex items-center text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(task.dueDate, 'MMM dd')}
                        </div>
                      )}
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'review' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTask && (
          <CreateTaskForm
            projectId={projectId}
            onClose={() => setShowCreateTask(false)}
            onSuccess={() => setShowCreateTask(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditModal && project && (
          <EditProjectModal
            project={project}
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
              // Reload project data
              window.location.reload();
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {showEditTaskModal && selectedTask && (
          <EditTaskModal
            task={selectedTask}
            onClose={() => {
              setShowEditTaskModal(false);
              setSelectedTask(null);
            }}
            onSuccess={() => {
              setShowEditTaskModal(false);
              setSelectedTask(null);
              // Reload tasks
              window.location.reload();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}