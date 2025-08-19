// src/lib/types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  managerId: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo: string[];
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  startDate?: Date;
  endDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'task-assigned' | 'task-completed' | 'project-update' | 'deadline-reminder' | 'general';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

// Personal Project interface for personal space organization
export interface PersonalProject {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Updated PersonalTodo interface with projectId support
export interface PersonalTodo {
  id: string;
  title: string;
  description?: string;
  userId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  projectId?: string; // Added to link todos to personal projects
  createdAt: Date;
  updatedAt: Date;
}

// Message interface
export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

