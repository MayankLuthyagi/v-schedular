'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function InitialPage() {
    const router = useRouter();

    const handleGoToLogin = () => {
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                {/* Main Image */}
                <div className="mb-6">
                    <Image
                        src="https://plus.unsplash.com/premium_photo-1681487814165-018814e29155?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bG9naW58ZW58MHx8MHx8fDA%3D"
                        alt="Welcome"
                        width={400}
                        height={300}
                        className="w-full h-64 object-cover rounded-lg"
                    />
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Schedule</h2>
                    <p className="text-gray-600">Get started with your scheduling application</p>
                </div>

                {/* Action Button */}
                <div className="space-y-3">
                    <button
                        onClick={handleGoToLogin}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                    >
                        Get Started
                    </button>
                </div>

                {/* Info Text */}
                <p className="text-xs text-gray-500 text-center mt-4">
                    Sign in with your Google account to continue
                </p>
            </div>
        </div>
    );
}