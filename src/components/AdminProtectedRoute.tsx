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
        const verifyAdmin = async () => {
            const token = localStorage.getItem('adminToken');

            if (!token) {
                setIsAdminAuthenticated(false);
                setIsLoading(false);
                router.push('/admin/login');
                return;
            }

            try {
                const response = await fetch('/api/auth/verify?role=admin', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    setIsAdminAuthenticated(true);
                } else {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminProfile');
                    setIsAdminAuthenticated(false);
                    router.push('/admin/login');
                }
            } catch (error) {
                console.error('Admin token verification failed:', error);
                setIsAdminAuthenticated(false);
                router.push('/admin/login');
            } finally {
                setIsLoading(false);
            }
        };

        if (typeof window !== 'undefined') {
            verifyAdmin();
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