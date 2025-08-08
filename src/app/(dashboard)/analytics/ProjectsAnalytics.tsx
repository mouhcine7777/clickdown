// src/app/(dashboard)/analytics/ProjectsAnalytics.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Project, Task, User } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Users,
  Clock,
  TrendingUp,
  Calendar,
  Activity,
  Target,
  Award,
  Briefcase,
  CheckCircle
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
  RadialBarChart,
  RadialBar,
  Treemap,
  Sankey
} from 'recharts';

interface ProjectsAnalyticsProps {
  dateRange: string;
}

export default function ProjectsAnalytics({ dateRange }: ProjectsAnalyticsProps) {
  const { userData, isManager } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) return;

      try {
        // Fetch projects
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        const projectsList = projectsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as Project;
        });
        setProjects(projectsList);

        // Fetch tasks
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        const tasksList = tasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Task[];
        setTasks(tasksList);

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
  }, [userData]);

  // Project status distribution
  const statusData = [
    { name: 'Active', value: projects.filter(p => p.status === 'active').length, color: '#10B981' },
    { name: 'On Hold', value: projects.filter(p => p.status === 'on-hold').length, color: '#F59E0B' },
    { name: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#3B82F6' },
  ];

  // Project completion timeline
  const getProjectTimeline = () => {
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const started = projects.filter(p => {
        const startDate = p.startDate;
        return startDate >= monthStart && startDate <= monthEnd;
      }).length;
      
      const completed = projects.filter(p => 
        p.status === 'completed' && p.endDate && p.endDate >= monthStart && p.endDate <= monthEnd
      ).length;
      
      months.push({
        name: date.toLocaleDateString('en', { month: 'short' }),
        started,
        completed,
      });
    }
    
    return months;
  };

  // Team productivity by project
  const getTeamProductivity = () => {
    return projects.slice(0, 5).map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const totalTasks = projectTasks.length;
      const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      return {
        name: project.name.length > 15 ? project.name.substring(0, 15) + '...' : project.name,
        productivity,
        tasks: totalTasks,
      };
    });
  };

  // Resource allocation
  const getResourceAllocation = () => {
    const allocation = users.map(user => {
      const userTasks = tasks.filter(t => t.assignedTo?.includes(user.id));
      return {
        name: user.name,
        tasks: userTasks.length,
        completed: userTasks.filter(t => t.status === 'completed').length,
        inProgress: userTasks.filter(t => t.status === 'in-progress').length,
      };
    });
    return allocation.sort((a, b) => b.tasks - a.tasks).slice(0, 6);
  };

  // Project health scores
  const getProjectHealth = () => {
    return projects.slice(0, 6).map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const totalTasks = projectTasks.length;
      
      // Calculate health score based on multiple factors
      let healthScore = 0;
      
      // Completion rate (40%)
      if (totalTasks > 0) {
        healthScore += (completedTasks / totalTasks) * 40;
      }
      
      // On-time factor (30%)
      if (project.status === 'active' && project.endDate) {
        const daysRemaining = Math.ceil((project.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysRemaining > 0) {
          healthScore += 30;
        } else {
          healthScore += Math.max(0, 30 + (daysRemaining * 0.5));
        }
      } else if (project.status === 'completed') {
        healthScore += 30;
      }
      
      // Activity factor (30%)
      const recentTasks = projectTasks.filter(t => {
        const taskDate = t.updatedAt || t.createdAt;
        const daysSince = Math.ceil((new Date().getTime() - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince <= 7;
      }).length;
      
      if (recentTasks > 0) {
        healthScore += Math.min(30, recentTasks * 10);
      }
      
      return {
        name: project.name.length > 20 ? project.name.substring(0, 20) + '...' : project.name,
        health: Math.round(healthScore),
        status: project.status,
      };
    });
  };

  const timeline = getProjectTimeline();
  const teamProductivity = getTeamProductivity();
  const resourceAllocation = getResourceAllocation();
  const projectHealth = getProjectHealth();

  // Calculate key metrics
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completionRate = projects.length > 0 
    ? Math.round((projects.filter(p => p.status === 'completed').length / projects.length) * 100)
    : 0;
  const avgTasksPerProject = projects.length > 0 
    ? Math.round(tasks.length / projects.length)
    : 0;
  const teamMembers = users.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Active Projects',
            value: activeProjects,
            icon: FolderOpen,
            description: 'Currently running',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
          },
          {
            title: 'Completion Rate',
            value: `${completionRate}%`,
            icon: CheckCircle,
            description: 'Projects completed',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
          },
          {
            title: 'Avg. Tasks/Project',
            value: avgTasksPerProject,
            icon: Briefcase,
            description: 'Task distribution',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
          },
          {
            title: 'Team Members',
            value: teamMembers,
            icon: Users,
            description: 'Active contributors',
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
          },
        ].map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {metric.value}
              </div>
              <p className="text-sm text-gray-500 mt-1">{metric.description}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Timeline */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="started" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Project Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Status Distribution</h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Team Productivity */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Productivity</h3>
            <Target className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamProductivity} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={100} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Bar dataKey="productivity" fill="#3B82F6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Resource Allocation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Resource Allocation</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resourceAllocation}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Legend />
              <Bar dataKey="completed" stackId="a" fill="#10B981" />
              <Bar dataKey="inProgress" stackId="a" fill="#3B82F6" />
              <Bar dataKey="tasks" stackId="b" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Project Health Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Project Health Scores</h3>
          <Award className="h-5 w-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectHealth.map((project, index) => (
            <motion.div
              key={project.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 text-sm">{project.name}</h4>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  project.status === 'active' ? 'bg-green-100 text-green-700' :
                  project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className={`text-xs font-semibold inline-block ${
                      project.health >= 80 ? 'text-green-600' :
                      project.health >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      Health Score
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold inline-block ${
                      project.health >= 80 ? 'text-green-600' :
                      project.health >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {project.health}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                  <div 
                    style={{ width: `${project.health}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      project.health >= 80 ? 'bg-green-500' :
                      project.health >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}