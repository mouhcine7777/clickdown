// src/app/(dashboard)/tasks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project, User } from '@/lib/types';
import CreateTaskForm from './CreateTaskForm';
import EditTaskModal from './EditTaskModal';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
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
  ArrowDown
} from 'lucide-react';

export default function TasksPage() {
  const { userData, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadTasks = async () => {
      if (!userData) {
        console.log('No user data');
        return;
      }

      try {
        console.log('Loading tasks...');
        let q;
        
        if (isManager) {
          // Managers see all tasks
          q = query(collection(db, 'tasks'));
        } else {
          // Users see tasks where they are in the assignedTo array
          q = query(
            collection(db, 'tasks'),
            where('assignedTo', 'array-contains', userData.id)
          );
        }

        const querySnapshot = await getDocs(q);
        console.log('Found', querySnapshot.size, 'tasks');
        
        const tasksList: Task[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          tasksList.push({
            id: doc.id,
            title: data.title || 'Untitled',
            description: data.description || '',
            projectId: data.projectId || '',
            assignedTo: Array.isArray(data.assignedTo) ? data.assignedTo : [data.assignedTo].filter(Boolean), // Handle legacy data
            assignedBy: data.assignedBy || '',
            priority: data.priority || 'medium',
            status: data.status || 'todo',
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          });
        });

        console.log('Loaded tasks:', tasksList);
        setTasks(tasksList);
      } catch (error) {
        console.error('Error loading tasks:', error);
        toast.error('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [userData, isManager]);

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      
      // Update local state
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      
      toast.success('Task status updated');
    } catch (error) {
      toast.error('Failed to update task status');
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Circle className="h-4 w-4" />;
      case 'in-progress': return <Clock className="h-4 w-4" />;
      case 'review': return <AlertCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

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

  const statusOptions = ['todo', 'in-progress', 'review', 'completed'];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="text-gray-600 mt-2">
              {isManager ? 'Manage all tasks' : 'Your assigned tasks'}
            </p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {task.title}
                  </h3>
                  
                  {task.description && (
                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {/* Due Date */}
                    {task.dueDate && (
                      <div className="flex items-center text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(task.dueDate, 'MMM dd, yyyy')}
                      </div>
                    )}

                    {/* Assigned Users Count */}
                    {task.assignedTo.length > 0 && (
                      <div className="flex items-center text-gray-500">
                        <UserIcon className="h-4 w-4 mr-1" />
                        <span className="text-xs">
                          {task.assignedTo.length} {task.assignedTo.length === 1 ? 'assignee' : 'assignees'}
                        </span>
                      </div>
                    )}

                    {/* Priority */}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      <Flag className="h-3 w-3 inline mr-1" />
                      {task.priority}
                    </span>

                    {/* Status */}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(task.status)}`}>
                      {getStatusIcon(task.status)}
                      <span className="ml-1">{task.status.replace('-', ' ')}</span>
                    </span>
                  </div>
                </div>

                {/* Edit button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditTask(task)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit task"
                  >
                    <Edit className="h-4 w-4 text-gray-600" />
                  </button>
                  
                  {/* Status Change Dropdown */}
                  <div className="relative group">
                    <select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value as Task['status'])}
                    className="appearance-none bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Task Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateTaskForm
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              // Reload tasks
              window.location.reload();
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {showEditModal && selectedTask && (
          <EditTaskModal
            task={selectedTask}
            onClose={() => {
              setShowEditModal(false);
              setSelectedTask(null);
            }}
            onSuccess={() => {
              setShowEditModal(false);
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