// src/app/(dashboard)/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Bell,
  Check,
  X,
  CheckSquare,
  UserPlus,
  Calendar,
  AlertCircle,
  Trash2,
  CheckCheck,
  Loader2,
  Search,
  Filter,
  Archive,
  BellOff,
  Clock,
  ChevronRight,
  Inbox,
  Eye,
  EyeOff
} from 'lucide-react';

interface Notification {
  id: string;
  userId: string;
  type: 'task-assigned' | 'task-completed' | 'project-update' | 'deadline-reminder' | 'general';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: any;
}

type FilterType = 'all' | 'unread' | 'read';
type NotificationType = 'all' | Notification['type'];

export default function NotificationsPage() {
  const { userData } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [notificationType, setNotificationType] = useState<NotificationType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Helper function to format relative time
  const formatTimeAgo = (timestamp: any): string => {
    if (!timestamp) return 'just now';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return 'just now';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  };

  useEffect(() => {
    if (!userData?.id) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userData.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      // Sort by createdAt
      notificationsList.sort((a, b) => {
        const getTime = (timestamp: any) => {
          if (!timestamp) return 0;
          if (timestamp.toDate) return timestamp.toDate().getTime();
          if (timestamp.seconds) return timestamp.seconds * 1000;
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      
      setNotifications(notificationsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.id]);

  useEffect(() => {
    // Apply filters
    let filtered = [...notifications];

    // Filter by read/unread status
    if (filterType === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (filterType === 'read') {
      filtered = filtered.filter(n => n.read);
    }

    // Filter by notification type
    if (notificationType !== 'all') {
      filtered = filtered.filter(n => n.type === notificationType);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredNotifications(filtered);
  }, [notifications, filterType, notificationType, searchQuery]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task-assigned':
        return <CheckSquare className="h-5 w-5" />;
      case 'task-completed':
        return <Check className="h-5 w-5" />;
      case 'project-update':
        return <AlertCircle className="h-5 w-5" />;
      case 'deadline-reminder':
        return <Calendar className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'task-assigned':
        return 'bg-blue-500';
      case 'task-completed':
        return 'bg-green-500';
      case 'project-update':
        return 'bg-purple-500';
      case 'deadline-reminder':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const toggleSelectNotification = (id: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  const selectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedNotifications.size === 0) return;
    
    setProcessingAction(true);
    try {
      const batch = writeBatch(db);
      selectedNotifications.forEach(id => {
        batch.update(doc(db, 'notifications', id), { read: true });
      });
      await batch.commit();
      toast.success(`${selectedNotifications.size} notifications marked as read`);
      setSelectedNotifications(new Set());
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    } finally {
      setProcessingAction(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedNotifications.size === 0) return;
    
    if (!confirm(`Delete ${selectedNotifications.size} notification(s)?`)) return;
    
    setProcessingAction(true);
    try {
      const batch = writeBatch(db);
      selectedNotifications.forEach(id => {
        batch.delete(doc(db, 'notifications', id));
      });
      await batch.commit();
      toast.success(`${selectedNotifications.size} notifications deleted`);
      setSelectedNotifications(new Set());
    } catch (error) {
      toast.error('Failed to delete notifications');
    } finally {
      setProcessingAction(false);
    }
  };

  const markAllAsRead = async () => {
    setProcessingAction(true);
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    } finally {
      setProcessingAction(false);
    }
  };

  const clearAll = async () => {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    
    setProcessingAction(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      toast.success('All notifications cleared');
    } catch (error) {
      toast.error('Failed to clear notifications');
    } finally {
      setProcessingAction(false);
    }
  };

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    read: notifications.filter(n => n.read).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage and view all your notifications in one place
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unread</p>
              <p className="text-2xl font-bold text-blue-600">{stats.unread}</p>
            </div>
            <BellOff className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Read</p>
              <p className="text-2xl font-bold text-green-600">{stats.read}</p>
            </div>
            <CheckCheck className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>

              <select
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value as NotificationType)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="task-assigned">Task Assigned</option>
                <option value="task-completed">Task Completed</option>
                <option value="project-update">Project Update</option>
                <option value="deadline-reminder">Deadline Reminder</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {filteredNotifications.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0}
                onChange={selectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">
                {selectedNotifications.size > 0 
                  ? `${selectedNotifications.size} selected`
                  : 'Select all'
                }
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedNotifications.size > 0 && (
                <>
                  <button
                    onClick={markSelectedAsRead}
                    disabled={processingAction}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Mark as Read
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={processingAction}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </>
              )}
              {stats.unread > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={processingAction}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark All Read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={processingAction}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="divide-y divide-gray-200">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No notifications found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchQuery && 'Try adjusting your search or filters'}
                {!searchQuery && filterType === 'unread' && 'You have no unread notifications'}
                {!searchQuery && filterType === 'read' && 'You have no read notifications'}
                {!searchQuery && filterType === 'all' && notifications.length === 0 && "You don't have any notifications yet"}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`
                    p-4 hover:bg-gray-50 transition-colors
                    ${!notification.read ? 'bg-blue-50/30' : ''}
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={() => toggleSelectNotification(notification.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />

                    {/* Icon */}
                    <div className={`
                      flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white
                      ${getNotificationColor(notification.type)}
                    `}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`
                            text-sm font-medium text-gray-900
                            ${!notification.read ? 'font-semibold' : ''}
                          `}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-400">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatTimeAgo(notification.createdAt)}
                            </span>
                            {notification.link && (
                              <Link
                                href={notification.link}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"
                              >
                                View Details
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Mark as read"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm('Delete this notification?')) {
                                await deleteDoc(doc(db, 'notifications', notification.id));
                                toast.success('Notification deleted');
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}