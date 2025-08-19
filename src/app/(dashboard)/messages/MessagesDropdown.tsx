// src/components/messages/MessagesDropdown.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ArrowUpRight, Dot } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface MessagesDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}

interface GroupedMessage {
  senderId: string;
  senderName: string;
  latestMessage: Message;
  unreadCount: number;
}

export default function MessagesDropdown({ 
  isOpen, 
  onClose, 
  onUnreadCountChange 
}: MessagesDropdownProps) {
  const { user } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [groupedMessages, setGroupedMessages] = useState<GroupedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('receiverId', '==', user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        })) as Message[];

        const messageGroups = new Map<string, Message[]>();
        
        messages.forEach(message => {
          const senderId = message.senderId;
          if (!messageGroups.has(senderId)) {
            messageGroups.set(senderId, []);
          }
          messageGroups.get(senderId)!.push(message);
        });

        const grouped: GroupedMessage[] = [];
        
        messageGroups.forEach((senderMessages, senderId) => {
          const sortedMessages = senderMessages.sort((a, b) => 
            b.createdAt.getTime() - a.createdAt.getTime()
          );
          
          const latestMessage = sortedMessages[0];
          const unreadCount = senderMessages.filter(msg => !msg.read).length;
          
          grouped.push({
            senderId,
            senderName: latestMessage.senderName,
            latestMessage,
            unreadCount
          });
        });

        const sortedGrouped = grouped
          .sort((a, b) => 
            b.latestMessage.createdAt.getTime() - a.latestMessage.createdAt.getTime()
          )
          .slice(0, 4);

        setGroupedMessages(sortedGrouped);
        
        const totalUnreadCount = messages.filter(msg => !msg.read).length;
        onUnreadCountChange(totalUnreadCount);
        
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, onUnreadCountChange]);

  const handleMessageClick = async (groupedMessage: GroupedMessage) => {
    if (groupedMessage.unreadCount > 0) {
      try {
        if (!groupedMessage.latestMessage.read) {
          await updateDoc(doc(db, 'messages', groupedMessage.latestMessage.id), { read: true });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }

    router.push(`/messages?userId=${groupedMessage.senderId}&userName=${encodeURIComponent(groupedMessage.senderName)}`);
    onClose();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.1 }}
        className="absolute right-0 mt-3 w-96 bg-white rounded-xl border border-gray-200 shadow-2xl z-50"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-gray-700" />
            <h3 className="text-sm font-medium text-gray-900">Messages</h3>
          </div>
          <Link 
            href="/messages" 
            onClick={onClose}
            className="group flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span>View all</span>
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* Messages List */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-gray-900"></div>
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">No messages</p>
              <p className="text-xs text-gray-400 mt-1">Start a conversation to see messages here</p>
            </div>
          ) : (
            <div className="py-1">
              {groupedMessages.map((groupedMessage, index) => (
                <motion.button
                  key={groupedMessage.senderId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleMessageClick(groupedMessage)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative">
                      <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-medium">
                          {groupedMessage.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {groupedMessage.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {groupedMessage.senderName}
                        </p>
                        <div className="flex items-center space-x-1 text-xs text-gray-400">
                          <span>{formatTime(groupedMessage.latestMessage.createdAt)}</span>
                          {groupedMessage.unreadCount > 0 && (
                            <>
                              <Dot className="h-3 w-3" />
                              <span className="text-blue-500 font-medium">{groupedMessage.unreadCount}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${
                        groupedMessage.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}>
                        {groupedMessage.latestMessage.content}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {groupedMessages.length > 0 && (
          <div className="border-t border-gray-100 p-3">
            <Link
              href="/messages"
              onClick={onClose}
              className="block w-full text-center py-2 px-4 bg-black hover:bg-gray-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Open Messages
            </Link>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}