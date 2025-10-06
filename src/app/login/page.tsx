'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

// --- Custom Hook for Authentication Logic ---
const useAuth = () => {
    const router = useRouter();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true); // Start true to handle redirect check

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

    const handleSuccessfulSignIn = useCallback(async (user: User) => {
        setIsLoading(true);
        setError('');
        if (!user || !user.email) {
            setError('Authentication failed. No user information received.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/authUsers`);
            if (!response.ok) {
                throw new Error(`Failed to fetch user permissions. Status: ${response.status}`);
            }
            const authData = await response.json();

            const isAuthorized = authData?.users?.some(
                (authorizedUser: { email: string }) => authorizedUser.email === user.email
            );

            if (isAuthorized) {
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userName', user.displayName || '');
                localStorage.setItem('userPhoto', user.photoURL || '');
                router.push('/dashboard');
            } else {
                setError('Access Denied. Your email is not authorized.');
                await auth.signOut();
            }
        } catch (err) {
            console.error('Authorization check failed:', err);
            setError('Could not verify user permissions. Please check your connection and try again.');
            await auth.signOut();
        } finally {
            setIsLoading(false);
        }
    }, [router, API_BASE_URL]);

    const signInWithGoogle = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setError('');

        try {
            await auth.signOut(); // Ensure clean login
            const result = await signInWithPopup(auth, googleProvider);
            await handleSuccessfulSignIn(result.user);
        } catch (popupError: unknown) {
            const error = popupError as { code?: string; message?: string };
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                console.log('Popup failed, falling back to redirect.');
                await signInWithRedirect(auth, googleProvider);
            } else {
                console.error('Google Sign-In Error:', popupError);
                setError('Sign-in failed. Please try again.');
                setIsLoading(false);
            }
        }
    };

    // Effect to handle the result of a redirect sign-in
    useEffect(() => {
        getRedirectResult(auth)
            .then((result) => {
                if (result && result.user) {
                    handleSuccessfulSignIn(result.user);
                } else {
                    setIsLoading(false); // No redirect result, stop loading
                }
            })
            .catch((err) => {
                console.error('Redirect result error:', err);
                setError('Failed to process sign-in after redirect.');
                setIsLoading(false);
            });
    }, [handleSuccessfulSignIn]);


    return { error, isLoading, signInWithGoogle };
};


// --- Refactored LoginPage Component ---
export default function LoginPage() {
    const router = useRouter();
    const { error, isLoading, signInWithGoogle } = useAuth();
    const { settings, isLoading: themeLoading } = useTheme();

    if (themeLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 space-y-6">

                {/* Header */}
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
                    <p className="text-gray-600 mt-2">Sign in to manage your email campaigns</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-lg text-sm">
                        <p className="font-semibold">Authentication Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    <button
                        onClick={signInWithGoogle}
                        disabled={isLoading}
                        style={{ backgroundColor: settings.themeColor }}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <Image
                                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                                alt="Google logo"
                                width={20}
                                height={20}
                            />
                        )}
                        <span>{isLoading ? 'Authenticating...' : 'Sign in with Google'}</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or</span>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            // Check if admin is already logged in via localStorage
                            const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn');
                            const adminUser = localStorage.getItem('adminUser');

                            if (isAdminLoggedIn === 'true' && adminUser) {
                                // Admin is already logged in, go directly to admin panel
                                router.push('/admin');
                            } else {
                                // Admin not logged in, go to admin login page
                                router.push('/admin/login');
                            }
                        }}
                        className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 cursor-pointer"
                    >
                        Admin Panel Login
                    </button>
                </div>
            </div>
        </div>
    );
}