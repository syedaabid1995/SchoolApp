'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const titleReplacements: Record<string, string> = {
  'Action failed': 'Unable to complete action',
  'Auto assign failed': 'Unable to auto assign',
  'Assignment failed': 'Unable to assign',
  'Approval failed': 'Unable to approve request',
  'Carry-forward failed': 'Unable to create carry-forward',
  'Carry-forward preview failed': 'Unable to preview carry-forward',
  'Copy failed': 'Unable to copy',
  'Delete failed': 'Unable to delete',
  'Department failed': 'Unable to add department',
  'Designation failed': 'Unable to add designation',
  'Download failed': 'Unable to download',
  'Export failed': 'Unable to export',
  'Generation failed': 'Unable to generate',
  'Invoice generation failed': 'Unable to generate invoices',
  'Print blocked': 'Unable to print',
  'Promotion failed': 'Unable to promote students',
  'Rejection failed': 'Unable to reject request',
  'Remove failed': 'Unable to remove',
  'Save failed': 'Unable to save changes',
  'Setup failed': 'Unable to prepare setup',
  'Validation error': 'Please check the highlighted fields',
};

const successTitleReplacements: Record<string, string> = {
  Approved: 'Request approved',
  Assigned: 'Assignment saved',
  Copied: 'Copied to clipboard',
  Deleted: 'Deleted successfully',
  Downloaded: 'Download ready',
  Rejected: 'Request rejected',
  Removed: 'Removed successfully',
  Saved: 'Saved successfully',
};

const fallbackMessages: Partial<Record<NotificationType, string>> = {
  error: 'Please review the details and try again.',
  warning: 'Please review the highlighted details.',
};

const cleanNotification = (notification: Omit<Notification, 'id'>): Omit<Notification, 'id'> => {
  const title = notification.title.trim();
  const replacements = notification.type === 'success' ? successTitleReplacements : titleReplacements;
  const cleanedTitle = replacements[title] ?? title;
  const message = notification.message?.trim();
  const genericMessage = !message || message === 'Something went wrong' || message === 'Failed' || message === 'Action failed';

  return {
    ...notification,
    title: cleanedTitle,
    message: genericMessage ? fallbackMessages[notification.type] : message,
  };
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

const NotificationItem = ({ notification, onRemove }: { notification: Notification; onRemove: (id: string) => void }) => {
  const getColors = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
    }
  };

  return (
    <div className={`relative rounded-lg border p-4 shadow-lg animate-slide-in ${getColors()}`}>
      <div className="flex items-start gap-3">
        <span className="text-sm font-bold">{getIcon()}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{notification.title}</h4>
          {notification.message && <p className="text-xs mt-1">{notification.message}</p>}
        </div>
        <button onClick={() => onRemove(notification.id)} className="opacity-60 hover:opacity-100">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [suspension, setSuspension] = useState<{ title: string; message: string } | null>(null);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...cleanNotification(notification), id };
    
    setNotifications(prev => [newNotification, ...prev]);

    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { title?: string; message?: string } | undefined;
      setSuspension({
        title: detail?.title ?? 'Account Suspended',
        message: detail?.message ?? 'Your access has been suspended. Please contact support.',
      });
    };
    window.addEventListener('account-suspended', handler);
    return () => window.removeEventListener('account-suspended', handler);
  }, []);

  const handleSuspensionClose = () => {
    setSuspension(null);
    if (typeof window !== 'undefined') {
      const isParent = window.location.pathname.startsWith('/parent');
      window.location.href = isParent ? '/parent/login' : '/login';
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      {suspension ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-ink">{suspension.title}</div>
            <p className="mt-2 text-sm text-slate">{suspension.message}</p>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={handleSuspensionClose}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRemove={removeNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotify = () => {
  const { addNotification } = useNotifications();

  return {
    success: (title: string, message?: string) => 
      addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      addNotification({ type: 'error', title, message }),
    warning: (title: string, message?: string) => 
      addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      addNotification({ type: 'info', title, message }),
  };
};
