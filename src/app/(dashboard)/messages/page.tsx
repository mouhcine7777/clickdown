// src/app/(dashboard)/messages/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSearchParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message, User } from '@/lib/types';
import { Send, User as UserIcon, MessageSquare, Search, Plus, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { user, userData } = useAuth();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Auto scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Fetch all users and set up unread message listeners
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const allUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })) as User[];
        
        // Filter out current user
        const filteredUsers = allUsers.filter(u => u.id !== user?.uid);
        setUsers(filteredUsers);

        // Set up listeners for unread message counts for each user
        const unsubscribers: (() => void)[] = [];
        
        filteredUsers.forEach(otherUser => {
          const messagesRef = collection(db, 'messages');
          const unreadQuery = query(
            messagesRef,
            where('senderId', '==', otherUser.id),
            where('receiverId', '==', user?.uid),
            where('read', '==', false)
          );

          const unsubscribe = onSnapshot(unreadQuery, (snapshot) => {
            const unreadCount = snapshot.docs.length;
            setUnreadCounts(prev => ({
              ...prev,
              [otherUser.id]: unreadCount
            }));
          });

          unsubscribers.push(unsubscribe);
        });

        // Check if we need to pre-select a user from URL params
        const preSelectUserId = searchParams.get('userId');
        const preSelectUserName = searchParams.get('userName');
        
        if (preSelectUserId && preSelectUserName) {
          const userToSelect = filteredUsers.find(u => u.id === preSelectUserId);
          if (userToSelect) {
            setSelectedUser(userToSelect);
          } else {
            // If user not found in the list, create a minimal user object
            const tempUser: User = {
              id: preSelectUserId,
              name: decodeURIComponent(preSelectUserName),
              email: '', // We don't have this info
              role: 'user' as const, // Default role
              createdAt: new Date()
            };
            setSelectedUser(tempUser);
          }
        }

        // Return cleanup function for all unsubscribers
        return () => {
          unsubscribers.forEach(unsub => unsub());
        };
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user) {
      const cleanup = fetchUsers();
      return () => {
        if (cleanup instanceof Promise) {
          cleanup.then(cleanupFn => cleanupFn && cleanupFn());
        }
      };
    }
  }, [user, searchParams]);

  // Fetch messages when user selects someone to chat with
  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const messagesRef = collection(db, 'messages');
    
    // Use simpler queries without orderBy to avoid index requirements
    const q1 = query(
      messagesRef,
      where('senderId', '==', user.uid),
      where('receiverId', '==', selectedUser.id)
    );
    
    const q2 = query(
      messagesRef,
      where('senderId', '==', selectedUser.id),
      where('receiverId', '==', user.uid)
    );

    let messages1: Message[] = [];
    let messages2: Message[] = [];
    let queriesLoaded = 0;

    const handleQueryComplete = () => {
      queriesLoaded++;
      if (queriesLoaded >= 2) {
        combineAndSetMessages();
      }
    };

    const combineAndSetMessages = async () => {
      try {
        // Combine and sort messages by creation time
        const allMessages = [...messages1, ...messages2].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        setMessages(allMessages);

        // Mark messages as read
        const unreadMessages = allMessages.filter(
          message => message.receiverId === user.uid && !message.read
        );

        if (unreadMessages.length > 0) {
          const updatePromises = unreadMessages.map(message => 
            updateDoc(doc(db, 'messages', message.id), { read: true })
          );
          
          await Promise.all(updatePromises);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error processing messages:', error);
        setLoading(false);
      }
    };

    const unsubscribe1 = onSnapshot(q1, 
      (snapshot) => {
        messages1 = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })) as Message[];
        
        handleQueryComplete();
      },
      (error) => {
        console.error('Error in query 1:', error);
        setLoading(false);
        toast.error('Failed to load messages');
      }
    );

    const unsubscribe2 = onSnapshot(q2, 
      (snapshot) => {
        messages2 = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })) as Message[];
        
        handleQueryComplete();
      },
      (error) => {
        console.error('Error in query 2:', error);
        setLoading(false);
        toast.error('Failed to load messages');
      }
    );

    // Cleanup function
    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user, selectedUser]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user || !userData) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        senderName: userData.name,
        receiverId: selectedUser.id,
        receiverName: selectedUser.name,
        content: newMessage.trim(),
        read: false,
        createdAt: new Date()
      });

      setNewMessage('');
    } catch (error) {
      toast.error('Failed to send message');
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!user || !userData) return null;

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex">
      {/* Users sidebar */}
      <div className="w-80 bg-white/80 backdrop-blur-xl border-r border-gray-200/60 flex flex-col shadow-2xl shadow-black/5">
        {/* Header with gradient */}
        <div className="relative p-6 border-b border-gray-200/60">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
          <div className="relative">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Messages
            </h1>
            <p className="text-sm text-gray-500 mt-1">Stay connected with your team</p>
          </div>
          
          {/* Search bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/80 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 text-sm transition-all placeholder-gray-400"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No users available</p>
              <p className="text-gray-400 text-sm mt-1">Users will appear here when available</p>
            </div>
          ) : (
            <div className="p-2">
              {users.map((userItem) => (
                <button
                  key={userItem.id}
                  onClick={() => setSelectedUser(userItem)}
                  className={`w-full p-4 text-left rounded-2xl mb-2 transition-all duration-200 group ${
                    selectedUser?.id === userItem.id 
                      ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-pink-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/10' 
                      : 'hover:bg-gray-50/80 hover:shadow-md hover:shadow-black/5'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                        selectedUser?.id === userItem.id
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30'
                          : 'bg-gradient-to-br from-gray-600 to-gray-700 group-hover:shadow-lg group-hover:shadow-gray-500/20'
                      }`}>
                        <span className="text-white text-sm font-semibold">
                          {userItem.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Unread indicator */}
                      {unreadCounts[userItem.id] > 0 && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center shadow-lg shadow-red-500/30 border-2 border-white">
                          {unreadCounts[userItem.id] > 99 ? '99+' : unreadCounts[userItem.id]}
                        </div>
                      )}
                      {/* Online status indicator */}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold truncate ${
                          unreadCounts[userItem.id] > 0 ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {userItem.name}
                        </p>
                        {selectedUser?.id === userItem.id && (
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize font-medium mt-0.5">{userItem.role}</p>
                      {unreadCounts[userItem.id] > 0 && (
                        <p className="text-xs text-blue-600 font-medium mt-1">New messages</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col h-screen">
        {selectedUser ? (
          <>
            {/* Chat header */}
            <div className="relative p-6 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <span className="text-white text-sm font-semibold">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
                    <p className="text-sm text-gray-500 capitalize font-medium">{selectedUser.role} • Active now</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100/80 rounded-xl transition-colors">
                  <MoreHorizontal className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50/50 to-white/50"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/30 border-t-blue-500"></div>
                    </div>
                    <p className="text-gray-500 font-medium">Loading messages...</p>
                    <p className="text-gray-400 text-sm mt-1">Please wait a moment</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                      <MessageSquare className="h-10 w-10 text-blue-500/60" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Start your conversation</h3>
                    <p className="text-gray-500">Send a message to begin chatting with {selectedUser.name}</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm transition-all ${
                            message.senderId === user.uid
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-blue-500/20'
                              : 'bg-white/80 backdrop-blur-sm text-gray-900 border border-gray-200/60 shadow-black/5'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <p className={`text-xs mt-2 ${
                            message.senderId === user.uid ? 'text-blue-100' : 'text-gray-400'
                          }`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {/* Invisible element for auto-scroll */}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Message input - Fixed at bottom */}
            <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-gray-200/60 flex-shrink-0 sticky bottom-0">
              <form onSubmit={sendMessage} className="flex items-end space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full px-4 py-3 bg-gray-50/80 border border-gray-200/60 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 text-gray-700 placeholder-gray-400 transition-all resize-none"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 disabled:hover:shadow-none"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
              <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-blue-500/60" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Messages</h3>
              <p className="text-gray-500 text-lg leading-relaxed">
                Select a conversation from the sidebar to start messaging with your team members.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}