"use client";

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  subtitle?: string;
  loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color = 'blue',
  subtitle,
  loading = false,
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const changeColor = changeType === 'increase' ? 'text-green-600' : 'text-red-600';
  const ChangeIcon = changeType === 'increase' ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>

          {loading ? (
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          )}

          {loading ? (
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
          ) : (
            subtitle && <p className="text-xs text-gray-500">{subtitle}</p>
          )}

          {loading ? (
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mt-2" />
          ) : (
            change !== undefined && (
              <div className={`flex items-center mt-2 ${changeColor}`}>
                <ChangeIcon className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">{Math.abs(change)}%</span>
                <span className="text-xs text-gray-500 ml-1">vs 지난주</span>
              </div>
            )
          )}
        </div>

        <div
          className={`w-12 h-12 bg-gradient-to-r ${colorClasses[color]} rounded-lg flex items-center justify-center shadow-lg`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;