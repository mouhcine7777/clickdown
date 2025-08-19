// src/components/tasks/CreateTaskForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, query, getDocs, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Project, User, Task } from '@/lib/types';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  Calendar,
  Users,
  FolderOpen,
  AlertCircle,
  FileText,
  Flag,
  Loader2,
  Plus,
  ChevronDown,
  Check,
  FolderPlus
} from 'lucide-react';

interface CreateTaskFormProps {
  projectId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface QuickProjectForm {
  name: string;
  description: string;
  status: 'active' | 'on-hold';
}

export default function CreateTaskForm({ projectId, onClose, onSuccess }: CreateTaskFormProps) {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  
  console.log('Current user data:', userData);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: projectId || '',
    assignedTo: [] as string[],
    priority: 'medium' as Task['priority'],
    status: 'todo' as Task['status'],
    startDate: '',
    endDate: '',
  });

  const [quickProjectForm, setQuickProjectForm] = useState<QuickProjectForm>({
    name: '',
    description: '',
    status: 'active'
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

  const handleCreateProject = async () => {
    if (!userData || !quickProjectForm.name.trim()) return;
    
    setCreatingProject(true);
    
    try {
      const projectData = {
        name: quickProjectForm.name.trim(),
        description: quickProjectForm.description.trim(),
        managerId: userData.id,
        status: quickProjectForm.status,
        startDate: serverTimestamp(),
        endDate: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      
      // Add the new project to the local state
      const newProject: Project = {
        id: docRef.id,
        name: quickProjectForm.name.trim(),
        description: quickProjectForm.description.trim(),
        managerId: userData.id,
        status: quickProjectForm.status,
        startDate: new Date(),
        endDate: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setProjects(prev => [newProject, ...prev]);
      
      // Auto-select the new project
      setFormData(prev => ({ ...prev, projectId: docRef.id }));
      
      // Reset form and close
      setQuickProjectForm({ name: '', description: '', status: 'active' });
      setShowCreateProject(false);
      
      toast.success('Project created successfully!');
    } catch (error) {
      toast.error('Failed to create project');
      console.error(error);
    } finally {
      setCreatingProject(false);
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
          .filter(userId => userId !== userData.id)
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

  const projectStatusOptions = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
    { value: 'on-hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
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
                className="text-gray-900 w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task title"
                required
              />
            </div>
          </div>

          {/* Enhanced Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {/* Project Dropdown */}
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="text-gray-900 w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>

              {/* Quick Create Project Button */}
              <button
                type="button"
                onClick={() => setShowCreateProject(!showCreateProject)}
                className="w-full flex items-center justify-center px-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showCreateProject ? 'rotate-180' : ''}`} />
              </button>

              {/* Inline Project Creation Form */}
              <AnimatePresence>
                {showCreateProject && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center mb-3">
                      <FolderPlus className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-sm font-medium text-gray-900">Quick Project Creation</h3>
                    </div>

                    {/* Project Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={quickProjectForm.name}
                        onChange={(e) => setQuickProjectForm({ ...quickProjectForm, name: e.target.value })}
                        className="text-gray-900 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter project name"
                      />
                    </div>

                    {/* Project Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={quickProjectForm.description}
                        onChange={(e) => setQuickProjectForm({ ...quickProjectForm, description: e.target.value })}
                        rows={2}
                        className="text-gray-900 w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Brief project description..."
                      />
                    </div>

                    {/* Project Status */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Initial Status
                      </label>
                      <div className="flex gap-2">
                        {projectStatusOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setQuickProjectForm({ ...quickProjectForm, status: option.value as any })}
                            className={`
                              px-3 py-1 rounded-md text-xs font-medium transition-all
                              ${quickProjectForm.status === option.value
                                ? option.color + ' ring-1 ring-offset-1 ring-gray-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }
                            `}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateProject(false)}
                        className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={!quickProjectForm.name.trim() || creatingProject}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {creatingProject ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Create & Select
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="text-gray-900 w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="text-gray-900 w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="text-gray-900 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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