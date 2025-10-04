'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
            const adminUser = localStorage.getItem('adminUser');

            if (isLoggedIn === 'true' && adminUser) {
                setIsAdminAuthenticated(true);
            } else {
                router.push('/admin/login');
            }
            setIsLoading(false);
        }
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!isAdminAuthenticated) {
        return null; // Will redirect to login
    }

    return <>{children}</>;
}