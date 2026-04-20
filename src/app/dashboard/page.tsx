'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

// --- (Place these in separate files for best practice) ---
// e.g., @/hooks/useCampaigns.ts
// e.g., @/hooks/useDashboardStats.ts
// e.g., @/components/Notification.tsx

// --- Types ---
import { CampaignFormData, Campaign } from '@/types/campaign';
import { EmailLog } from '@/types/emailLog';
import { EmailTemplate } from '@/types/template';
import { Audience } from '@/types/audience';
import { Broadcast } from '@/types/broadcast';
import { DateAutomation } from '@/types/dateAutomation';

// --- Context ---
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useFeatureAllowed } from '@/contexts/ThemeContext';

// --- Components ---
import ProtectedRoute from '@/components/ProtectedRoute';
import CampaignForm from '@/components/CampaignForm';
import TemplateModal from '@/components/TemplateModal';
import EmailTemplatePreviewModal from '@/components/EmailTemplatePreviewModal';
import AudienceModal from '@/components/AudienceModal';
import BroadcastModal from '@/components/BroadcastModal';
import DateAutomationModal from '@/components/DateAutomationModal';
import ToastViewport from '@/components/ToastViewport';
import EditIconButton from '@/components/EditIconButton';
import DeleteIconButton from '@/components/DeleteIconButton';
import ViewIconButton from '@/components/ViewIconButton';
import { useToast } from '@/hooks/useToast';
import { FiMail, FiAlertCircle, FiX, FiBarChart, FiEye, FiRefreshCw, FiUsers, FiCalendar, FiTrash2, FiPlus, FiDownload, FiLogOut } from 'react-icons/fi';
import TemplatePreviewModal from '@/components/TemplatePreviewModal';
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
    const [isExporting, setIsExporting] = useState(false);

    // State for filtering and pagination
    const [filter, setFilter] = useState<LogFilter>('today');
    const [searchTerm, setSearchTerm] = useState('');
    // Campaign filter (empty = all)
    const [campaignFilter, setCampaignFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const buildLogParams = useCallback((currentFilter: LogFilter, currentSearch: string, currentPage: number, currentCampaign?: string) => {
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
        params.append('limit', '20');
        return params;
    }, []);

    const fetchLogs = useCallback(async (currentFilter: LogFilter, currentSearch: string, currentPage: number, currentCampaign?: string) => {
        setLoading(true);
        setError('');
        try {
            const params = buildLogParams(currentFilter, currentSearch, currentPage, currentCampaign);
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
    }, [buildLogParams]);

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

    const exportLogs = async () => {
        setIsExporting(true);
        setError('');
        try {
            const params = buildLogParams(filter, searchTerm, 1, campaignFilter);
            params.set('export', 'true');

            const response = await fetch(`/api/emailLog?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to export logs.');
            }

            const logsToExport: EmailLog[] = data.logs || [];
            if (logsToExport.length === 0) {
                throw new Error('No email logs found for the selected filter.');
            }

            const XLSX = await import('xlsx');
            const rows = logsToExport.map((log, index) => ({
                No: index + 1,
                Status: log.status,
                'Recipient Email': log.recipientEmail,
                'Sender Email': log.senderEmail,
                'Campaign ID': log.campaignId,
                'Send Method': log.sendMethod,
                'Sent At': log.sentAt ? new Date(log.sentAt).toLocaleString() : '',
                'Opened At': log.openedAt ? new Date(log.openedAt).toLocaleString() : '',
                'Bounced At': log.bouncedAt ? new Date(log.bouncedAt).toLocaleString() : '',
                'Failure Reason': log.failureReason || '',
                'Failure Category': log.failureCategory || '',
                'Bounce Reason': log.bounceReason || '',
                'Bounce Category': log.bounceCategory || '',
                'Original Error': log.originalError || '',
                'Tracking User Agent': log.trackingData?.userAgent || '',
                'Tracking Referer': log.trackingData?.referer || '',
                'Tracking IP': log.trackingData?.ip || '',
                'Tracking Time Diff (ms)': log.trackingData?.timeDiff ?? '',
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            worksheet['!cols'] = [
                { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 36 }, { wch: 14 },
                { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 30 },
                { wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 18 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Logs');
            const fileDate = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `email-logs-${filter}-${fileDate}.xlsx`);

            return { success: true, count: logsToExport.length };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : 'An error occurred' };
        } finally {
            setIsExporting(false);
        }
    };

    return {
        logs, loading, error,
        filter, setFilter,
        searchTerm, setSearchTerm,
        campaignFilter, setCampaignFilter,
        page, setPage, totalPages,
        isExporting,
        refresh: () => fetchLogs(filter, searchTerm, page, campaignFilter),
        deleteAllLogs,
        exportLogs,
    };
};


// --- Simple list hooks for new collections --------------------------------

const useTemplates = (trigger: number) => {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetch('/api/templates').then(r => r.json()).then(d => { if (d.success) setTemplates(d.templates); }).finally(() => setLoading(false));
    }, [trigger]);
    return { templates, loading };
};

const useAudiences = (trigger: number) => {
    const [audiences, setAudiences] = useState<Audience[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetch('/api/audiences').then(r => r.json()).then(d => { if (d.success) setAudiences(d.audiences); }).finally(() => setLoading(false));
    }, [trigger]);
    return { audiences, loading };
};

const useBroadcasts = (trigger: number) => {
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetch('/api/broadcasts').then(r => r.json()).then(d => { if (d.success) setBroadcasts(d.broadcasts); }).finally(() => setLoading(false));
    }, [trigger]);
    return { broadcasts, loading };
};

const useDateAutomations = (trigger: number) => {
    const [automations, setAutomations] = useState<DateAutomation[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetch('/api/date-automations').then(r => r.json()).then(d => { if (d.success) setAutomations(d.automations); }).finally(() => setLoading(false));
    }, [trigger]);
    return { automations, loading };
};

// --- Main Dashboard Page Component ----------------------------------------

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const { settings, isLoading: themeLoading } = useTheme();
    const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
    // Feature flags
    const emailTemplateAllowed = useFeatureAllowed('emailTemplate');
    const emailLogsAllowed = useFeatureAllowed('emailLogs');
    const campaignAllowed = useFeatureAllowed('campaign');
    const oneTimeBroadcastAllowed = useFeatureAllowed('oneTimeBroadcast');
    const dateBasedAutomationAllowed = useFeatureAllowed('dateBasedAutomation');
    const { toasts, showToast, dismissToast } = useToast();

    // State for UI interactivity
    const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [isDeleteAllModalOpen, setDeleteAllModalOpen] = useState(false);

    // Sidebar state
    const [activeSection, setActiveSection] = useState<'dashboard' | 'email-templates' | 'audiences' | 'campaigns' | 'one-time-broadcast' | 'date-based-automation'>('dashboard');

    // Refresh triggers for new collections
    const [templatesTrigger, setTemplatesTrigger] = useState(0);
    const [audiencesTrigger, setAudiencesTrigger] = useState(0);
    const [broadcastsTrigger, setBroadcastsTrigger] = useState(0);
    const [automationsTrigger, setAutomationsTrigger] = useState(0);

    // Modal state for new features
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [viewingTemplate, setViewingTemplate] = useState<EmailTemplate | null>(null);
    const [isAudienceModalOpen, setIsAudienceModalOpen] = useState(false);
    const [editingAudience, setEditingAudience] = useState<Audience | null>(null);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null);
    const [isDateAutomationModalOpen, setIsDateAutomationModalOpen] = useState(false);
    const [editingAutomation, setEditingAutomation] = useState<DateAutomation | null>(null);

    // Using our custom hooks
    const { campaigns, isLoading: campaignsLoading, addOrUpdateCampaign, deleteCampaign, refresh } = useCampaigns();
    const { stats, isLoading: statsLoading } = useDashboardStats();
    const { logs, loading: logsLoading, error: logsError, filter, setFilter, searchTerm, setSearchTerm, campaignFilter, setCampaignFilter, page, setPage, totalPages, isExporting, refresh: refreshLogs, deleteAllLogs, exportLogs } = useEmailLogs();
    const { templates, loading: templatesLoading } = useTemplates(templatesTrigger);
    const { audiences, loading: audiencesLoading } = useAudiences(audiencesTrigger);
    const { broadcasts, loading: broadcastsLoading } = useBroadcasts(broadcastsTrigger);
    const { automations, loading: automationsLoading } = useDateAutomations(automationsTrigger);

    if (themeLoading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
                </div>
            </ProtectedRoute>
        );
    }

    const handleFormSubmit = async (formData: CampaignFormData) => {
        const result = await addOrUpdateCampaign(formData, editingCampaign);
        if (result.success) {
            showToast(
                editingCampaign ? 'Your campaign changes have been saved.' : 'Your campaign is ready to go.',
                'success',
                editingCampaign ? 'Campaign updated' : 'Campaign created'
            );
            handleCloseForm();
        } else {
            showToast(result.error || 'We could not save this campaign.', 'error', 'Campaign not saved');
        }
    };

    const handleDelete = async () => {
        if (!campaignToDelete) return;
        const result = await deleteCampaign(campaignToDelete.campaignId);
        if (result.success) {
            showToast('The campaign was removed successfully.', 'success', 'Campaign deleted');
        } else {
            showToast(result.error || 'We could not delete this campaign.', 'error', 'Delete failed');
        }
        setCampaignToDelete(null); // Close modal
    };

    /**
     * Toggle the sentToday state for a campaign.
     * markAsSent = true  → set todaySent to today (prevent resend this run)
     * markAsSent = false → roll back to yesterday (allow resend today)
     */
    const handleToggleSentToday = async (campaignId: string, markAsSent: boolean) => {
        try {
            const response = await fetch(`/api/campaigns?campaignId=${campaignId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset-sent-today', value: markAsSent }),
            });
            if (!response.ok) throw new Error('Failed to update');
            // Refresh campaign list so todaySent is up-to-date
            await refresh();
            showToast(
                markAsSent ? 'Campaign marked as already sent today.' : 'Campaign will resend today.',
                'success',
                'Campaign updated'
            );
        } catch {
            showToast('Failed to update sent status.', 'error', 'Update failed');
        }
    };

    const handleOpenForm = (campaign: Campaign | null = null) => {
        setEditingCampaign(campaign);
        setIsCampaignFormOpen(true);
    };
    const handleOpenTemplate = (campaign: Campaign) => {
        setViewingCampaign(campaign);
    }
    const handleCloseTemplate = () => {
        setViewingCampaign(null);
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
            showToast('All email logs were cleared successfully.', 'success', 'Logs deleted');
        } else {
            showToast(result.error || 'Failed to delete all logs.', 'error', 'Delete failed');
        }
        setDeleteAllModalOpen(false);
    };

    const handleExportLogs = async () => {
        const result = await exportLogs();
        if (result.success) {
            showToast(`Downloaded ${result.count} email logs to Excel.`, 'success', 'Export complete');
        } else {
            showToast(result.error || 'Failed to export email logs.', 'error', 'Export failed');
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <ToastViewport toasts={toasts} onDismiss={dismissToast} themeColor={settings.themeColor} />

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
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                            <button onClick={logout} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition">
                                <FiLogOut className="w-4 h-4" />
                                Logout
                            </button>
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

                                {/* Audiences - always visible when any feature is on */}
                                {(emailTemplateAllowed || campaignAllowed || oneTimeBroadcastAllowed || dateBasedAutomationAllowed) && (
                                    <button
                                        onClick={() => setActiveSection('audiences')}
                                        className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition cursor-pointer ${activeSection === 'audiences' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                        style={activeSection === 'audiences' ? { backgroundColor: settings.themeColor } : {}}
                                    >
                                        <FiUsers className="w-5 h-5 mr-3" />
                                        Audiences
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
                                                        <QuickCreateCard icon={<FiMail />} title="Email Template" desc="Create reusable email templates" btnLabel="Create Template" themeColor={settings.themeColor} onClick={() => { setEditingTemplate(null); setIsTemplateModalOpen(true); }} />
                                                    )}
                                                    {campaignAllowed && (
                                                        <QuickCreateCard icon={<FiRefreshCw />} title="Campaign" desc="Launch automated campaigns" btnLabel="Create Campaign" themeColor={settings.themeColor} onClick={() => handleOpenForm()} />
                                                    )}
                                                    {oneTimeBroadcastAllowed && (
                                                        <QuickCreateCard icon={<FiMail />} title="One-Time Broadcast" desc="Send once on a specific date" btnLabel="Create Broadcast" themeColor={settings.themeColor} onClick={() => { setEditingBroadcast(null); setIsBroadcastModalOpen(true); }} />
                                                    )}
                                                    {dateBasedAutomationAllowed && (
                                                        <QuickCreateCard icon={<FiCalendar />} title="Date-Based Automation" desc="Automate by specific dates" btnLabel="Create Automation" themeColor={settings.themeColor} onClick={() => { setEditingAutomation(null); setIsDateAutomationModalOpen(true); }} />
                                                    )}
                                                    {(emailTemplateAllowed || campaignAllowed || oneTimeBroadcastAllowed || dateBasedAutomationAllowed) && (
                                                        <QuickCreateCard icon={<FiUsers />} title="Audiences" desc={audiences.length > 0 ? `${audiences.length} audience${audiences.length !== 1 ? 's' : ''} · ${audiences.reduce((s, a) => s + (a.totalContacts || 0), 0).toLocaleString()} contacts` : "Upload your contact lists"} btnLabel="Upload Audience" themeColor={settings.themeColor} onClick={() => setIsAudienceModalOpen(true)} />
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
                                                                    onClick={handleExportLogs}
                                                                    disabled={isExporting || logsLoading}
                                                                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    <FiDownload className="w-4 h-4 mr-2" />
                                                                    {isExporting ? 'Downloading...' : 'Download Excel'}
                                                                </button>
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
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(page - 1) * 20 + index + 1}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={log.status} /></td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.recipientEmail}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.senderEmail}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(log.sentAt).toLocaleString()}</td>
                                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                                    <ViewIconButton
                                                                                        onClick={() => setSelectedLog(log)}
                                                                                        label="View Details"
                                                                                    />
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

                            {/* Email Templates Page */}
                            {/* Email Templates */}
                            {activeSection === 'email-templates' && emailTemplateAllowed && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
                                        <button onClick={() => { setEditingTemplate(null); setIsTemplateModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                            <FiPlus /> New Template
                                        </button>
                                    </div>
                                    {templatesLoading ? <p className="text-center p-8 text-gray-500">Loading…</p> : templates.length === 0 ? (
                                        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                                            <FiMail className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No templates yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Click &quot;New Template&quot; to create one.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {templates.map(t => (
                                                <div key={t.templateId} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition flex flex-col">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                                                        <span className="text-xs text-gray-400 ml-2 shrink-0">{new Date(t.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 truncate">{t.subject}</p>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                                                        <ViewIconButton
                                                            onClick={() => setViewingTemplate(t)}
                                                            label="Preview"
                                                        />
                                                        <EditIconButton
                                                            onClick={() => { setEditingTemplate(t); setIsTemplateModalOpen(true); }}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <DeleteIconButton
                                                            onClick={async () => {
                                                                if (confirm(`Delete template "${t.name}"?`)) {
                                                                    await fetch(`/api/templates/${t.templateId}`, { method: 'DELETE' });
                                                                    setTemplatesTrigger(p => p + 1);
                                                                }
                                                            }}
                                                            label="Delete template"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Campaigns */}
                            {activeSection === 'campaigns' && campaignAllowed && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                                        <button onClick={() => handleOpenForm()} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                            <FiPlus /> Create Campaign
                                        </button>
                                    </div>
                                    {campaignsLoading ? (
                                        <p className="text-center p-8 text-gray-500">Loading…</p>
                                    ) : campaigns.length === 0 ? (
                                        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                                            <FiRefreshCw className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No campaigns created yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Create your first campaign from the dashboard.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {campaigns.map((campaign) => (
                                                <div key={campaign.campaignId} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition flex flex-col">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-semibold text-gray-900 truncate">{campaign.campaignName}</h3>
                                                        <span className="text-xs text-gray-400 ml-2 shrink-0">{new Date(campaign.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500">Campaign</p>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                                                        <EditIconButton
                                                            onClick={() => handleOpenForm(campaign)}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <DeleteIconButton
                                                            onClick={(e) => openDeleteConfirm(campaign, e)}
                                                            label="Delete campaign"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Audiences */}
                            {activeSection === 'audiences' && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-2xl font-bold text-gray-900">Audiences</h1>
                                        <button onClick={() => { setEditingAudience(null); setIsAudienceModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                            <FiPlus /> Upload Audience
                                        </button>
                                    </div>
                                    {audiencesLoading ? <p className="text-center p-8 text-gray-500">Loading…</p> : audiences.length === 0 ? (
                                        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                                            <FiUsers className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No audiences yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Upload a CSV or Excel sheet to create your first audience.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {audiences.map(a => (
                                                <div key={a.audienceId} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition flex flex-col">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                                                        <span className="text-xs text-gray-400 ml-2 shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500">{a.totalContacts} contacts</p>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {(a.columns || []).slice(0, 4).map((col: string) => (
                                                            <span key={col} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{col}</span>
                                                        ))}
                                                        {(a.columns || []).length > 4 && <span className="text-xs text-gray-400">+{(a.columns || []).length - 4} more</span>}
                                                    </div>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                                                        <EditIconButton
                                                            onClick={() => { setEditingAudience(a); setIsAudienceModalOpen(true); }}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <DeleteIconButton
                                                            onClick={async () => {
                                                                if (confirm(`Delete audience "${a.name}"?`)) {
                                                                    await fetch(`/api/audiences/${a.audienceId}`, { method: 'DELETE' });
                                                                    setAudiencesTrigger(p => p + 1);
                                                                }
                                                            }}
                                                            label="Delete audience"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* One-Time Broadcasts */}
                            {activeSection === 'one-time-broadcast' && oneTimeBroadcastAllowed && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-2xl font-bold text-gray-900">One-Time Broadcasts</h1>
                                        <button onClick={() => { setEditingBroadcast(null); setIsBroadcastModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                            <FiPlus /> New Broadcast
                                        </button>
                                    </div>
                                    {broadcastsLoading ? <p className="text-center p-8 text-gray-500">Loading…</p> : broadcasts.length === 0 ? (
                                        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                                            <FiMail className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No broadcasts yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Click &quot;New Broadcast&quot; to schedule one.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {broadcasts.map(b => (
                                                <div key={b.broadcastId} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition flex flex-col">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-semibold text-gray-900 truncate">{b.name}</h3>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${b.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 truncate">📧 {templates.find(t => t.templateId === b.templateId)?.name || '—'}</p>
                                                    <p className="text-xs text-gray-400 mt-1">📅 {b.sendDate} at {b.sendTime} IST</p>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                                                        <EditIconButton
                                                            onClick={() => { setEditingBroadcast(b); setIsBroadcastModalOpen(true); }}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <DeleteIconButton
                                                            onClick={async () => {
                                                                if (confirm(`Delete broadcast "${b.name}"?`)) {
                                                                    await fetch(`/api/broadcasts/${b.broadcastId}`, { method: 'DELETE' });
                                                                    setBroadcastsTrigger(p => p + 1);
                                                                }
                                                            }}
                                                            label="Delete broadcast"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Date-Based Automations */}
                            {activeSection === 'date-based-automation' && dateBasedAutomationAllowed && (
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-2xl font-bold text-gray-900">Date-Based Automations</h1>
                                        <button onClick={() => { setEditingAutomation(null); setIsDateAutomationModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                            <FiPlus /> New Automation
                                        </button>
                                    </div>
                                    {automationsLoading ? <p className="text-center p-8 text-gray-500">Loading…</p> : automations.length === 0 ? (
                                        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
                                            <FiCalendar className="text-gray-300 text-5xl mx-auto mb-4" />
                                            <p className="text-gray-600 font-semibold">No automations yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Click &quot;New Automation&quot; to create one.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {automations.map(a => (
                                                <div key={a.automationId} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition flex flex-col">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.isActive ? 'Active' : 'Paused'}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 truncate">📧 {templates.find(t => t.templateId === a.templateId)?.name || '—'}</p>
                                                    <p className="text-xs text-gray-400 mt-1">📅 {a.scheduledDates?.length ?? 0} date{a.scheduledDates?.length !== 1 ? 's' : ''} scheduled</p>
                                                    <p className="text-xs text-gray-400">✓ {a.sentDates?.length ?? 0} sent</p>
                                                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
                                                        <EditIconButton
                                                            onClick={() => { setEditingAutomation(a); setIsDateAutomationModalOpen(true); }}
                                                            themeColor={settings.themeColor}
                                                        />
                                                        <DeleteIconButton
                                                            onClick={async () => {
                                                                if (confirm(`Delete automation "${a.name}"?`)) {
                                                                    await fetch(`/api/date-automations/${a.automationId}`, { method: 'DELETE' });
                                                                    setAutomationsTrigger(p => p + 1);
                                                                }
                                                            }}
                                                            label="Delete automation"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                (emailTemplateAllowed || campaignAllowed || emailLogsAllowed || oneTimeBroadcastAllowed || dateBasedAutomationAllowed || true) && (
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
                        <CampaignForm isOpen={isCampaignFormOpen} onClose={handleCloseForm} onSubmit={handleFormSubmit} editCampaign={editingCampaign} onToggleSentToday={handleToggleSentToday} />

                        {campaignToDelete && (
                            <DeleteConfirmationModal
                                campaignName={campaignToDelete.campaignName}
                                onConfirm={handleDelete}
                                onCancel={() => setCampaignToDelete(null)}
                            />
                        )}
                        {/* ADD THIS NEW BLOCK */}
                        {viewingCampaign && (
                            <TemplatePreviewModal
                                campaign={viewingCampaign}
                                onClose={handleCloseTemplate}
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

                {/* New feature modals */}
                <TemplateModal
                    isOpen={isTemplateModalOpen}
                    onClose={() => setIsTemplateModalOpen(false)}
                    onSaved={() => setTemplatesTrigger(p => p + 1)}
                    editTemplate={editingTemplate}
                />
                {viewingTemplate && (
                    <EmailTemplatePreviewModal
                        template={viewingTemplate}
                        onClose={() => setViewingTemplate(null)}
                    />
                )}
                <AudienceModal
                    isOpen={isAudienceModalOpen}
                    onClose={() => { setIsAudienceModalOpen(false); setEditingAudience(null); }}
                    onSaved={() => setAudiencesTrigger(p => p + 1)}
                    editAudience={editingAudience}
                />
                <BroadcastModal
                    isOpen={isBroadcastModalOpen}
                    onClose={() => setIsBroadcastModalOpen(false)}
                    onSaved={() => setBroadcastsTrigger(p => p + 1)}
                    editBroadcast={editingBroadcast}
                />
                <DateAutomationModal
                    isOpen={isDateAutomationModalOpen}
                    onClose={() => setIsDateAutomationModalOpen(false)}
                    onSaved={() => setAutomationsTrigger(p => p + 1)}
                    editAutomation={editingAutomation}
                />
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

// Quick Create Card helper
const QuickCreateCard = ({ icon, title, desc, btnLabel, themeColor, onClick }: { icon: React.ReactNode; title: string; desc: string; btnLabel: string; themeColor: string; onClick: () => void }) => (
    <div
        onClick={onClick}
        className="bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200 cursor-pointer transition-all"
        onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
    >
        <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full mb-4" style={{ backgroundColor: `${themeColor}20` }}>
                <span style={{ color: themeColor }} className="text-2xl">{icon}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-4">{desc}</p>
            <button className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm" style={{ backgroundColor: themeColor }}>{btnLabel}</button>
        </div>
    </div>
);
