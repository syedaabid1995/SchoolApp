'use client';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../services/auth.service';

export default function DashboardClientLayout({ 
  children, 
  role, 
  email 
}: { 
  children: React.ReactNode;
  role: string | null;
  email: string | null;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  
  return (
    <div className="flex h-screen bg-sand">
      <Sidebar 
        role={role} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        schoolName={session?.schoolName}
      />
      <div className="flex flex-1 flex-col h-screen">
        <Header 
          role={role} 
          email={email} 
          displayName={session?.displayName ?? null}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
        <main className="flex-1 overflow-y-auto p-4 transition-all duration-200 sm:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {children}
          </div>
        </main>
        <footer className="theme-footer border-t border-white/10 px-4 py-3 text-xs text-white/80 transition-all duration-200 sm:px-6 backdrop-blur-md flex-shrink-0">
          <div className="mx-auto max-w-7xl">
            TechStage IT • School Management Console
          </div>
        </footer>
      </div>
    </div>
  );
}
