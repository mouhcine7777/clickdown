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
  assignedTo: string[]; // Changed to array for multiple assignees
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