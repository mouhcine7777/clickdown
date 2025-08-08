// src/app/(dashboard)/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  Activity,
  PieChart,
  ArrowUpRight,
  Download,
  Filter,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import TasksAnalytics from './TasksAnalytics';
import ProjectsAnalytics from './ProjectsAnalytics';
import UsersAnalytics from './UsersAnalytics';
import GanttAnalytics from './GanttAnalytics';

type TabType = 'tasks' | 'projects' | 'users' | 'gantt';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d, all
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tabs = [
    {
      id: 'tasks' as TabType,
      label: 'Tasks',
      icon: BarChart3,
      description: 'Task performance metrics',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      id: 'projects' as TabType,
      label: 'Projects',
      icon: PieChart,
      description: 'Project progress tracking',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      id: 'users' as TabType,
      label: 'Users',
      icon: Users,
      description: 'Team productivity',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      id: 'gantt' as TabType,
      label: 'Timeline',
      icon: GitBranch,
      description: 'Project timeline view',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  ];

  const dateRanges = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'all', label: 'All time' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                Analytics Dashboard
              </h1>
              <p className="text-gray-500 mt-2">
                Real-time insights and performance metrics
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {dateRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>

              {/* Refresh Button */}
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {/* Export Button */}
              <button className="px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
            <div className="grid grid-cols-4 gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200
                      ${isActive 
                        ? 'bg-gradient-to-r from-gray-900 to-gray-700 text-white shadow-lg' 
                        : 'hover:bg-gray-50 text-gray-600'
                      }
                    `}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    
                    <div className="relative flex items-center gap-2 flex-1">
                      <div className={`
                        p-1.5 rounded-lg transition-colors
                        ${isActive ? 'bg-white/20' : tab.bgColor}
                      `}>
                        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : tab.color}`} />
                      </div>
                      
                      <div className="text-left">
                        <div className="font-semibold text-sm">
                          {tab.label}
                        </div>
                        <div className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-500'} hidden xl:block`}>
                          {tab.description}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <ArrowUpRight className="h-3 w-3 text-white/60 hidden sm:block" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + dateRange + isRefreshing}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'tasks' && <TasksAnalytics dateRange={dateRange} />}
            {activeTab === 'projects' && <ProjectsAnalytics dateRange={dateRange} />}
            {activeTab === 'users' && <UsersAnalytics dateRange={dateRange} />}
            {activeTab === 'gantt' && <GanttAnalytics dateRange={dateRange} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}