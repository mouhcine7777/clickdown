// src/app/(dashboard)/personal/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus,
  CheckCircle2, 
  Circle,
  Trash2,
  Edit3,
  Save,
  X,
  User,
  Target,
  Calendar,
  Sparkles,
  ListTodo,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface PersonalTodo {
  id: string;
  title: string;
  description?: string;
  userId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default function PersonalSpacePage() {
  const { userData } = useAuth();
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as PersonalTodo['priority'],
    dueDate: ''
  });

  // Get current time for greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!userData) return;

    const todosQuery = query(
      collection(db, 'personalTodos'),
      where('userId', '==', userData.id)
    );

    const unsubscribe = onSnapshot(
      todosQuery,
      (snapshot) => {
        const todosList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            userId: data.userId || '',
            completed: data.completed || false,
            priority: data.priority || 'medium',
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          } as PersonalTodo;
        });

        todosList.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        setTodos(todosList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching personal todos:', error);
        setLoading(false);
        toast.error('Failed to load your personal todos');
      }
    );

    return () => unsubscribe();
  }, [userData]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !newTodo.title.trim()) return;

    try {
      await addDoc(collection(db, 'personalTodos'), {
        title: newTodo.title.trim(),
        description: newTodo.description.trim(),
        userId: userData.id,
        completed: false,
        priority: newTodo.priority,
        dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewTodo({ title: '', description: '', priority: 'medium', dueDate: '' });
      setShowAddForm(false);
      toast.success('Personal todo added!');
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Failed to add todo');
    }
  };

  const handleToggleComplete = async (todo: PersonalTodo) => {
    try {
      await updateDoc(doc(db, 'personalTodos', todo.id), {
        completed: !todo.completed,
        updatedAt: serverTimestamp(),
      });
      toast.success(todo.completed ? 'Todo marked as incomplete' : 'Todo completed!');
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update todo');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteDoc(doc(db, 'personalTodos', todoId));
      toast.success('Todo deleted');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Failed to delete todo');
    }
  };

  const handleEditTodo = async (todo: PersonalTodo, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateDoc(doc(db, 'personalTodos', todo.id), {
        title: newTitle.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      toast.success('Todo updated');
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update todo');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const completedTodos = todos.filter(t => t.completed).length;
  const pendingTodos = todos.filter(t => !t.completed).length;
  const urgentTodos = todos.filter(t => t.priority === 'urgent' && !t.completed).length;

  const statCards = [
    {
      title: 'Total Todos',
      value: todos.length,
      icon: ListTodo,
      gradient: 'from-blue-600 to-cyan-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Completed',
      value: completedTodos,
      icon: CheckCircle2,
      gradient: 'from-green-600 to-emerald-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Pending',
      value: pendingTodos,
      icon: Clock,
      gradient: 'from-amber-600 to-orange-600',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600'
    },
    {
      title: 'Urgent',
      value: urgentTodos,
      icon: Target,
      gradient: 'from-red-600 to-pink-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                  <User className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Espace Personnel
                </h1>
              </div>
              <p className="text-gray-600 text-lg">
                {getGreeting()}, {userData?.name?.split(' ')[0]}! Manage your personal todos and notes
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus className="h-5 w-5" />
              Add Todo
            </motion.button>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Todo Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add New Personal Todo</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Todo title..."
                    value={newTodo.title}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Description (optional)..."
                    value={newTodo.description}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
                    className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, priority: e.target.value as PersonalTodo['priority'] }))}
                      className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (optional)</label>
                    <input
                      type="date"
                      value={newTodo.dueDate}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Save className="h-4 w-4" />
                    Add Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Todos List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300"
        >
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">My Personal Todos</h2>
                  <p className="text-xs text-gray-500">Your private task list</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {completedTodos}/{todos.length} completed
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              </div>
            ) : todos.length === 0 ? (
              <div className="p-12 text-center">
                <ListTodo className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">No personal todos yet</p>
                <p className="text-sm text-gray-400 mb-6">Create your first personal todo to get started</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Todo
                </button>
              </div>
            ) : (
              <>
                {todos.map((todo, index) => (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 hover:bg-gray-50 transition-all group ${todo.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleComplete(todo)}
                        className={`mt-1 p-1 rounded-full transition-all hover:scale-110 ${
                          todo.completed 
                            ? 'text-green-600 hover:text-green-700' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {todo.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        {editingId === todo.id ? (
                          <input
                            type="text"
                            defaultValue={todo.title}
                            autoFocus
                            onBlur={(e) => handleEditTodo(todo, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditTodo(todo, e.currentTarget.value);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                            className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <h3 
                            className={`font-medium group-hover:text-blue-600 transition-colors cursor-pointer ${
                              todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
                            }`}
                            onClick={() => setEditingId(todo.id)}
                          >
                            {todo.title}
                          </h3>
                        )}
                        
                        {todo.description && (
                          <p className={`text-sm mt-1 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {todo.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium border ${getPriorityBadge(todo.priority)}`}>
                            {todo.priority}
                          </span>
                          {todo.dueDate && (
                            <span className={`text-xs flex items-center ${
                              todo.completed ? 'text-gray-400' : 
                              todo.dueDate < new Date() ? 'text-red-500' : 'text-gray-500'
                            }`}>
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(todo.dueDate, 'MMM dd, yyyy')}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            Created {format(todo.createdAt, 'MMM dd')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingId(todo.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </motion.div>

        {/* Quick Stats Section */}
        {todos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl p-8 text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-white/10 to-transparent rounded-full -ml-24 -mb-24" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-6 w-6 text-yellow-400" />
                <h3 className="text-2xl font-bold">Personal Progress</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-300">Completion Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{pendingTodos}</div>
                  <div className="text-sm text-gray-300">Remaining Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{urgentTodos}</div>
                  <div className="text-sm text-gray-300">Urgent Items</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}