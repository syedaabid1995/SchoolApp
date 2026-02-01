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
    const newNotification = { ...notification, id };
    
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
