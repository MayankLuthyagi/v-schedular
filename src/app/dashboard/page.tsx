'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// --- (Place these in separate files for best practice) ---
// e.g., @/hooks/useCampaigns.ts
// e.g., @/hooks/useDashboardStats.ts
// e.g., @/components/Notification.tsx

// --- Types (assuming they are in @/types/) ---
import { CampaignFormData, Campaign } from '@/types/campaign';
import { EmailLog } from '@/types/emailLog';

// --- Context ---
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

// --- Components ---
import ProtectedRoute from '@/components/ProtectedRoute';
import CampaignForm from '@/components/CampaignForm';
import { FaPlus, FaTrash } from 'react-icons/fa'; // Example using react-icons
import { FiMail, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';

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
        opened: 0,
        sentPercentage: '0.00',
        openRate: '0.00'
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/emailLog?status=today');
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
    const router = useRouter();

    // State for UI interactivity
    const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
    const [notification, setNotification] = useState<NotificationState | null>(null);

    // Using our custom hooks
    const { campaigns, isLoading: campaignsLoading, addOrUpdateCampaign, deleteCampaign } = useCampaigns();
    const { stats, isLoading: statsLoading } = useDashboardStats();

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

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <Notification info={notification} onDismiss={() => setNotification(null)} themeColor={settings.themeColor} />

                {/* Header */}
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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

                {/* Main Content */}
                <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div onClick={() => handleOpenForm()} className="bg-white p-6 rounded-lg shadow-sm border border-dashed border-gray-300 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 hover:text-blue-600 transition group" style={{ '--hover-color': settings.themeColor } as React.CSSProperties}>
                            <div className="bg-gray-100 p-4 rounded-full group-hover:bg-blue-100 transition" style={{ backgroundColor: `${settings.themeColor}20` }}>
                                <FaPlus className="h-6 w-6 text-gray-500 transition" style={{ color: settings.themeColor }} />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-800">Create Campaign</h3>
                            <p className="mt-1 text-sm text-gray-500">Launch a new email sequence</p>
                        </div>

                        {/* This card remains non-clickable, as intended */}
                        <StatCard
                            title="Total Campaigns"
                            value={campaigns.length}
                            isLoading={campaignsLoading}
                            themeColor={settings.themeColor}
                        />
                    </div>

                    {/* Campaigns List */}
                    <div className="mt-8 bg-white shadow-sm rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6">Active Campaigns ({campaigns.length})</h2>
                        {campaignsLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading campaigns...</div>
                        ) : campaigns.length === 0 ? (
                            <div className="text-center py-12">
                                <FiMail className="text-gray-300 text-5xl mx-auto mb-4" />
                                <p className="text-gray-600 font-semibold">No campaigns here yet</p>
                                <p className="text-gray-500 mb-4">Click the button below to get started.</p>
                                <button onClick={() => handleOpenForm()} style={{ backgroundColor: settings.themeColor }} className="text-white px-5 py-2.5 rounded-md font-medium transition hover:opacity-90">
                                    Create First Campaign
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {campaigns.map(campaign => (
                                    <CampaignCard key={campaign.campaignId} campaign={campaign} onEdit={() => handleOpenForm(campaign)} onDelete={(e) => openDeleteConfirm(campaign, e)} themeColor={settings.themeColor} />
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                {/* Modals */}
                <CampaignForm isOpen={isCampaignFormOpen} onClose={handleCloseForm} onSubmit={handleFormSubmit} editCampaign={editingCampaign} />

                {campaignToDelete && (
                    <DeleteConfirmationModal
                        campaignName={campaignToDelete.campaignName}
                        onConfirm={handleDelete}
                        onCancel={() => setCampaignToDelete(null)}
                    />
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

const CampaignCard = ({ campaign, onEdit, onDelete, themeColor }: { campaign: Campaign, onEdit: () => void, onDelete: (e: React.MouseEvent) => void, themeColor: string }) => (
    <div onClick={onEdit} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-md transition-all cursor-pointer relative group" style={{ '--hover-border-color': themeColor } as React.CSSProperties} onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}>
        <button onClick={onDelete} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100 z-10" title="Delete Campaign">
            <FaTrash className="h-4 w-4" />
        </button>
        <div className="pr-8">
            <h3 className="font-semibold text-gray-900 truncate">{campaign.campaignName}</h3>
            <p className="text-sm text-gray-600 truncate">{campaign.emailSubject}</p>
        </div>
        <div className={`mt-3 px-2 py-1 inline-block rounded-full text-xs font-medium`} style={campaign.isActive ? { backgroundColor: `${themeColor}20`, color: themeColor } : { backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {campaign.isActive ? 'Active' : 'Inactive'}
        </div>
        <div className="text-xs text-gray-500 mt-3 border-t pt-3">
            <div>📅 {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</div>
            <div>🕒 {campaign.sendTime} on {campaign.sendDays.slice(0, 2).join(', ')}{campaign.sendDays.length > 2 ? `...` : ''}</div>
        </div>
    </div>
);

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