'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthUser {
    sub: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (token: string, user: AuthUser) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: async () => { },
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('userToken');

            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/auth/verify?role=user', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    setUser(data.user as AuthUser);
                } else {
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('userProfile');
                    setUser(null);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = (token: string, userData: AuthUser) => {
        localStorage.setItem('userToken', token);
        localStorage.setItem('userProfile', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        try {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userProfile');
            setUser(null);

            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const value = {
        user,
        loading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};