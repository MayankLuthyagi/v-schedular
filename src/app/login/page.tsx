'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || (
        typeof window !== 'undefined' && window.location.origin
            ? `${window.location.origin}/api`
            : '/api'
    );

    // Handle successful sign-in (shared between popup and redirect)
    const handleSuccessfulSignIn = useCallback(async (user: User) => {
        if (!user || !user.email) {
            throw new Error('No user information received');
        }

        // Fetch authorized emails with retry logic and fallback for ad blockers
        let response;
        let emailData;

        try {
            // Create a timeout promise for older browsers
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 10000);
            });

            const fetchPromise = fetch(`${API_BASE_URL}/authUsers`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    // Add custom headers to avoid ad blocker detection
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            emailData = await response.json();
        } catch (fetchError) {
            console.error('Error fetching auth users:', fetchError);
            
            // If the primary fetch fails, try with different endpoint
            try {
                const fallbackResponse = await fetch('/api/authUsers', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                if (fallbackResponse.ok) {
                    emailData = await fallbackResponse.json();
                } else {
                    throw new Error('Fallback request failed');
                }
            } catch (fallbackError) {
                console.error('Fallback request also failed:', fallbackError);
                setError('Unable to verify user permissions. Please disable ad blockers and try again.');
                await auth.signOut();
                return;
            }
        }

        // Validate email
        if (emailData?.success && emailData.users && emailData.users.some((userData: { email: string }) => userData.email === user.email)) {
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userName', user.displayName || '');
            localStorage.setItem('userPhoto', user.photoURL || '');

            // Navigate to dashboard
            router.push('/dashboard');
        } else {
            setError('Unauthorized user');
            alert('Access Denied 🛑\n\nYou don\u0027t have access to this page.');
            await auth.signOut();
        }
    }, [API_BASE_URL, router]);

    // Clear any existing auth state on component mount and handle redirect result
    useEffect(() => {
        const clearAuthState = async () => {
            try {
                await auth.signOut();
            } catch {
                console.log('No existing auth state to clear');
            }
        };

        const handleRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result && result.user) {
                    // Handle successful redirect sign-in
                    await handleSuccessfulSignIn(result.user);
                }
            } catch (error) {
                console.error('Error handling redirect result:', error);
                setError('Sign-in failed after redirect. Please try again.');
            }
        };

        clearAuthState();
        handleRedirectResult();
    }, [handleSuccessfulSignIn]);    // Sign in with Google (with fallback to redirect)
    const signInWithGoogle = async () => {
        if (isLoading) return; // Prevent multiple simultaneous calls

        setIsLoading(true);
        setError('');

        try {
            // Sign out any existing user first to clear cached credentials
            await auth.signOut();

            // Wait a bit to ensure sign out is complete
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                // Try popup first
                const result = await signInWithPopup(auth, googleProvider);
                await handleSuccessfulSignIn(result.user);
            } catch (popupError: unknown) {
                console.error('Popup sign-in failed:', popupError);

                // If popup fails, try redirect
                if (popupError && typeof popupError === 'object' && 'code' in popupError) {
                    const firebaseError = popupError as { code: string };
                    if (firebaseError.code === 'auth/popup-blocked' || firebaseError.code === 'auth/popup-closed-by-user') {
                        console.log('Popup blocked, trying redirect method...');
                        setError('Popup blocked. Redirecting to Google sign-in...');

                        // Use redirect as fallback
                        await signInWithRedirect(auth, googleProvider);
                        return; // Don't continue execution as redirect will handle the rest
                    }
                }
                throw popupError; // Re-throw other errors
            }
        } catch (error: unknown) {
            console.error('Error during sign-in:', error);

            // Handle specific Firebase errors
            if (error && typeof error === 'object' && 'code' in error) {
                const firebaseError = error as { code: string };
                if (firebaseError.code === 'auth/popup-closed-by-user') {
                    setError('Sign-in was cancelled');
                } else if (firebaseError.code === 'auth/popup-blocked') {
                    setError('Pop-up was blocked. Please allow pop-ups and try again');
                } else if (firebaseError.code === 'auth/missing-or-invalid-nonce') {
                    setError('Authentication error. Please refresh the page and try again');
                } else {
                    setError('Sign-in failed, please try again');
                }
            } else {
                setError('Sign-in failed, please try again');
            }

            // Ensure user is signed out on error
            try {
                await auth.signOut();
            } catch (signOutError) {
                console.error('Error signing out:', signOutError);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Navigate to Admin Panel
    const goToAdminPanel = () => {
        router.push('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                {/* Main Image */}
                <div className="mb-6">
                    <Image
                        src="https://plus.unsplash.com/premium_photo-1681487814165-018814e29155?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bG9naW58ZW58MHx8MHx8fDA%3D"
                        alt="Login"
                        width={400}
                        height={300}
                        className="w-full h-64 object-cover rounded-lg"
                    />
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome</h2>
                    <p className="text-gray-600">Sign in to access your dashboard</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                        {error.includes('ad blocker') && (
                            <div className="mt-2 text-sm">
                                <p>If you&apos;re using an ad blocker, please:</p>
                                <ul className="list-disc list-inside mt-1">
                                    <li>Disable it for this site</li>
                                    <li>Or add this site to your whitelist</li>
                                    <li>Then refresh the page and try again</li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Sign-in Options */}
                <div className="space-y-4">
                    {/* Admin Panel Button */}
                    <button
                        onClick={goToAdminPanel}
                        className="w-full bg-gray-800 hover:bg-gray-900 cursor-pointer text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                    >
                        Admin Panel
                    </button>

                    {/* Sign in with Google Button */}
                    <button
                        onClick={signInWithGoogle}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-3"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <Image
                                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                                alt="Google logo"
                                width={20}
                                height={20}
                                className="w-5 h-5"
                            />
                        )}
                        {isLoading ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                </div>
            </div>
        </div>
    );
}