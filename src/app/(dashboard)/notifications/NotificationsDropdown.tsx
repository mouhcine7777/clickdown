// src/components/notifications/NotificationsDropdown.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
// Helper function to format relative time
const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return 'just now';
  
  // Handle Firestore timestamp
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
  const weeks = Math.floor(diffInSeconds / 604800);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};
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
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

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

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationCountChange?: (count: number) => void;
}

export default function NotificationsDropdown({ isOpen, onClose, onNotificationCountChange }: NotificationsDropdownProps) {
  const { userData } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  useEffect(() => {
    if (!userData?.id) {
      console.log('No user data available');
      setLoading(false);
      return;
    }

    console.log('Setting up notifications listener for user:', userData.id);
    
    let unsubscribe: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        // Simple query without ordering (we'll sort manually)
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', userData.id)
        );
        
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log('Notifications snapshot received, size:', snapshot.size);
            
            if (snapshot.empty) {
              console.log('No notifications found for user:', userData.id);
              setNotifications([]);
              onNotificationCountChange?.(0);
              setLoading(false);
              return;
            }
            
            const notificationsList = snapshot.docs.map(doc => {
              const data = doc.data();
              console.log('Notification:', doc.id, data);
              
              return {
                id: doc.id,
                userId: data.userId,
                type: data.type || 'general',
                title: data.title || 'Notification',
                message: data.message || '',
                read: data.read === true, // Ensure boolean
                link: data.link,
                createdAt: data.createdAt
              } as Notification;
            });
            
            // Sort manually by createdAt (newest first)
            notificationsList.sort((a, b) => {
              const getTime = (timestamp: any) => {
                if (!timestamp) return 0;
                if (timestamp.toDate) return timestamp.toDate().getTime();
                if (timestamp.seconds) return timestamp.seconds * 1000;
                if (timestamp instanceof Date) return timestamp.getTime();
                return 0;
              };
              
              return getTime(b.createdAt) - getTime(a.createdAt);
            });
            
            // Keep all notifications, not just unread ones
            setNotifications(notificationsList);
            
            // Count only unread for the badge
            const unreadCount = notificationsList.filter(n => !n.read).length;
            console.log('Total notifications:', notificationsList.length, 'Unread:', unreadCount);
            onNotificationCountChange?.(unreadCount);
            
            setLoading(false);
          },
          (error) => {
            console.error('Error in notifications listener:', error);
            setLoading(false);
            
            // If it's a permission error, show a more helpful message
            if (error.code === 'permission-denied') {
              console.error('Permission denied. Check Firestore rules.');
              toast.error('Permission denied. Please check your permissions.');
            } else {
              toast.error('Failed to load notifications');
            }
          }
        );
      } catch (error) {
        console.error('Error setting up listener:', error);
        setLoading(false);
      }
    };
    
    setupListener();
    
    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userData?.id, onNotificationCountChange]);

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(notificationId);
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
      console.log('Marked notification as read:', notificationId);
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark as read');
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      );
      await Promise.all(updatePromises);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const clearAll = async () => {
    try {
      const deletePromises = notifications.map(n => 
        deleteDoc(doc(db, 'notifications', n.id))
      );
      await Promise.all(deletePromises);
      toast.success('All notifications cleared');
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task-assigned':
        return <CheckSquare className="h-4 w-4" />;
      case 'task-completed':
        return <Check className="h-4 w-4" />;
      case 'project-update':
        return <AlertCircle className="h-4 w-4" />;
      case 'deadline-reminder':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
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

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read but don't delete
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Only navigate if there's a link, otherwise just close
    if (notification.link) {
      // Use Next.js router for navigation instead of window.location
      window.location.pathname = notification.link;
    }
    
    // Close the dropdown
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
          />
          
          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {notifications.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({notifications.filter(n => !n.read).length} unread)
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {notifications.some(n => !n.read) && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="mt-2 text-sm text-gray-500">No notifications</p>
                  <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.filter(n => showOnlyUnread ? !n.read : true).map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors relative
                        ${!notification.read ? 'bg-blue-50/50' : ''}
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start">
                        {/* Icon */}
                        <div className={`
                          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white
                          ${getNotificationColor(notification.type)}
                        `}>
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="ml-3 flex-1 min-w-0">
                          <p className={`
                            text-sm font-medium text-gray-900
                            ${!notification.read ? 'font-semibold' : ''}
                          `}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="ml-3 flex-shrink-0 flex items-center space-x-1">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              disabled={markingAsRead === notification.id}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Mark as read"
                            >
                              {markingAsRead === notification.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                              ) : (
                                <Check className="h-3 w-3 text-gray-400" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Delete"
                          >
                            <X className="h-3 w-3 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                <Link
                  href="/notifications"
                  onClick={onClose}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all notifications →
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}