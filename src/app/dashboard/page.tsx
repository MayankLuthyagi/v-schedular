'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

// --- (Place these in separate files for best practice) ---
// e.g., @/hooks/useCampaigns.ts
// e.g., @/hooks/useDashboardStats.ts
// e.g., @/components/Notification.tsx

// --- Types (assuming they are in @/types/) ---
import { CampaignFormData, Campaign } from '@/types/campaign';
import { EmailLog } from '@/types/emailLog';

// --- Context ---
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useFeatureAllowed } from '@/contexts/ThemeContext';

// --- Components ---
import ProtectedRoute from '@/components/ProtectedRoute';
import CampaignForm from '@/components/CampaignForm';
import { FiMail, FiCheckCircle, FiAlertCircle, FiX, FiBarChart, FiEye, FiRefreshCw } from 'react-icons/fi';

// --- Data Fetching Hooks --------------------------------------------------

/**
 * Custom hook to manage campaign data and API interactions.
 */
const useCampaigns = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCampaigns = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/campaigns');
            if (!response.ok) throw new Error('Failed to fetch campaigns.');
            const data = await response.json();
            setCampaigns(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const handleApiCall = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: BodyInit) => {
        try {
            const response = await fetch(endpoint, { method, body });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to perform operation.`);
            }
            await fetchCampaigns(); // Refresh data on success
            return { success: true, data: await response.json() };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : 'An error occurred' };
        }
    };

    const addOrUpdateCampaign = (campaignData: CampaignFormData, editingCampaign: Campaign | null) => {
        const formData = new FormData();
        // Append all fields to formData...
        Object.entries(campaignData).forEach(([key, value]) => {
            if (key === 'attachment' && value) {
                formData.append(key, value as File);
            } else if (Array.isArray(value)) {
                formData.append(key, JSON.stringify(value));
            } else if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        });

        if (editingCampaign) {
            formData.append('campaignId', editingCampaign.campaignId);
            return handleApiCall('/api/campaigns', 'PUT', formData);
        } else {
            return handleApiCall('/api/campaigns', 'POST', formData);
        }
    };

    const deleteCampaign = (campaignId: string) => {
        return handleApiCall(`/api/campaigns?campaignId=${campaignId}`, 'DELETE');
    };

    return { campaigns, isLoading, error, addOrUpdateCampaign, deleteCampaign, refresh: fetchCampaigns };
};

/**
 * Custom hook to fetch and compute dashboard stats.
 */
const useDashboardStats = () => {
    const [stats, setStats] = useState({
        sent: 0,
        total: 0,
        sentOpened: 0,
        opened: 0,
        sentPercentage: '0.00',
        openRate: '0.00'
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/emailLog?status=today&limit=5000');
                if (!response.ok) return;
                const data = await response.json();
                const emailLogs: EmailLog[] = data.logs || [];

                const total = emailLogs.length;
                const sentLogs = emailLogs.filter(e => e.status === 'sent' || e.status === 'opened');
                const openedSentLogs = emailLogs.filter(e => (e.status === 'sent' || e.status === 'opened') && e.sendMethod !== 'cc' && e.sendMethod !== 'bcc');
                const openedLogs = emailLogs.filter(e => e.status === 'opened' && e.sendMethod !== 'cc' && e.sendMethod !== 'bcc');

                const sent = sentLogs.length;
                const opened = openedLogs.length;
                const sentOpened = openedSentLogs.length;

                setStats({
                    sent,
                    total,
                    sentOpened,
                    opened,
                    sentPercentage: total > 0 ? ((sent / total) * 100).toFixed(1) : '0.00',
                    openRate: sentOpened > 0 ? ((opened / sentOpened) * 100).toFixed(1) : '0.00'
                });

            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    return { stats, isLoading };
};

/**
 * Custom hook to manage email logs and API interactions.
 */
type LogFilter = 'all' | 'today' | 'failed' | 'sent' | 'opened' | 'bounced';
const useEmailLogs = () => {
    const [logs, setLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State for filtering and pagination
    const [filter, setFilter] = useState<LogFilter>('today');
    const [searchTerm, setSearchTerm] = useState('');
    // Campaign filter (empty = all)
    const [campaignFilter, setCampaignFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = useCallback(async (currentFilter: LogFilter, currentSearch: string, currentPage: number, currentCampaign?: string) => {
        setLoading(true);
        setError('');
        try {
            // Construct URL with server-side filtering parameters
            const params = new URLSearchParams();
            if (currentFilter !== 'all') {
                params.append('status', currentFilter);
            }
            if (currentSearch) {
                params.append('search', currentSearch);
            }
            if (currentCampaign) {
                params.append('campaignId', currentCampaign);
            }
            params.append('page', String(currentPage));
            params.append('limit', '20'); // Example: 20 logs per page

            const response = await fetch(`/api/emailLog?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                setLogs(data.logs || []);
                setTotalPages(data.totalPages || 1);
            } else {
                throw new Error(data.error || 'Failed to fetch logs.');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect to refetch when filters change
    useEffect(() => {
        // Debounce search term and campaign selection to avoid excessive API calls
        const handler = setTimeout(() => {
            fetchLogs(filter, searchTerm, page, campaignFilter);
        }, 300); // 300ms delay

        return () => clearTimeout(handler);
    }, [filter, searchTerm, page, campaignFilter, fetchLogs]);

    const deleteAllLogs = async () => {
        try {
            const response = await fetch('/api/emailLog', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to delete all logs');
            fetchLogs(filter, searchTerm, page, campaignFilter); // Refresh logs on success (respect campaign filter)
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : 'An error occurred' };
        }
    };

    return {
        logs, loading, error,
        filter, setFilter,
        searchTerm, setSearchTerm,
        campaignFilter, setCampaignFilter,
        page, setPage, totalPages,
        refresh: () => fetchLogs(filter, searchTerm, page, campaignFilter),
        deleteAllLogs,
    };
};


// --- UI Components --------------------------------------------------------

type NotificationType = 'success' | 'error';
interface NotificationState {
    message: string;
    type: NotificationType;
}

const Notification = ({ info, onDismiss, themeColor }: { info: NotificationState | null; onDismiss: () => void; themeColor: string }) => {
    if (!info) return null;

    const isSuccess = info.type === 'success';
    const bgColor = isSuccess ? themeColor : '#ef4444'; // Use theme color for success, red for error
    const Icon = isSuccess ? FiCheckCircle : FiAlertCircle;

    return (
        <div className="fixed top-5 right-5 z-50 flex items-center p-4 rounded-lg shadow-lg text-white" style={{ backgroundColor: bgColor }}>
            <Icon className="w-6 h-6 mr-3" />
            <p>{info.message}</p>
            <button onClick={onDismiss} className="ml-4 p-1 rounded-full hover:bg-white/20">
                <FiX className="w-5 h-5" />
            </button>
        </div>
    );
};


// --- Main Dashboard Page Component ----------------------------------------

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const { settings, isLoading: themeLoading } = useTheme();

    // Feature flags
    const emailTemplateAllowed = useFeatureAllowed('emailTemplate');
    const emailLogsAllowed = useFeatureAllowed('emailLogs');
    const campaignAllowed = useFeatureAllowed('campaign');
    const oneTimeBroadcastAllowed = useFeatureAllowed('oneTimeBroadcast');
    const dateBasedAutomationAllowed = useFeatureAllowed('dateBasedAutomation');

    // State for UI interactivity
    const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
    const [notification, setNotification] = useState<NotificationState | null>(null);
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [isDeleteAllModalOpen, setDeleteAllModalOpen] = useState(false);

    // Sidebar state - Dashboard is now the main home page
    const [activeSection, setActiveSection] = useState<'dashboard' | 'email-templates' | 'campaigns' | 'one-time-broadcast' | 'date-based-automation'>('dashboard');

    // Using our custom hooks
    const { campaigns, isLoading: campaignsLoading, addOrUpdateCampaign, deleteCampaign } = useCampaigns();
    const { stats, isLoading: statsLoading } = useDashboardStats();
    const { logs, loading: logsLoading, error: logsError, filter, setFilter, searchTerm, setSearchTerm, campaignFilter, setCampaignFilter, page, setPage, totalPages, refresh: refreshLogs, deleteAllLogs } = useEmailLogs();

    if (themeLoading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
                </div>
            </ProtectedRoute>
        );
    }

    const showNotification = (message: string, type: NotificationType) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000); // Auto-dismiss after 5 seconds
    };

    const handleFormSubmit = async (formData: CampaignFormData) => {
        const result = await addOrUpdateCampaign(formData, editingCampaign);
        if (result.success) {
            showNotification(`Campaign ${editingCampaign ? 'updated' : 'created'} successfully!`, 'success');
            handleCloseForm();
        } else {
            showNotification(result.error || 'An unknown error occurred.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!campaignToDelete) return;
        const result = await deleteCampaign(campaignToDelete.campaignId);
        if (result.success) {
            showNotification('Campaign deleted successfully!', 'success');
        } else {
            showNotification(result.error || 'Failed to delete campaign.', 'error');
        }
        setCampaignToDelete(null); // Close modal
    };

    const handleOpenForm = (campaign: Campaign | null = null) => {
        setEditingCampaign(campaign);
        setIsCampaignFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingCampaign(null);
        setIsCampaignFormOpen(false);
    };

    const openDeleteConfirm = (campaign: Campaign, e: React.MouseEvent) => {
        e.stopPropagation();
        setCampaignToDelete(campaign);
    };

    const handleOpenDeleteAllModal = () => {
        setDeleteAllModalOpen(true);
    };

    const handleCloseDeleteAllModal = () => {
        setDeleteAllModalOpen(false);
    };

    const handleDeleteAllConfirm = async () => {
        const result = await deleteAllLogs();
        if (result.success) {
            showNotification('All email logs deleted successfully!', 'success');
        } else {
            showNotification(result.error || 'Failed to delete all logs.', 'error');
        }
        setDeleteAllModalOpen(false);
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <Notification info={notification} onDismiss={() => setNotification(null)} themeColor={settings.themeColor} />

                {/* Header */}
                <header className="w-full bg-white shadow-sm border-b border-gray-300">
                    <div className="flex justify-between items-center mx-8 px-10 py-6">
                        <div style={{ position: 'relative', width: '200px', height: '50px' }}>
                            <Image
                                src="/uploads/textlogo.webp"
                                alt="Logo"
                                fill
                                style={{ objectFit: 'contain' }}
                            />
                        </div>
                        <div className="flex items-center space-x-4">
                            {user?.photoURL && <Image src={user.photoURL} alt="Profile" width={40} height={40} className="rounded-full" />}
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user?.displayName}</p>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                            <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition">Logout</button>
                        </div>
                    </div>
                </header>

                {/* Main Content with Sidebar */}
                <div className="flex h-screen bg-gray-50 ">
                    {/* Sidebar */}
                    <div className="w-64 bg-white shadow-sm border-r border-gray-300">
                        <div className="p-4">
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Home</h2>
                            <nav className="space-y-2">
                                {/* Dashboard - Always visible as main page */}
                                <button
                                    onClick={() => setActiveSection('dashboard')}
                                    className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'dashboard'
                                        ? 'text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    style={activeSection === 'dashboard' ? { backgroundColor: settings.themeColor } : {}}
                                >
                                    <FiBarChart className="w-5 h-5 mr-3" />
                                    Dashboard
                                </button>

                                {/* Email Templates */}
                                {emailTemplateAllowed && (
                                    <button
                                        onClick={() => setActiveSection('email-templates')}
                                        className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'email-templates'
                                            ? 'text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        style={activeSection === 'email-templates' ? { backgroundColor: settings.themeColor } : {}}
                                    >
                                        <FiMail className="w-5 h-5 mr-3" />
                                        Email Templates
                                    </button>
                                )}

                                {/* Campaigns */}
                                {campaignAllowed && (
                                    <button
                                        onClick={() => setActiveSection('campaigns')}
                                        className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'campaigns'
                                            ? 'text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        style={activeSection === 'campaigns' ? { backgroundColor: settings.themeColor } : {}}
                                    >
                                        <FiRefreshCw className="w-5 h-5 mr-3" />
                                        Campaigns
                                    </button>
                                )}

                                {/* One-Time Broadcast */}
                                {oneTimeBroadcastAllowed && (
                                    <button
                                        onClick={() => setActiveSection('one-time-broadcast')}
                                        className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'one-time-broadcast'
                                            ? 'text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        style={activeSection === 'one-time-broadcast' ? { backgroundColor: settings.themeColor } : {}}
                                    >
                                        <FiMail className="w-5 h-5 mr-3" />
                                        One-Time Broadcast
                                    </button>
                                )}

                                {/* Date-Based Automation */}
                                {dateBasedAutomationAllowed && (
                                    <button
                                        onClick={() => setActiveSection('date-based-automation')}
                                        className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'date-based-automation'
                                            ? 'text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                        style={activeSection === 'date-based-automation' ? { backgroundColor: settings.themeColor } : {}}
                                    >
                                        <FiRefreshCw className="w-5 h-5 mr-3" />
                                        Date-Based Automation
                                    </button>
                                )}

                                {!emailTemplateAllowed && !emailLogsAllowed && !campaignAllowed && !oneTimeBroadcastAllowed && !dateBasedAutomationAllowed && (
                                    <div className="text-center py-8 text-gray-500">
                                        <p className="text-sm">No features enabled.</p>
                                        <p className="text-xs mt-2">Contact administrator.</p>
                                    </div>
                                )}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-auto">
                        <div className="p-8">
                            {/* Dashboard Home - Shows Create Options + Analytics */}
                            {activeSection === 'dashboard' && (
                                <div>
                                    {(emailTemplateAllowed || emailLogsAllowed || campaignAllowed || oneTimeBroadcastAllowed || dateBasedAutomationAllowed) && (
                                        <>
                                            <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>
                                            {/* Create Section - Show all enabled features */}
                                            <div className="mb-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {emailTemplateAllowed && (
                                                        <div
                                                            className="bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200 hover:border-current cursor-pointer transition-all group"
                                                            style={{ '--hover-border-color': settings.themeColor } as React.CSSProperties}
                                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = settings.themeColor}
                                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                                                        >
                                                            <div className="flex flex-col items-center text-center">
                                                                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${settings.themeColor}20` }}>
                                                                    <FiMail className="w-8 h-8" style={{ color: settings.themeColor }} />
                                                                </div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Template</h3>
                                                                <p className="text-sm text-gray-600 mb-4">Create reusable email templates</p>
                                                                <button
                                                                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                    style={{ backgroundColor: settings.themeColor }}
                                                                >
                                                                    Create Template
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {campaignAllowed && (
                                                        <div
                                                            onClick={() => handleOpenForm()}
                                                            className="bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200 hover:border-current cursor-pointer transition-all group"
                                                            style={{ '--hover-border-color': settings.themeColor } as React.CSSProperties}
                                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = settings.themeColor}
                                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                                                        >
                                                            <div className="flex flex-col items-center text-center">
                                                                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${settings.themeColor}20` }}>
                                                                    <FiRefreshCw className="w-8 h-8" style={{ color: settings.themeColor }} />
                                                                </div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign</h3>
                                                                <p className="text-sm text-gray-600 mb-4">Launch automated campaigns</p>
                                                                <button
                                                                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                    style={{ backgroundColor: settings.themeColor }}
                                                                >
                                                                    Create Campaign
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {oneTimeBroadcastAllowed && (
                                                        <div
                                                            className="bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200 hover:border-current cursor-pointer transition-all group"
                                                            style={{ '--hover-border-color': settings.themeColor } as React.CSSProperties}
                                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = settings.themeColor}
                                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                                                        >
                                                            <div className="flex flex-col items-center text-center">
                                                                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${settings.themeColor}20` }}>
                                                                    <FiMail className="w-8 h-8" style={{ color: settings.themeColor }} />
                                                                </div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">One-Time Broadcast</h3>
                                                                <p className="text-sm text-gray-600 mb-4">Send instant broadcasts</p>
                                                                <button
                                                                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                    style={{ backgroundColor: settings.themeColor }}
                                                                >
                                                                    Create Broadcast
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {dateBasedAutomationAllowed && (
                                                        <div
                                                            className="bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200 hover:border-current cursor-pointer transition-all group"
                                                            style={{ '--hover-border-color': settings.themeColor } as React.CSSProperties}
                                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = settings.themeColor}
                                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                                                        >
                                                            <div className="flex flex-col items-center text-center">
                                                                <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${settings.themeColor}20` }}>
                                                                    <FiRefreshCw className="w-8 h-8" style={{ color: settings.themeColor }} />
                                                                </div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Date-Based Automation</h3>
                                                                <p className="text-sm text-gray-600 mb-4">Automate by dates</p>
                                                                <button
                                                                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                    style={{ backgroundColor: settings.themeColor }}
                                                                >
                                                                    Create Automation
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* User Analytics Section (Email Logs) - Only if enabled */}
                                            {emailLogsAllowed && (
                                                <div>
                                                    <h2 className="text-xl font-semibold text-gray-900 mb-6">User Analytics</h2>

                                                    {/* Today's Stats */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                                        <StatCard
                                                            title="Today's Sent Mail"
                                                            value={stats.sent}
                                                            total={stats.total}
                                                            percentage={parseFloat(stats.sentPercentage)}
                                                            isLoading={statsLoading}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <StatCard
                                                            title="Today's Opened Mail"
                                                            value={stats.opened}
                                                            total={stats.sentOpened}
                                                            percentage={parseFloat(stats.openRate)}
                                                            isLoading={statsLoading}
                                                            note="(One-on-One)"
                                                            themeColor={settings.themeColor}
                                                        />
                                                    </div>

                                                    {/* Email Logs Section */}
                                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <h3 className="text-lg font-semibold text-gray-900">Email Logs</h3>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={refreshLogs}
                                                                    className="flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                    style={{ backgroundColor: settings.themeColor }}
                                                                >
                                                                    <FiRefreshCw className="w-4 h-4 mr-2" />
                                                                    Refresh
                                                                </button>
                                                                <button
                                                                    onClick={handleOpenDeleteAllModal}
                                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                                                                >
                                                                    Delete All
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Filters and Search */}
                                                        <div className="mb-6 border-b border-gray-200 pb-4">
                                                            <div className="flex flex-col md:flex-row gap-4">
                                                                <div className="flex-shrink-0 flex flex-wrap gap-2">
                                                                    {['all', 'today', 'sent', 'failed', 'opened', 'bounced'].map(f => (
                                                                        <FilterButton
                                                                            key={f}
                                                                            active={filter === f}
                                                                            onClick={() => setFilter(f as LogFilter)}
                                                                            themeColor={settings.themeColor}
                                                                        >
                                                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                                                        </FilterButton>
                                                                    ))}
                                                                </div>

                                                                <div className="flex gap-4 items-center">
                                                                    <select
                                                                        value={campaignFilter}
                                                                        onChange={(e) => setCampaignFilter(e.target.value)}
                                                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-600 text-sm"
                                                                    >
                                                                        <option value="">All campaigns</option>
                                                                        {campaigns.map(c => (
                                                                            <option key={c.campaignId} value={c.campaignId}>{c.campaignName}</option>
                                                                        ))}
                                                                    </select>

                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search by recipient, sender, or campaign ID..."
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        className="w-full md:max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-600"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Email Logs Table */}
                                                        <div className="overflow-x-auto">
                                                            {logsLoading && <p className="text-center p-8 text-gray-600">Loading...</p>}
                                                            {logsError && <p className="text-center p-8 text-red-600">{logsError}</p>}
                                                            {!logsLoading && !logsError && logs.length === 0 && (
                                                                <p className="text-center p-8 text-gray-600">No logs found for this filter.</p>
                                                            )}
                                                            {!logsLoading && !logsError && logs.length > 0 && (
                                                                <table className="min-w-full divide-y divide-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No.</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                                        {logs.map((log, index) => (
                                                                            <tr key={`${log.campaignId}-${log.recipientEmail}-${log.sentAt}-${index}`}>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(page - 1) * 10 + index + 1}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={log.status} /></td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.recipientEmail}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.senderEmail}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(log.sentAt).toLocaleString()}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                                    <button
                                                                                        onClick={() => setSelectedLog(log)}
                                                                                        className="text-blue-600 hover:text-blue-900"
                                                                                        title="View Details"
                                                                                    >
                                                                                        <FiEye />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>

                                                        {/* Pagination */}
                                                        {totalPages > 1 && (
                                                            <Pagination
                                                                currentPage={page}
                                                                totalPages={totalPages}
                                                                onPageChange={setPage}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Email Templates Page - Show all email templates with edit/delete */}
                            {activeSection === 'email-templates' && emailTemplateAllowed && (
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-8">Email Templates</h1>
                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                        <div className="text-center py-12">
                                            <FiMail className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No templates created yet</p>
                                            <p className="text-gray-500 mb-4">Create your first email template from the dashboard.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Campaigns Page - Show all campaigns with edit/delete */}
                            {activeSection === 'campaigns' && campaignAllowed && (
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-8">Campaigns</h1>
                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                        {campaignsLoading ? (
                                            <p className="text-center p-8 text-gray-600">Loading...</p>
                                        ) : campaigns.length === 0 ? (
                                            <div className="text-center py-12">
                                                <FiRefreshCw className="text-gray-300 text-5xl mx-auto mb-4" />
                                                <p className="text-gray-600 font-semibold">No campaigns created yet</p>
                                                <p className="text-gray-500 mb-4">Create your first campaign from the dashboard.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {campaigns.map((campaign) => (
                                                    <div key={campaign.campaignId} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{campaign.campaignName}</h3>
                                                        <p className="text-sm text-gray-600 mb-4">Created: {new Date(campaign.createdAt).toLocaleDateString()}</p>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => handleOpenForm(campaign)}
                                                                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm"
                                                                style={{ backgroundColor: settings.themeColor }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={(e) => openDeleteConfirm(campaign, e)}
                                                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* One-Time Broadcast Page */}
                            {activeSection === 'one-time-broadcast' && oneTimeBroadcastAllowed && (
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-8">One-Time Broadcast</h1>
                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                        <div className="text-center py-12">
                                            <FiMail className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No broadcasts created yet</p>
                                            <p className="text-gray-500 mb-4">Create your first broadcast from the dashboard.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Date-Based Automation Page */}
                            {activeSection === 'date-based-automation' && dateBasedAutomationAllowed && (
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-8">Date-Based Automation</h1>
                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                        <div className="text-center py-12">
                                            <FiRefreshCw className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No automations created yet</p>
                                            <p className="text-gray-500 mb-4">Create your first automation from the dashboard.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* No Features Enabled Fallback */}
                            {!emailTemplateAllowed && !emailLogsAllowed && !campaignAllowed && !oneTimeBroadcastAllowed && !dateBasedAutomationAllowed && (
                                <div className="flex items-center justify-center h-96">
                                    <div className="text-center">
                                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <FiAlertCircle className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Features Available</h2>
                                        <p className="text-gray-600 mb-4 max-w-md">
                                            No dashboard features are currently enabled for your account.
                                            Please contact your administrator to enable features.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Feature Disabled Message */}
                            {((activeSection === 'email-templates' && !emailTemplateAllowed) ||
                                (activeSection === 'campaigns' && !campaignAllowed) ||
                                (activeSection === 'one-time-broadcast' && !oneTimeBroadcastAllowed) ||
                                (activeSection === 'date-based-automation' && !dateBasedAutomationAllowed)) &&
                                (emailTemplateAllowed || campaignAllowed || emailLogsAllowed || oneTimeBroadcastAllowed || dateBasedAutomationAllowed) && (
                                    <div className="flex items-center justify-center h-96">
                                        <div className="text-center">
                                            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                <FiAlertCircle className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Feature Not Available</h2>
                                            <p className="text-gray-600 mb-4">
                                                This feature is not enabled for your account. Please contact your administrator.
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {campaignAllowed && (
                    <>
                        <CampaignForm isOpen={isCampaignFormOpen} onClose={handleCloseForm} onSubmit={handleFormSubmit} editCampaign={editingCampaign} />

                        {campaignToDelete && (
                            <DeleteConfirmationModal
                                campaignName={campaignToDelete.campaignName}
                                onConfirm={handleDelete}
                                onCancel={() => setCampaignToDelete(null)}
                            />
                        )}
                    </>
                )}

                {emailLogsAllowed && (
                    <>
                        {selectedLog && (
                            <DetailModal
                                log={selectedLog}
                                onClose={() => setSelectedLog(null)}
                            />
                        )}

                        {isDeleteAllModalOpen && (
                            <DeleteAllLogsModal
                                onClose={handleCloseDeleteAllModal}
                                onConfirm={handleDeleteAllConfirm}
                            />
                        )}
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}

// --- Sub-components for better organization --------------------------------

interface StatCardProps {
    title: string;
    value: string | number;
    total?: number;
    percentage?: number;
    isLoading: boolean;
    note?: string;
    onClick?: () => void;
    themeColor: string;
}

const StatCard = ({ title, value, total, percentage, isLoading, note, onClick, themeColor }: StatCardProps) => {
    // Determine dynamic classes based on whether the card is clickable
    const isClickable = !!onClick;
    const containerClasses = `
        bg-white p-5 rounded-lg shadow-sm
        ${isClickable ? 'cursor-pointer hover:shadow-xl border border-transparent transition-all duration-300' : ''}
    `;

    return (
        <div
            className={containerClasses}
            onClick={onClick}
            style={isClickable ? { '--hover-border-color': themeColor } as React.CSSProperties : {}}
            onMouseEnter={isClickable ? (e) => e.currentTarget.style.borderColor = themeColor : undefined}
            onMouseLeave={isClickable ? (e) => e.currentTarget.style.borderColor = 'transparent' : undefined}
        >
            {isLoading ? <div className="h-24 bg-gray-200 animate-pulse rounded-md"></div> : <>
                <p className="text-base font-semibold text-gray-600">{title}</p>
                <div className="flex items-end mt-2">
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {total !== undefined && <p className="text-lg font-medium text-gray-500 ml-2">/ {total}</p>}
                </div>
                {percentage !== undefined && (
                    <div className="mt-4">
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">Progress</span>
                            <span className="text-sm font-medium" style={{ color: themeColor }}>{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: themeColor }}></div>
                        </div>
                    </div>
                )}
                {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
            </>}
        </div>
    );
};

interface DeleteConfirmationModalProps {
    campaignName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteConfirmationModal = ({ campaignName, onConfirm, onCancel }: DeleteConfirmationModalProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <FiAlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-5">Delete Campaign</h3>
                <p className="text-sm text-gray-500 mt-2">
                    Are you sure you want to delete &quot;{campaignName}&quot;? This action cannot be undone.
                </p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
                <button onClick={onCancel} className="px-6 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300">
                    Cancel
                </button>
                <button onClick={onConfirm} className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700">
                    Delete
                </button>
            </div>
        </div>
    </div>
);

// Filter Button Component for Email Logs
interface FilterButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    themeColor: string;
}

const FilterButton = ({ active, onClick, children, themeColor }: FilterButtonProps) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition`}
        style={active ? { backgroundColor: themeColor, color: 'white' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
    >
        {children}
    </button>
);

// Status Badge Component for Email Logs
const StatusBadge = ({ status }: { status: EmailLog['status'] }) => {
    const styles: Record<string, string> = {
        sent: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
        opened: "bg-blue-100 text-blue-800",
        bounced: "bg-yellow-100 text-yellow-800",
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
};

// Pagination Component for Email Logs
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => (
    <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-600">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
        <div className="flex gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
            >
                Previous
            </button>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
            >
                Next
            </button>
        </div>
    </div>
);

// Detail Modal Component for Email Logs
interface DetailModalProps {
    log: EmailLog;
    onClose: () => void;
}

const DetailModal = ({ log, onClose }: DetailModalProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Email Log Details</h3>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                    <FiX className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div className="mt-1">
                            <StatusBadge status={log.status} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Send Method</label>
                        <p className="mt-1 text-sm text-gray-900">{log.sendMethod || 'N/A'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Recipient Email</label>
                        <p className="mt-1 text-sm text-gray-900">{log.recipientEmail}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Sender Email</label>
                        <p className="mt-1 text-sm text-gray-900">{log.senderEmail}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Campaign ID</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded">{log.campaignId}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Sent At</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(log.sentAt).toLocaleString()}</p>
                    </div>
                </div>

                {log.openedAt && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Opened At</label>
                        <p className="mt-1 text-sm text-gray-900">{new Date(log.openedAt).toLocaleString()}</p>
                    </div>
                )}

                {log.failureReason && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Failure Reason</label>
                        <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{log.failureReason}</p>
                    </div>
                )}

                {log.bounceReason && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Bounce Reason</label>
                        <p className="mt-1 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">{log.bounceReason}</p>
                    </div>
                )}

                {log.originalError && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Original Error</label>
                        <p className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">{log.originalError}</p>
                    </div>
                )}

                {log.failureCategory && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Failure Category</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">{log.failureCategory}</p>
                    </div>
                )}

                {log.bounceCategory && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Bounce Category</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">{log.bounceCategory}</p>
                    </div>
                )}

                {log.trackingData && (
                    <div>
                        <label className="text-sm font-medium text-gray-500">Tracking Data</label>
                        <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                            {log.trackingData.userAgent && <p><strong>User Agent:</strong> {log.trackingData.userAgent}</p>}
                            {log.trackingData.referer && <p><strong>Referer:</strong> {log.trackingData.referer}</p>}
                            {log.trackingData.ip && <p><strong>IP:</strong> {log.trackingData.ip}</p>}
                            {log.trackingData.timeDiff && <p><strong>Time Diff:</strong> {log.trackingData.timeDiff}ms</p>}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);

// Delete All Logs Confirmation Modal
interface DeleteAllLogsModalProps {
    onConfirm: () => void;
    onClose: () => void;
}

const DeleteAllLogsModal = ({ onConfirm, onClose }: DeleteAllLogsModalProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <FiAlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-5">Delete All Email Logs</h3>
                <p className="text-sm text-gray-500 mt-2">
                    Are you sure you want to delete all email logs? This action cannot be undone and will permanently remove all email log history from the database.
                </p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
                <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300">
                    Cancel
                </button>
                <button onClick={onConfirm} className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700">
                    Delete All
                </button>
            </div>
        </div>
    </div>
);