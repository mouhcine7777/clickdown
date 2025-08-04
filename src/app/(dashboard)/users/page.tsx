// src/app/(dashboard)/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Task, Project } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users as UsersIcon,
  Search,
  Filter,
  MoreVertical,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Award,
  TrendingUp,
  Target,
  X,
  Loader2,
  UserPlus,
  Download,
  Upload,
  BarChart3
} from 'lucide-react';

interface UserWithStats extends User {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  projectsInvolved: number;
}

interface UserModalData {
  user: UserWithStats;
  tasks: Task[];
  projects: Project[];
}

export default function UsersPage() {
  const { userData, isManager, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'tasks' | 'completion'>('name');
  const [selectedUser, setSelectedUser] = useState<UserModalData | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionUser, setActionUser] = useState<UserWithStats | null>(null);
  const [actionType, setActionType] = useState<'delete' | 'role' | null>(null);

  useEffect(() => {
    if (!isManager) {
      toast.error('Access denied. Only managers can view this page.');
      return;
    }
    loadUsers();
  }, [isManager]);

  const loadUsers = async () => {
    try {
      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList: UserWithStats[] = [];

      // Fetch all tasks and projects for statistics
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      
      const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      const allProjects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Calculate user statistics
        const userTasks = allTasks.filter(task => 
          Array.isArray(task.assignedTo) ? task.assignedTo.includes(userId) : task.assignedTo === userId
        );

        const completedTasks = userTasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = userTasks.filter(t => t.status === 'in-progress').length;
        const overdueTasks = userTasks.filter(t => 
          t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()
        ).length;

        // Count projects user is involved in
        const projectsInvolved = new Set(userTasks.map(t => t.projectId).filter(Boolean)).size;

        usersList.push({
          id: userDoc.id,
          email: userData.email || '',
          name: userData.name || 'Unknown User',
          role: userData.role || 'user',
          createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
          totalTasks: userTasks.length,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          projectsInvolved
        });
      }

      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
      setLoading(false);
    }
  };

  const handleUserClick = async (user: UserWithStats) => {
    try {
      // Fetch user's tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', 'array-contains', user.id)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

      // Fetch projects user is involved in
      const projectIds = [...new Set(tasks.map(t => t.projectId).filter(Boolean))];
      const projects: Project[] = [];
      
      for (const projectId of projectIds) {
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        if (projectDoc.exists()) {
          projects.push({ id: projectDoc.id, ...projectDoc.data() } as Project);
        }
      }

      setSelectedUser({ user, tasks, projects });
    } catch (error) {
      console.error('Error loading user details:', error);
      toast.error('Failed to load user details');
    }
  };

  const handleRoleChange = async (user: UserWithStats, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        role: newRole,
        updatedAt: new Date()
      });
      
      toast.success(`${user.name} is now a ${newRole}`);
      setActionUser(null);
      setActionType(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (user: UserWithStats) => {
    if (user.id === userData?.id) {
      toast.error("You can't delete your own account");
      return;
    }

    try {
      // First reassign or delete user's tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', 'array-contains', user.id)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      // Update tasks to remove this user from assignedTo
      const updatePromises = tasksSnapshot.docs.map(async (taskDoc) => {
        const taskData = taskDoc.data();
        const assignedTo = Array.isArray(taskData.assignedTo) 
          ? taskData.assignedTo.filter(id => id !== user.id)
          : [];
        
        if (assignedTo.length > 0) {
          return updateDoc(taskDoc.ref, { assignedTo });
        } else {
          // If no one else is assigned, delete the task
          return deleteDoc(taskDoc.ref);
        }
      });

      await Promise.all(updatePromises);

      // Delete the user
      await deleteDoc(doc(db, 'users', user.id));
      
      toast.success(`${user.name} has been removed from the system`);
      setActionUser(null);
      setActionType(null);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const exportUsersData = () => {
    const csvContent = [
      ['Name', 'Email', 'Role', 'Total Tasks', 'Completed Tasks', 'In Progress', 'Overdue', 'Projects', 'Joined Date'],
      ...filteredUsers.map(user => [
        user.name,
        user.email,
        user.role,
        user.totalTasks,
        user.completedTasks,
        user.inProgressTasks,
        user.overdueTasks,
        user.projectsInvolved,
        format(user.createdAt, 'yyyy-MM-dd')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'role': return a.role.localeCompare(b.role);
        case 'tasks': return b.totalTasks - a.totalTasks;
        case 'completion': 
          const aRate = a.totalTasks > 0 ? a.completedTasks / a.totalTasks : 0;
          const bRate = b.totalTasks > 0 ? b.completedTasks / b.totalTasks : 0;
          return bRate - aRate;
        default: return 0;
      }
    });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCompletionRate = (user: UserWithStats) => {
    if (user.totalTasks === 0) return 0;
    return Math.round((user.completedTasks / user.totalTasks) * 100);
  };

  if (!isManager) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <UserX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Access denied. Only managers can view this page.</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
            <p className="text-gray-600 mt-2">
              Manage your team members and their permissions
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportUsersData}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Report
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Invite User
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{users.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <UsersIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Managers</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.filter(u => u.role === 'manager' || u.role === 'admin').length}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Tasks</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.reduce((sum, user) => sum + user.inProgressTasks, 0)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Completion</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {users.length > 0 
                  ? Math.round(users.reduce((sum, user) => sum + getCompletionRate(user), 0) / users.length)
                  : 0}%
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">Team Member</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Sort by Name</option>
              <option value="role">Sort by Role</option>
              <option value="tasks">Sort by Tasks</option>
              <option value="completion">Sort by Completion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer"
            onClick={() => handleUserClick(user)}
          >
            <div className="p-6">
              {/* User Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                
                {user.id !== userData?.id && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionUser(user);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-600" />
                    </button>
                    
                    {actionUser?.id === user.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionType('role');
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Change Role
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionType('delete');
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove User
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Role Badge */}
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Task Completion</span>
                  <span className="font-medium">{getCompletionRate(user)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getCompletionRate(user)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-gray-900">{user.totalTasks}</p>
                    <p className="text-xs text-gray-600">Total Tasks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-green-600">{user.completedTasks}</p>
                    <p className="text-xs text-gray-600">Completed</p>
                  </div>
                </div>

                {user.overdueTasks > 0 && (
                  <div className="flex items-center justify-center text-red-600 text-sm mt-2">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {user.overdueTasks} overdue tasks
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  Joined {format(user.createdAt, 'MMM d, yyyy')}
                </div>
                <div className="flex items-center">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  {user.projectsInvolved} projects
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-2xl font-bold">
                      {selectedUser.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <h2 className="text-2xl font-bold">{selectedUser.user.name}</h2>
                      <p className="text-blue-100">{selectedUser.user.email}</p>
                      <span className="inline-block mt-1 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-medium">
                        {selectedUser.user.role.charAt(0).toUpperCase() + selectedUser.user.role.slice(1)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Performance Overview */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-gray-900">{selectedUser.user.totalTasks}</p>
                      <p className="text-sm text-gray-600">Total Tasks</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{selectedUser.user.completedTasks}</p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{selectedUser.user.inProgressTasks}</p>
                      <p className="text-sm text-gray-600">In Progress</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-red-600">{selectedUser.user.overdueTasks}</p>
                      <p className="text-sm text-gray-600">Overdue</p>
                    </div>
                  </div>
                </div>

                {/* Projects */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Projects ({selectedUser.projects.length})
                  </h3>
                  {selectedUser.projects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedUser.projects.map(project => (
                        <div key={project.id} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900">{project.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                            project.status === 'active' ? 'bg-green-100 text-green-800' :
                            project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No projects assigned</p>
                  )}
                </div>

                {/* Recent Tasks */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Tasks ({selectedUser.tasks.length})
                  </h3>
                  {selectedUser.tasks.length > 0 ? (
                    <div className="space-y-3">
                      {selectedUser.tasks.slice(0, 5).map(task => (
                        <div key={task.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    task.priority === 'low' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.priority}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.status}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              {task.dueDate && (
                                <p className={`text-xs ${
                                  task.status !== 'completed' && new Date(task.dueDate) < new Date() 
                                    ? 'text-red-600' 
                                    : 'text-gray-600'
                                }`}>
                                  {format(new Date(task.dueDate), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedUser.tasks.length > 5 && (
                        <p className="text-sm text-gray-500 text-center mt-4">
                          Showing 5 of {selectedUser.tasks.length} tasks
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No tasks assigned</p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Change Modal */}
      <AnimatePresence>
        {actionUser && actionType === 'role' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setActionUser(null);
              setActionType(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Change {actionUser.name}'s Role
                </h3>
                <p className="text-gray-600 mb-6">
                  Select the new role for this team member
                </p>

                <div className="space-y-3 mb-6">
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={actionUser.role === 'user'}
                      onChange={() => handleRoleChange(actionUser, 'user')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Team Member</p>
                      <p className="text-sm text-gray-500">
                        Can view and complete assigned tasks
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="manager"
                      checked={actionUser.role === 'manager'}
                      onChange={() => handleRoleChange(actionUser, 'manager')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Manager</p>
                      <p className="text-sm text-gray-500">
                        Can manage tasks and team members
                      </p>
                    </div>
                  </label>

                  {isAdmin && (
                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={actionUser.role === 'admin'}
                        onChange={() => handleRoleChange(actionUser, 'admin')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Administrator</p>
                        <p className="text-sm text-gray-500">
                          Full access to all system features
                        </p>
                      </div>
                    </label>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setActionUser(null);
                      setActionType(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {actionUser && actionType === 'delete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setActionUser(null);
              setActionType(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Remove {actionUser.name}?
                    </h3>
                    <p className="text-gray-600">
                      This will permanently remove {actionUser.name} from the system and reassign or delete their tasks. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setActionUser(null);
                      setActionType(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(actionUser)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Remove User
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite User Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invite New User
                  </h3>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <form className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      defaultValue="user"
                    >
                      <option value="user">Team Member</option>
                      <option value="manager">Manager</option>
                      {isAdmin && <option value="admin">Administrator</option>}
                    </select>
                  </div>

                  <div className="pt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Send Invitation
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}