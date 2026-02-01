'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  getAdminDashboardMetrics, 
  getWeeklyAnalytics, 
  getPerformanceMetrics
} from '../../services/adminDashboard.service';
import { listAuditLogs } from '../../services/audit.service';
import { useNotify } from '../../components/NotificationProvider';

export default function DashboardPage() {
  const notify = useNotify();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboardMetrics,
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['weekly-analytics'],
    queryFn: getWeeklyAnalytics,
  });

  const { data: performanceData } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: getPerformanceMetrics,
  });

  const { data: auditData } = useQuery({
    queryKey: ['recent-audit-logs'],
    queryFn: () => listAuditLogs({ limit: 5 }),
  });



  const stats = [
    { 
      label: 'Total Students', 
      value: data?.totalStudents || 0,
      icon: '👥',
      color: 'bg-blue-500',
      change: '+12%'
    },
    { 
      label: 'Total Teachers', 
      value: data?.totalTeachers || 0,
      icon: '👨🏫',
      color: 'bg-green-500',
      change: '+3%'
    },
    { 
      label: 'Attendance Today', 
      value: data?.attendanceRateToday ? `${data.attendanceRateToday}%` : '0%',
      icon: '📊',
      color: 'bg-purple-500',
      change: '+5%'
    },
    { 
      label: 'Active Classes', 
      value: data?.activeClasses || 0,
      icon: '🏫',
      color: 'bg-orange-500',
      change: '0%'
    },
  ];

  const quickActions = [
    { title: 'Add Student', href: '/dashboard/students/add', icon: '➕', desc: 'Register new student' },
    { title: 'Add Teacher', href: '/dashboard/teachers/add', icon: '👨💼', desc: 'Add teaching staff' },
    { title: 'View Reports', href: '/dashboard/reports', icon: '📈', desc: 'Academic reports' },
  ];

  const SimpleChart = ({ data, color, label }: { data: number[], color: string, label: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">{label}</h4>
        <div className="flex items-end space-x-1 h-20">
          {data.map((value, index) => {
            const height = ((value - min) / (max - min)) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className={`w-full ${color} rounded-t transition-all duration-500 hover:opacity-80`}
                  style={{ height: `${Math.max(height, 10)}%` }}
                  title={`${weeklyData?.days[index] || 'Day'}: ${value}%`}
                ></div>
                <span className="text-xs text-gray-500 mt-1">{weeklyData?.days[index] || 'Day'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const DonutChart = ({ percentage, label, color }: { percentage: number, label: string, color: string }) => {
    const circumference = 2 * Math.PI * 40;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{percentage}%</span>
          </div>
        </div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
    );
  };



  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-blue-100 text-lg">
            Welcome back! Here's what's happening at your school today.
          </p>
        </div>
        <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-white/5 animate-bounce"></div>
        <div className="absolute right-1/4 top-1/2 h-16 w-16 rounded-full bg-white/5 animate-ping"></div>
        <div className="absolute left-1/3 top-1/4 h-20 w-20 rounded-full bg-white/10 animate-pulse" style={{animationDelay: '1s'}}></div>
      </section>

      {/* Stats Grid */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <div key={stat.label} className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate/10 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color} text-white text-xl`}>
                {stat.icon}
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {stat.change}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {isLoading ? '...' : isError ? 'N/A' : stat.value}
              </p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-center p-6 bg-white rounded-2xl border border-slate/10 hover:border-blue-200 hover:shadow-md transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-xl group-hover:bg-blue-100 transition-colors">
                {action.icon}
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics Section */}
      <section className="grid gap-8 lg:grid-cols-3">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate/10 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Analytics</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <SimpleChart 
                data={weeklyData?.attendance || [0, 0, 0, 0, 0, 0, 0]} 
                color="bg-blue-500" 
                label="Attendance Rate" 
              />
              <SimpleChart 
                data={weeklyData?.performance || [0, 0, 0, 0, 0, 0, 0]} 
                color="bg-green-500" 
                label="Performance Score" 
              />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate/10 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Enrollment Trend</h2>
            <SimpleChart 
              data={weeklyData?.enrollment || [0, 0, 0, 0, 0, 0, 0]} 
              color="bg-purple-500" 
              label="Total Students" 
            />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate/10 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance Metrics</h2>
            <div className="space-y-6">
              <DonutChart 
                percentage={performanceData?.overallScore || 0} 
                label="Overall Score" 
                color="#3b82f6" 
              />
              <DonutChart 
                percentage={performanceData?.attendanceRate || 0} 
                label="Attendance" 
                color="#10b981" 
              />
              <DonutChart 
                percentage={performanceData?.satisfactionRate || 0} 
                label="Satisfaction" 
                color="#f59e0b" 
              />
            </div>
          </div>
          
          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate/10 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {(auditData?.items || []).map((log) => (
                <div key={log.id} className="flex items-center space-x-3">
                  <div className={`h-2 w-2 rounded-full ${
                    log.action === 'CREATE' ? 'bg-green-500' : 
                    log.action === 'UPDATE' ? 'bg-blue-500' : 
                    log.action === 'DELETE' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {log.action} {log.entityType.toLowerCase()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


    </div>
  );
}
