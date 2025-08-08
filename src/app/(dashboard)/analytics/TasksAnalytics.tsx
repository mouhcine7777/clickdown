// src/app/(dashboard)/analytics/TasksAnalytics.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Task, User } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Activity,
  Target,
  Zap,
  ArrowRight,
  Filter as FilterIcon,
  ChevronDown,
  Briefcase
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
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
  ComposedChart,
  Scatter,
  ScatterChart,
  ZAxis
} from 'recharts';

interface TasksAnalyticsProps {
  dateRange: string;
}

export default function TasksAnalytics({ dateRange }: TasksAnalyticsProps) {
  const { userData, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) return;

      try {
        // Fetch tasks
        const tasksQuery = isManager
          ? query(collection(db, 'tasks'))
          : query(
              collection(db, 'tasks'),
              where('assignedTo', 'array-contains', userData.id)
            );

        const snapshot = await getDocs(tasksQuery);
        const tasksList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            startDate: data.startDate?.toDate ? data.startDate.toDate() : null,
            endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
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

        // Fetch users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setUsers(usersList);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData, isManager, dateRange]);

  // Interactive filters
  const filteredTasks = tasks.filter(task => {
    if (selectedPriority && task.priority !== selectedPriority) return false;
    if (selectedStatus && task.status !== selectedStatus) return false;
    return true;
  });

  // Prepare creative chart data
  const statusDistribution = [
    { 
      name: 'To Do', 
      value: filteredTasks.filter(t => t.status === 'todo').length,
      percentage: 0,
      color: '#94A3B8',
      icon: Clock
    },
    { 
      name: 'In Progress', 
      value: filteredTasks.filter(t => t.status === 'in-progress').length,
      percentage: 0,
      color: '#3B82F6',
      icon: Activity
    },
    { 
      name: 'Review', 
      value: filteredTasks.filter(t => t.status === 'review').length,
      percentage: 0,
      color: '#8B5CF6',
      icon: AlertCircle
    },
    { 
      name: 'Completed', 
      value: filteredTasks.filter(t => t.status === 'completed').length,
      percentage: 0,
      color: '#10B981',
      icon: CheckCircle2
    },
  ].map(item => ({
    ...item,
    percentage: filteredTasks.length > 0 ? Math.round((item.value / filteredTasks.length) * 100) : 0
  }));

  // Task velocity over time (more granular)
  const getTaskVelocity = () => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const created = tasks.filter(t => 
        t.createdAt >= dayStart && t.createdAt <= dayEnd
      ).length;
      
      const completed = tasks.filter(t => 
        t.status === 'completed' && 
        t.updatedAt >= dayStart && 
        t.updatedAt <= dayEnd
      ).length;
      
      data.push({
        date: dayStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        created,
        completed,
        velocity: completed - created,
      });
    }
    
    return data;
  };

  // User performance bubble chart
  const getUserPerformance = () => {
    return users.map(user => {
      const userTasks = filteredTasks.filter(t => t.assignedTo?.includes(user.id));
      const completed = userTasks.filter(t => t.status === 'completed').length;
      const urgent = userTasks.filter(t => t.priority === 'urgent').length;
      
      return {
        name: user.name,
        tasks: userTasks.length,
        completed,
        efficiency: userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0,
        urgent,
        z: userTasks.length * 10, // Bubble size
      };
    }).filter(u => u.tasks > 0);
  };

  // Priority heatmap data
  const getPriorityHeatmap = () => {
    const statuses = ['todo', 'in-progress', 'review', 'completed'];
    const priorities = ['low', 'medium', 'high', 'urgent'];
    
    return priorities.map(priority => {
      const row: any = { priority: priority.charAt(0).toUpperCase() + priority.slice(1) };
      statuses.forEach(status => {
        row[status] = filteredTasks.filter(t => t.priority === priority && t.status === status).length;
      });
      return row;
    });
  };

  // Task completion funnel
  const getCompletionFunnel = () => {
    const total = filteredTasks.length;
    const inProgress = filteredTasks.filter(t => t.status !== 'todo').length;
    const inReview = filteredTasks.filter(t => t.status === 'review' || t.status === 'completed').length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    
    return [
      { name: 'Created', value: total, fill: '#94A3B8' },
      { name: 'Started', value: inProgress, fill: '#3B82F6' },
      { name: 'Reviewed', value: inReview, fill: '#8B5CF6' },
      { name: 'Completed', value: completed, fill: '#10B981' },
    ];
  };

  const taskVelocity = getTaskVelocity();
  const userPerformance = getUserPerformance();
  const priorityHeatmap = getPriorityHeatmap();
  const completionFunnel = getCompletionFunnel();

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
      {/* Interactive Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Priority Filter */}
            <select
              value={selectedPriority || ''}
              onChange={(e) => setSelectedPriority(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>

            {/* Clear Filters */}
            {(selectedPriority || selectedStatus) && (
              <button
                onClick={() => {
                  setSelectedPriority(null);
                  setSelectedStatus(null);
                }}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Creative Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statusDistribution.map((status, index) => {
          const Icon = status.icon;
          return (
            <motion.div
              key={status.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm cursor-pointer relative overflow-hidden"
              onClick={() => setSelectedStatus(
                status.name.toLowerCase().replace(' ', '-') === selectedStatus 
                  ? null 
                  : status.name.toLowerCase().replace(' ', '-')
              )}
            >
              <div className="absolute top-0 right-0 w-24 h-24 opacity-5" 
                   style={{ background: `radial-gradient(circle, ${status.color}, transparent)` }} />
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${status.color}20` }}>
                  <Icon className="h-5 w-5" style={{ color: status.color }} />
                </div>
                <span 
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{ backgroundColor: `${status.color}20`, color: status.color }}
                >
                  {status.percentage}%
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{status.value}</div>
              <p className="text-sm text-gray-500 mt-1">{status.name}</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${status.percentage}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: status.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Velocity Chart with Interactivity */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Task Velocity</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                Created
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                Completed
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={taskVelocity}>
              <defs>
                <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="created" fill="#3B82F6" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Line type="monotone" dataKey="velocity" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* User Performance Bubble Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Performance</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="tasks" 
                name="Tasks" 
                stroke="#6b7280" 
                fontSize={11}
                label={{ value: 'Total Tasks', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }}
              />
              <YAxis 
                dataKey="efficiency" 
                name="Efficiency" 
                stroke="#6b7280" 
                fontSize={11}
                label={{ value: 'Efficiency %', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
              />
              <ZAxis dataKey="z" range={[50, 400]} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">{data.name}</p>
                        <p className="text-xs mt-1">Tasks: {data.tasks}</p>
                        <p className="text-xs">Completed: {data.completed}</p>
                        <p className="text-xs">Efficiency: {data.efficiency}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                name="Users" 
                data={userPerformance} 
                fill="#3B82F6"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Priority Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Priority vs Status Matrix</h3>
            <Target className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div></div>
            {['Todo', 'In Progress', 'Review', 'Completed'].map(status => (
              <div key={status} className="text-xs text-center font-medium text-gray-600">
                {status}
              </div>
            ))}
            {priorityHeatmap.map((row, rowIndex) => (
              <>
                <div key={`label-${rowIndex}`} className="text-xs font-medium text-gray-600 flex items-center">
                  {row.priority}
                </div>
                {['todo', 'in-progress', 'review', 'completed'].map(status => {
                  const value = row[status];
                  const maxValue = Math.max(...priorityHeatmap.flatMap(r => 
                    ['todo', 'in-progress', 'review', 'completed'].map(s => r[s])
                  ));
                  const intensity = maxValue > 0 ? value / maxValue : 0;
                  
                  return (
                    <motion.div
                      key={`${rowIndex}-${status}`}
                      whileHover={{ scale: 1.1 }}
                      className="aspect-square rounded-lg flex items-center justify-center text-sm font-semibold cursor-pointer transition-all"
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${intensity * 0.8})`,
                        color: intensity > 0.5 ? 'white' : '#374151'
                      }}
                      onClick={() => {
                        setSelectedPriority(row.priority.toLowerCase());
                        setSelectedStatus(status);
                      }}
                    >
                      {value}
                    </motion.div>
                  );
                })}
              </>
            ))}
          </div>
        </motion.div>

        {/* Completion Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Completion Funnel</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {completionFunnel.map((stage, index) => {
              const percentage = completionFunnel[0].value > 0 
                ? Math.round((stage.value / completionFunnel[0].value) * 100)
                : 0;
              
              return (
                <motion.div
                  key={stage.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {stage.value} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.2 }}
                      className="h-full rounded-lg flex items-center justify-end pr-2"
                      style={{ backgroundColor: stage.fill }}
                    >
                      {percentage > 20 && (
                        <span className="text-xs font-semibold text-white">
                          {percentage}%
                        </span>
                      )}
                    </motion.div>
                  </div>
                  {index < completionFunnel.length - 1 && (
                    <div className="flex justify-center my-1">
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              label: 'Total Tasks',
              value: filteredTasks.length,
              change: `${dateRange} period`,
              icon: Briefcase
            },
            {
              label: 'Completion Rate',
              value: `${filteredTasks.length > 0 ? Math.round((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100) : 0}%`,
              change: 'Overall',
              icon: CheckCircle2
            },
            {
              label: 'Active Users',
              value: userPerformance.length,
              change: 'With tasks',
              icon: Users
            },
            {
              label: 'Avg. Efficiency',
              value: `${userPerformance.length > 0 ? Math.round(userPerformance.reduce((sum, u) => sum + u.efficiency, 0) / userPerformance.length) : 0}%`,
              change: 'Team average',
              icon: Activity
            }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className="text-center"
              >
                <Icon className="h-8 w-8 mx-auto mb-2 text-white/80" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/80 mt-1">{stat.label}</div>
                <div className="text-xs text-white/60 mt-0.5">{stat.change}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}