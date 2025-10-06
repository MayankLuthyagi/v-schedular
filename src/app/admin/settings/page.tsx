'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import DashboardLayout from '@/components/admin/DashboardLayout';
import { SiteSettings } from '@/types/settings';
import { useTheme } from '@/contexts/ThemeContext';
import { FiUpload, FiSave } from 'react-icons/fi';

export default function AdminSettingsPage() {
    const { settings: themeSettings, refreshSettings, toggleThemeMode } = useTheme();
    const [settings, setSettings] = useState<SiteSettings>({
        themeColor: '#3b82f6',
        themeMode: 'light',
        textLogo: undefined,
        logo: undefined,
        featureAllowed: {
            emailLogs: false,
            campaign: false,
        }
    });
    const [formData, setFormData] = useState({
        themeColor: '#3b82f6',
        themeMode: 'light' as 'light' | 'dark',
        textLogo: null as File | null,
        logo: null as File | null,
        featureAllowed: {
            emailLogs: false,
            campaign: false,
        },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (themeSettings) {
            setFormData(prev => ({
                ...prev,
                themeColor: themeSettings.themeColor,
                themeMode: themeSettings.themeMode || 'light'
            }));
        }
    }, [themeSettings]);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();

            if (data.success) {
                setSettings(data.settings);
                setFormData({
                    themeColor: data.settings.themeColor,
                    themeMode: data.settings.themeMode || 'light',
                    textLogo: null,
                    logo: null,
                    featureAllowed: data.settings.featureAllowed || { emailLogs: false, campaign: false }
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        } finally {
            setLoading(false);
        }
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setFormData(prev => ({ ...prev, themeColor: newColor }));
        document.documentElement.style.setProperty('--theme-color', newColor);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'textLogo' | 'logo') => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.includes('png')) {
                setMessage({ type: 'error', text: 'Only PNG files are allowed' });
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setMessage({ type: 'error', text: 'File size must be less than 5MB' });
                return;
            }
            setFormData(prev => ({ ...prev, [type]: file }));
            setMessage(null);
        }
    };

    const handleFeatureToggle = (feature: keyof typeof formData.featureAllowed) => {
        setFormData(prev => ({
            ...prev,
            featureAllowed: {
                ...prev.featureAllowed,
                [feature]: !prev.featureAllowed[feature],
            }
        }));
    };

    const handleThemeModeChange = async (mode: 'light' | 'dark') => {
        setFormData(prev => ({ ...prev, themeMode: mode }));
        if (mode !== themeSettings.themeMode) {
            await toggleThemeMode();
            await refreshSettings();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const submitFormData = new FormData();
            submitFormData.append('themeColor', formData.themeColor);
            submitFormData.append('themeMode', formData.themeMode);

            if (formData.textLogo) {
                submitFormData.append('textLogo', formData.textLogo);
            }
            if (formData.logo) {
                submitFormData.append('logo', formData.logo);
            }

            // Append feature allowed data
            submitFormData.append('emailLogs', String(formData.featureAllowed.emailLogs));
            submitFormData.append('campaign', String(formData.featureAllowed.campaign));

            const response = await fetch('/api/settings', {
                method: 'POST',
                body: submitFormData
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Settings updated successfully!' });
                setSettings(data.settings);
                setFormData(prev => ({ ...prev, textLogo: null, logo: null }));

                const textLogoInput = document.getElementById('textLogo') as HTMLInputElement;
                const logoInput = document.getElementById('logo') as HTMLInputElement;
                if (textLogoInput) textLogoInput.value = '';
                if (logoInput) logoInput.value = '';

                setTimeout(() => window.location.reload(), 1000);
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to update settings' });
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            setMessage({ type: 'error', text: 'Failed to update settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminProtectedRoute>
                <DashboardLayout>
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
                        <div className="space-y-6">
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    </div>
                </DashboardLayout>
            </AdminProtectedRoute>
        );
    }

    return (
        <AdminProtectedRoute>
            <DashboardLayout>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Site Settings</h1>

                    {message && (
                        <div className={`mb-6 p-4 rounded-md transition-theme ${message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Theme Color Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-theme">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Theme Color</h2>
                            <div className="flex items-center space-x-4">
                                <div className="flex-1">
                                    <label htmlFor="themeColor" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                                        Choose your site's primary color
                                    </label>
                                    <div className="flex items-center space-x-3">
                                        <input type="color" id="themeColor" value={formData.themeColor} onChange={handleColorChange} className="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" />
                                        <input type="text" value={formData.themeColor} onChange={(e) => setFormData(prev => ({ ...prev, themeColor: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 transition-theme" style={{ '--tw-ring-color': formData.themeColor } as React.CSSProperties} placeholder="#3b82f6" />
                                    </div>
                                </div>
                                <div className="w-24 h-24 rounded-lg border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center" style={{ backgroundColor: formData.themeColor }}>
                                    <span className="text-white text-xs font-medium">Preview</span>
                                </div>
                            </div>
                        </div>

                        {/* Feature Management Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-theme">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Feature Management</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Enable or disable specific features across the site.</p>
                            <div className="space-y-4">
                                {/* Email Logs Toggle */}
                                <label htmlFor="emailLogs-toggle" className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">Email Logs</span>
                                    <div className="relative">
                                        <input id="emailLogs-toggle" type="checkbox" className="sr-only" checked={formData.featureAllowed.emailLogs} onChange={() => handleFeatureToggle('emailLogs')} />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.featureAllowed.emailLogs ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.featureAllowed.emailLogs ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                                {/* Campaign Toggle */}
                                <label htmlFor="campaign-toggle" className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">Campaign</span>
                                    <div className="relative">
                                        <input id="campaign-toggle" type="checkbox" className="sr-only" checked={formData.featureAllowed.campaign} onChange={() => handleFeatureToggle('campaign')} />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.featureAllowed.campaign ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.featureAllowed.campaign ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Theme Mode Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-theme">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Theme Mode</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Choose between light and dark mode for the system interface.</p>
                            <div className="flex space-x-4">
                                <button type="button" onClick={() => handleThemeModeChange('light')} className={`flex-1 text-center px-4 py-3 rounded-lg border-2 transition-all ${themeSettings.themeMode === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'}`}>
                                    <div className="font-medium">Light Mode</div>
                                </button>
                                <button type="button" onClick={() => handleThemeModeChange('dark')} className={`flex-1 text-center px-4 py-3 rounded-lg border-2 transition-all ${themeSettings.themeMode === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'}`}>
                                    <div className="font-medium">Dark Mode</div>
                                </button>
                            </div>
                        </div>

                        {/* Logo Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-theme">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Main Logo</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <label htmlFor="logo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Upload Main Logo (PNG only & 5MB max)
                                    </label>
                                    <input type="file" id="logo" accept=".png" onChange={(e) => handleFileChange(e, 'logo')} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                </div>
                                <div className="flex items-center justify-center md:justify-end">
                                    {settings.logo ? (
                                        <div className="text-center">
                                            <img src={`/uploads/${settings.logo}?t=${Date.now()}`} alt="Current Logo" className="max-w-full max-h-12 object-contain mx-auto mb-2" />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Current Logo</p>
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                                            <FiUpload className="text-gray-400" size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Text Logo Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-theme">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Text Logo</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <label htmlFor="textLogo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Upload Text Logo (PNG only & 5MB max)
                                    </label>
                                    <input type="file" id="textLogo" accept=".png" onChange={(e) => handleFileChange(e, 'textLogo')} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                </div>
                                <div className="flex items-center justify-center md:justify-end">
                                    {settings.textLogo ? (
                                        <div className="text-center">
                                            <img src={`/uploads/${settings.textLogo}?t=${Date.now()}`} alt="Current Text Logo" className="max-w-full max-h-12 object-contain mx-auto mb-2" />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Current Text Logo</p>
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                                            <FiUpload className="text-gray-400" size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <button type="submit" disabled={saving} style={{ backgroundColor: formData.themeColor }} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                                {saving ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FiSave className="mr-2" />
                                        Save Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
        </AdminProtectedRoute>
    );
}
