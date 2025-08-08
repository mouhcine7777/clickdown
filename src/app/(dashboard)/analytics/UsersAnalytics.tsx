// src/app/(dashboard)/analytics/UsersAnalytics.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Task, User, Project } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Award,
  Target,
  Activity,
  Briefcase,
  Clock,
  CheckCircle2,
  UserCheck,
  Crown,
  Shield,
  User as UserIcon,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
  AreaChart,
  Treemap,
  Sankey
} from 'recharts';

interface UsersAnalyticsProps {
  dateRange: string;
}

export default function UsersAnalytics({ dateRange }: UsersAnalyticsProps) {
  const { userData, isManager } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) return;

      try {
        // Fetch users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        })) as User[];
        setUsers(usersList);

        // Fetch tasks
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        const tasksList = tasksSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          } as Task;
        });

        // Filter by date range
        const now = new Date();
        let filteredTasks = tasksList;
        
        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
          const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          filteredTasks = tasksList.filter(t => t.createdAt >= cutoffDate);
        }

        setTasks(filteredTasks);

        // Fetch projects
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        const projectsList = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[];
        setProjects(projectsList);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData, dateRange]);

  // Role distribution
  const getRoleDistribution = () => {
    const roleCount = {
      admin: users.filter(u => u.role === 'admin').length,
      manager: users.filter(u => u.role === 'manager').length,
      user: users.filter(u => u.role === 'user').length,
    };

    return [
      { name: 'Admin', value: roleCount.admin, color: '#EF4444', icon: Crown },
      { name: 'Manager', value: roleCount.manager, color: '#F59E0B', icon: Shield },
      { name: 'User', value: roleCount.user, color: '#3B82F6', icon: UserIcon },
    ];
  };

  // User performance metrics
  const getUserPerformance = () => {
    return users.map(user => {
      const userTasks = tasks.filter(t => t.assignedTo?.includes(user.id));
      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = userTasks.filter(t => t.status === 'in-progress').length;
      const overdueTasks = userTasks.filter(t => {
        if (!t.endDate || t.status === 'completed') return false;
        return new Date(t.endDate) < new Date();
      }).length;
      
      // More realistic efficiency calculation
      const efficiency = userTasks.length > 0 
        ? Math.round((completedTasks / userTasks.length) * 100)
        : 0;

      // Realistic productivity score (0-100)
      // Only 100 if ALL tasks are completed and NONE are overdue
      let productivityScore = 0;
      if (userTasks.length > 0) {
        const completionRate = (completedTasks / userTasks.length) * 50; // 50% weight
        const activeWorkBonus = Math.min(20, (inProgressTasks / userTasks.length) * 30); // 20% max for active work
        const onTimeBonus = overdueTasks === 0 ? 30 : Math.max(0, 30 - (overdueTasks * 10)); // 30% for on-time delivery
        
        productivityScore = Math.round(completionRate + activeWorkBonus + onTimeBonus);
        productivityScore = Math.min(100, Math.max(0, productivityScore)); // Ensure 0-100 range
      }

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        totalTasks: userTasks.length,
        completed: completedTasks,
        inProgress: inProgressTasks,
        overdue: overdueTasks,
        efficiency,
        productivityScore
      };
    }).filter(u => {
      // Apply filters
      if (selectedRole && u.role !== selectedRole) return false;
      if (selectedUser && u.id !== selectedUser) return false;
      return true;
    }).sort((a, b) => b.productivityScore - a.productivityScore);
  };

  // Workload distribution
  const getWorkloadDistribution = () => {
    const userPerf = getUserPerformance();
    return userPerf.map(user => ({
      name: user.name.length > 15 ? user.name.substring(0, 15) + '...' : user.name,
      tasks: user.totalTasks,
      completed: user.completed,
      inProgress: user.inProgress,
      todo: user.totalTasks - user.completed - user.inProgress
    }));
  };

  // Team collaboration matrix
  const getCollaborationMatrix = () => {
    const collaborations: { [key: string]: number } = {};
    
    tasks.forEach(task => {
      if (task.assignedTo && task.assignedTo.length > 1) {
        task.assignedTo.forEach((userId1, i) => {
          task.assignedTo.slice(i + 1).forEach(userId2 => {
            const key = [userId1, userId2].sort().join('-');
            collaborations[key] = (collaborations[key] || 0) + 1;
          });
        });
      }
    });

    return Object.entries(collaborations)
      .map(([key, count]) => {
        const [user1Id, user2Id] = key.split('-');
        const user1 = users.find(u => u.id === user1Id);
        const user2 = users.find(u => u.id === user2Id);
        return {
          user1: user1?.name || 'Unknown',
          user2: user2?.name || 'Unknown',
          collaborations: count
        };
      })
      .sort((a, b) => b.collaborations - a.collaborations)
      .slice(0, 10);
  };

  // Get task activity by day of week (REAL DATA)
  const getWeeklyActivity = () => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activityByDay: { [key: string]: { [role: string]: number } } = {};
    
    // Initialize days
    daysOfWeek.forEach(day => {
      activityByDay[day] = { admin: 0, manager: 0, user: 0 };
    });
    
    // Count actual task activities by day
    tasks.forEach(task => {
      const taskDate = task.createdAt;
      const dayName = daysOfWeek[taskDate.getDay()];
      
      // Find which role created/is assigned this task
      task.assignedTo?.forEach(userId => {
        const assignedUser = users.find(u => u.id === userId);
        if (assignedUser) {
          activityByDay[dayName][assignedUser.role]++;
        }
      });
    });
    
    // Convert to array format for chart
    return daysOfWeek.map(day => ({
      day,
      admin: activityByDay[day].admin,
      manager: activityByDay[day].manager,
      user: activityByDay[day].user,
      total: activityByDay[day].admin + activityByDay[day].manager + activityByDay[day].user
    }));
  };

  // User skills radar
  const getUserSkillsRadar = () => {
    const selectedUserData = selectedUser 
      ? getUserPerformance().find(u => u.id === selectedUser)
      : null;

    if (!selectedUserData) {
      // Show average team skills
      const avgData = getUserPerformance();
      const totalUsers = avgData.length || 1;
      
      return [
        {
          skill: 'Efficiency',
          value: Math.round(avgData.reduce((sum, u) => sum + u.efficiency, 0) / totalUsers),
          fullMark: 100
        },
        {
          skill: 'Productivity',
          value: Math.round(avgData.reduce((sum, u) => sum + u.productivityScore, 0) / totalUsers),
          fullMark: 100
        },
        {
          skill: 'Task Volume',
          value: Math.min(100, Math.round(avgData.reduce((sum, u) => sum + u.totalTasks, 0) / totalUsers * 5)),
          fullMark: 100
        },
        {
          skill: 'Completion Rate',
          value: Math.round(avgData.reduce((sum, u) => 
            sum + (u.totalTasks > 0 ? (u.completed / u.totalTasks) * 100 : 0), 0
          ) / totalUsers),
          fullMark: 100
        },
        {
          skill: 'On-Time Delivery',
          value: Math.round(avgData.reduce((sum, u) => 
            sum + (u.totalTasks > 0 ? ((u.totalTasks - u.overdue) / u.totalTasks) * 100 : 100), 0
          ) / totalUsers),
          fullMark: 100
        }
      ];
    }

    return [
      { skill: 'Efficiency', value: selectedUserData.efficiency, fullMark: 100 },
      { skill: 'Productivity', value: selectedUserData.productivityScore, fullMark: 100 },
      { skill: 'Task Volume', value: Math.min(100, selectedUserData.totalTasks * 5), fullMark: 100 },
      { skill: 'Completion Rate', value: selectedUserData.totalTasks > 0 ? Math.round((selectedUserData.completed / selectedUserData.totalTasks) * 100) : 0, fullMark: 100 },
      { skill: 'On-Time Delivery', value: selectedUserData.totalTasks > 0 ? Math.round(((selectedUserData.totalTasks - selectedUserData.overdue) / selectedUserData.totalTasks) * 100) : 100, fullMark: 100 }
    ];
  };

  const roleDistribution = getRoleDistribution();
  const userPerformance = getUserPerformance();
  const workloadData = getWorkloadDistribution();
  const collaborationData = getCollaborationMatrix();
  const weeklyActivity = getWeeklyActivity();
  const skillsData = getUserSkillsRadar();

  // Top performers - only show users with tasks
  const topPerformers = userPerformance.filter(u => u.totalTasks > 0).slice(0, 3);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs mt-1" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Role Filter */}
            <select
              value={selectedRole || ''}
              onChange={(e) => setSelectedRole(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
            </select>

            {/* User Selector */}
            <select
              value={selectedUser || ''}
              onChange={(e) => setSelectedUser(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Team Average</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            {(selectedRole || selectedUser) && (
              <button
                onClick={() => {
                  setSelectedRole(null);
                  setSelectedUser(null);
                }}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topPerformers.map((performer, index) => {
            const bgGradient = index === 0 
              ? 'from-yellow-400 to-orange-400' 
              : index === 1 
              ? 'from-gray-300 to-gray-400'
              : 'from-orange-300 to-orange-400';
            
            return (
              <motion.div
                key={performer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm relative overflow-hidden cursor-pointer"
                onClick={() => setSelectedUser(performer.id)}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${bgGradient} opacity-10 rounded-full -mr-16 -mt-16`} />
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Award className={`h-5 w-5 ${
                        index === 0 ? 'text-yellow-500' : 
                        index === 1 ? 'text-gray-400' : 
                        'text-orange-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-500">#{index + 1} Performer</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{performer.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{performer.role}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {performer.productivityScore}
                    </div>
                    <span className="text-xs text-gray-500">/ 100</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Efficiency</span>
                    <span className="font-semibold">{performer.efficiency}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-1.5 rounded-full"
                      style={{ width: `${performer.efficiency}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mt-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{performer.totalTasks}</p>
                    <span className="text-gray-500">Total</span>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-green-600">{performer.completed}</p>
                    <span className="text-gray-500">Done</span>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-red-600">{performer.overdue}</p>
                    <span className="text-gray-500">Late</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No performance data available</p>
          <p className="text-sm text-gray-400 mt-1">Assign tasks to users to see performance metrics</p>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Role Distribution</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={roleDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {roleDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-4">
            {roleDistribution.map((role) => {
              const Icon = role.icon;
              return (
                <div key={role.name} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: role.color }} />
                  <span className="text-sm text-gray-600">{role.name}: {role.value}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Workload Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Workload Distribution</h3>
            <Briefcase className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" stackId="a" fill="#10B981" />
              <Bar dataKey="inProgress" stackId="a" fill="#3B82F6" />
              <Bar dataKey="todo" stackId="a" fill="#94A3B8" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* User Skills Radar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedUser 
                ? `${users.find(u => u.id === selectedUser)?.name}'s Skills`
                : 'Team Average Skills'
              }
            </h3>
            <Target className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={skillsData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="skill" stroke="#6b7280" fontSize={11} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" fontSize={10} />
              <Radar 
                name="Skills" 
                dataKey="value" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Weekly Activity - Real Data */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Task Distribution by Day</h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          {weeklyActivity.some(day => day.total > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="admin" stackId="a" fill="#EF4444" name="Admin" />
                <Bar dataKey="manager" stackId="a" fill="#F59E0B" name="Manager" />
                <Bar dataKey="user" stackId="a" fill="#3B82F6" name="User" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No task activity data available</p>
                <p className="text-sm text-gray-400 mt-1">Tasks will appear here once created</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Collaboration Matrix */}
      {collaborationData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Collaboration Matrix</h3>
            <UserCheck className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {collaborationData.map((collab, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {collab.user1.charAt(0)}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {collab.user2.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900">
                      {collab.user1} & {collab.user2}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-600">
                  {collab.collaborations} tasks
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}