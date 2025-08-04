// src/app/(dashboard)/tasks/EditTaskModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, collection, query, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, Project, User } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Loader2,
  Calendar,
  Users,
  FolderOpen,
  AlertCircle,
  FileText,
  Flag,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditTaskModal({ task, onClose, onSuccess }: EditTaskModalProps) {
  const { userData, isManager } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo].filter(Boolean), // Handle legacy single assignee
    priority: task.priority,
    status: task.status,
    startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
    endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
  });

  useEffect(() => {
    fetchProjectsAndUsers();
  }, []);

  const fetchProjectsAndUsers = async () => {
    setDataLoading(true);
    try {
      // Fetch projects
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);

      // Fetch users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || '',
          name: data.name || 'Unknown User',
          role: data.role || 'user',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as User;
      });
      
      setUsers(usersList);
    } catch (error) {
      toast.error('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData) return;
    
    setLoading(true);
    
    try {
      const taskData: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        updatedAt: new Date(),
      };

      // Only managers can change project and assignment
      if (isManager) {
        taskData.projectId = formData.projectId;
        taskData.assignedTo = formData.assignedTo;
      }

      await updateDoc(doc(db, 'tasks', task.id), taskData);
      
      toast.success('Task updated successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to update task');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isManager) return;
    
    setDeleting(true);
    
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
      
      toast.success('Task deleted successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to delete task');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId]
    }));
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
  ];

  const statusOptions = [
    { value: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-800' },
    { value: 'in-progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    { value: 'review', label: 'Review', color: 'bg-purple-100 text-purple-800' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task title"
                required
              />
            </div>
          </div>

          {/* Project Selection - Only for managers */}
          {isManager && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  required
                  disabled={dataLoading}
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Assign To - Only for managers */}
          {isManager && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({formData.assignedTo.length} selected)
                </span>
              </label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {dataLoading ? 'Loading users...' : 'No users available'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedTo.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={dataLoading}
                        />
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <span className="text-xs text-gray-400 capitalize">{user.role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {formData.assignedTo.length === 0 && (
                <p className="mt-1 text-xs text-red-600">Please select at least one user</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-2">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: option.value as Task['priority'] })}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${formData.priority === option.value
                        ? option.color + ' ring-2 ring-offset-2 ring-gray-400'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    <Flag className="h-4 w-4 inline mr-1" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Duration
              </label>
              <div className="space-y-3">
                {/* Start Date */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                {/* End Date */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={formData.startDate || ''}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: option.value as Task['status'] })}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${formData.status === option.value
                      ? option.color + ' ring-2 ring-offset-2 ring-gray-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Enter task description..."
            />
          </div>

          {/* Delete Task Section - Only for managers */}
          {isManager && (
            <div className="border-t pt-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-900 mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Danger Zone
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Deleting this task cannot be undone.
                </p>
                
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center text-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-red-900">
                      Are you sure you want to delete this task?
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Yes, Delete
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info message for regular users */}
          {!isManager && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                You can update the task title, description, priority, status, and due date. 
                Contact your manager to change the project or assignment.
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (isManager && formData.assignedTo.length === 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}