'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SiteSettings } from '@/types/settings';
import { applyThemeColor } from '@/lib/theme';

interface ThemeContextType {
    settings: SiteSettings;
    refreshSettings: () => Promise<void>;
    isLoading: boolean;
    isDarkMode: boolean;
    toggleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>({
        themeColor: '#3b82f6',
        themeMode: 'light',
        textLogo: undefined,
        logo: undefined,
        featureAllowed: { emailLogs: false, campaign: false }
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();

            if (data.success) {
                console.log('Fetched settings:', data.settings); // Debug log
                setSettings(data.settings);

                // Apply theme color to CSS variables
                if (typeof window !== 'undefined') {
                    applyThemeColor(data.settings.themeColor);
                }

                // Apply theme mode to document
                applyThemeMode(data.settings.themeMode || 'light');
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            // Apply default light mode if fetch fails
            applyThemeMode('light');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const applyThemeMode = (mode: 'light' | 'dark') => {
        // Ensure we're in the browser
        if (typeof window === 'undefined') return;

        const htmlElement = document.documentElement;

        if (mode === 'dark') {
            htmlElement.classList.add('dark');
        } else {
            // For light mode, just remove the dark class
            htmlElement.classList.remove('dark');
        }

        // Also store in localStorage for persistence
        localStorage.setItem('themeMode', mode);

        console.log(`Applied theme: ${mode}, HTML classes:`, htmlElement.className);
    };

    const toggleThemeMode = async () => {
        const newMode = settings.themeMode === 'light' ? 'dark' : 'light';
        console.log('Toggling theme from', settings.themeMode, 'to', newMode); // Debug log

        // Apply theme immediately for better UX
        applyThemeMode(newMode);
        setSettings(prev => ({ ...prev, themeMode: newMode }));

        try {
            const formData = new FormData();
            formData.append('themeColor', settings.themeColor);
            formData.append('themeMode', newMode);

            const response = await fetch('/api/settings', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                // If API call fails, revert the change
                console.error('Failed to save theme mode to server');
                const oldMode = newMode === 'light' ? 'dark' : 'light';
                applyThemeMode(oldMode);
                setSettings(prev => ({ ...prev, themeMode: oldMode }));
            } else {
                console.log('Theme mode saved successfully to server'); // Debug log
            }
        } catch (error) {
            console.error('Error updating theme mode:', error);
            // If API call fails, revert the change
            const oldMode = newMode === 'light' ? 'dark' : 'light';
            applyThemeMode(oldMode);
            setSettings(prev => ({ ...prev, themeMode: oldMode }));
        }
    };

    useEffect(() => {
        // First, check localStorage for immediate theme application
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('themeMode');
            if (savedTheme === 'dark' || savedTheme === 'light') {
                applyThemeMode(savedTheme);
                setSettings(prev => ({ ...prev, themeMode: savedTheme }));
            } else {
                // If no saved theme, ensure light mode is applied
                applyThemeMode('light');
            }
        }

        // Then fetch settings from API
        fetchSettings();
    }, [fetchSettings]);

    const refreshSettings = async () => {
        await fetchSettings();
    };

    const isDarkMode = settings.themeMode === 'dark';

    return (
        <ThemeContext.Provider value={{ settings, refreshSettings, isLoading, isDarkMode, toggleThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useFeatureAllowed(feature: keyof SiteSettings['featureAllowed']): boolean {
    const { settings } = useTheme();
    return settings.featureAllowed ? settings.featureAllowed[feature] : false;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}