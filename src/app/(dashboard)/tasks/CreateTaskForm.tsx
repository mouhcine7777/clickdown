// src/components/tasks/CreateTaskForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, query, getDocs, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Project, User, Task } from '@/lib/types';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Calendar,
  Users,
  FolderOpen,
  AlertCircle,
  FileText,
  Flag,
  Loader2
} from 'lucide-react';

interface CreateTaskFormProps {
  projectId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateTaskForm({ projectId, onClose, onSuccess }: CreateTaskFormProps) {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  console.log('Current user data:', userData);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: projectId || '',
    assignedTo: [] as string[], // Changed to array
    priority: 'medium' as Task['priority'],
    status: 'todo' as Task['status'],
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (mounted) {
        await fetchProjectsAndUsers();
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const fetchProjectsAndUsers = async () => {
    setDataLoading(true);
    try {
      // Fetch projects
      console.log('Fetching projects...');
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);
      console.log('Loaded projects:', projectsList);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast.error(`Failed to load projects: ${error.message || 'Unknown error'}`);
    }

    try {
      // Fetch users
      console.log('Fetching users...');
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      console.log('Users snapshot size:', usersSnapshot.size);
      
      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('User data:', doc.id, data);
        
        return {
          id: doc.id,
          email: data.email || '',
          name: data.name || 'Unknown User',
          role: data.role || 'user',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as User;
      });
      
      setUsers(usersList);
      console.log('Processed users list:', usersList);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error(`Failed to load users: ${error.message || 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData) return;
    
    setLoading(true);
    
    try {
      const taskData = {
        ...formData,
        assignedBy: userData.id,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'tasks'), taskData);
      
      // Create notifications for all assigned users
      if (formData.assignedTo.length > 0) {
        const project = projects.find(p => p.id === formData.projectId);
        
        const notificationPromises = formData.assignedTo
          .filter(userId => userId !== userData.id) // Don't notify the creator
          .map(userId => {
            const assignedUser = users.find(u => u.id === userId);
            return addDoc(collection(db, 'notifications'), {
              userId: userId,
              type: 'task-assigned',
              title: 'New Task Assigned',
              message: `${userData.name} assigned you a new task: "${formData.title}" in project "${project?.name}"`,
              read: false,
              createdAt: serverTimestamp(),
            });
          });
        
        await Promise.all(notificationPromises);
      }

      toast.success('Task created successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to create task');
      console.error(error);
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
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

          {/* Project Selection */}
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

          {/* Assign To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign To <span className="text-red-500">*</span>
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
                      min={new Date().toISOString().split('T')[0]}
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
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
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

          {/* Actions */}
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
              disabled={loading || formData.assignedTo.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}