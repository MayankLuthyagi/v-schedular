import Link from 'next/link';
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    link?: string;
    linkLabel?: string;
    color: 'blue' | 'green' | 'purple' | 'white';
}

const colorVariants = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
        text: 'text-blue-800 dark:text-blue-300',
        button: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
    },
    green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-700',
        text: 'text-green-800 dark:text-green-300',
        button: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-700',
        text: 'text-purple-800 dark:text-purple-300',
        button: 'bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700',
    },
    white: {
        bg: 'bg-white dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-800 dark:text-gray-100',
        button: 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600',
    }
};

export default function StatCard({ title, value, icon, link, linkLabel, color }: StatCardProps) {
    const variants = colorVariants[color];
    const { settings } = useTheme();
    return (
        <div className={`${variants.bg} ${variants.border} border rounded-lg p-6 shadow-sm flex flex-col justify-between transition-colors`}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className={`text-lg font-semibold ${variants.text}`}>{title}</h3>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
                </div>
                {icon}
            </div>
            {link && linkLabel && (
                <Link href={link} style={{ backgroundColor: settings.themeColor }} className={`mt-4 w-full flex items-center justify-center gap-4 py-2 px-3 text-white rounded-lg shadow-md transition-transform transform hover:scale-105 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variants.button}`}>
                    {linkLabel}
                </Link>
            )}
        </div>
    );
}