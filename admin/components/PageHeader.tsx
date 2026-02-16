'use client';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-8 shadow-xl text-center">
      <h1 className="text-4xl font-bold text-white mb-2">
        {title}
      </h1>
      {subtitle && (
        <p className="text-lg text-blue-100">
          {subtitle}
        </p>
      )}
    </div>
  );
}
