'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

interface UserInfoProps {
    showLogout?: boolean;
    className?: string;
}

export default function UserInfo({ showLogout = true, className = '' }: UserInfoProps) {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <div className={`flex items-center space-x-3 ${className}`}>
            {user.photoURL && (
                <Image
                    src={user.photoURL}
                    alt="Profile"
                    width={40}
                    height={40}
                    className="rounded-full"
                />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName || 'User'}
                </p>
                <p className="text-sm text-gray-500 truncate">
                    {user.email}
                </p>
            </div>
            {showLogout && (
                <button
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium transition duration-200"
                >
                    Logout
                </button>
            )}
        </div>
    );
}