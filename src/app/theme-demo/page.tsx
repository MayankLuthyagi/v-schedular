'use client';

import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';

export default function ThemeDemo() {
    const { settings, isLoading } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header with logos */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            {settings.logo && (
                                <Image
                                    src={`/uploads/${settings.logo}?t=${Date.now()}`}
                                    alt="Logo"
                                    width={48}
                                    height={48}
                                    className="object-contain"
                                />
                            )}
                            {settings.textLogo && (
                                <Image
                                    src={`/uploads/${settings.textLogo}?t=${Date.now()}`}
                                    alt="Text Logo"
                                    width={128}
                                    height={32}
                                    className="object-contain"
                                />
                            )}
                            {!settings.logo && !settings.textLogo && (
                                <h1 className="text-2xl font-bold text-gray-900">Your App</h1>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            Theme: <span style={{ color: settings.themeColor }}>{settings.themeColor}</span>
                        </div>
                    </div>
                </div>

                {/* Theme Demo Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-6">Dynamic Theme Demo</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Primary Button */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Primary Button</h3>
                            <button
                                style={{ backgroundColor: settings.themeColor }}
                                className="w-full px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                            >
                                Primary Action
                            </button>
                        </div>

                        {/* Text with Theme Color */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Themed Text</h3>
                            <p style={{ color: settings.themeColor }} className="font-semibold">
                                This text uses the theme color
                            </p>
                        </div>

                        {/* Border with Theme Color */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Themed Border</h3>
                            <div
                                style={{ borderColor: settings.themeColor }}
                                className="border-2 p-4 rounded-md text-center"
                            >
                                Themed border
                            </div>
                        </div>

                        {/* Background with Theme Color */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Themed Background</h3>
                            <div
                                style={{ backgroundColor: `${settings.themeColor}20` }}
                                className="p-4 rounded-md text-center"
                            >
                                Light background
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Progress Bar</h3>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="h-2 rounded-full transition-all duration-300"
                                    style={{ width: '70%', backgroundColor: settings.themeColor }}
                                ></div>
                            </div>
                        </div>

                        {/* Badge */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Badge</h3>
                            <span
                                style={{ backgroundColor: settings.themeColor }}
                                className="inline-flex px-2 py-1 text-xs font-semibold text-white rounded-full"
                            >
                                New
                            </span>
                        </div>
                    </div>
                </div>

                {/* Card with Theme Accents */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div
                        style={{ backgroundColor: settings.themeColor }}
                        className="h-2"
                    ></div>
                    <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Card</h3>
                        <p className="text-gray-600 mb-4">
                            This card demonstrates how the theme color can be used as an accent.
                            The top border uses the dynamic theme color, creating a consistent
                            visual identity across your application.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                style={{ backgroundColor: settings.themeColor }}
                                className="px-4 py-2 text-white text-sm rounded-md hover:opacity-90 transition-opacity"
                            >
                                Primary
                            </button>
                            <button
                                style={{
                                    color: settings.themeColor,
                                    borderColor: settings.themeColor
                                }}
                                className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Secondary
                            </button>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
                    <ul className="text-blue-800 space-y-2 text-sm">
                        <li>• Go to Admin Settings to change the theme color</li>
                        <li>• Upload your logo and text logo (PNG files only)</li>
                        <li>• The theme color is stored in the database and applied globally</li>
                        <li>• Changes are reflected immediately across the entire application</li>
                        <li>• CSS variables are updated dynamically using JavaScript</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}