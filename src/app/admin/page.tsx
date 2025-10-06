'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import DashboardLayout from '@/components/admin/DashboardLayout';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import StatCard from '@/components/admin/StatCard';
import { useTheme, useFeatureAllowed } from '@/contexts/ThemeContext';
import { FiUsers, FiMail, FiCheckCircle, FiEye, FiX, FiRefreshCw, FiChevronLeft, FiChevronRight, FiAlertTriangle, FiAlertCircle, FiEdit, FiTrash2, FiPlus } from 'react-icons/fi';
import { EmailLog } from '@/types/emailLog';
interface AuthUser {
    _id: string;
    name: string;
    email: string;
    createdAt: string; // Assuming your API returns this
}

interface AuthEmail {
    _id: string;
    name: string;
    main: string;
    email: string;
    app_password: string;
    createdAt: string; // Assuming your API returns this
}

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
                const openedLogs = emailLogs.filter(e => e.status === 'opened' && e.sendMethod !== 'cc' && e.sendMethod !== 'bcc');

                const sent = sentLogs.length;
                const opened = openedLogs.length;

                setStats({
                    sent,
                    total,
                    opened,
                    sentPercentage: total > 0 ? ((sent / total) * 100).toFixed(1) : '0.00',
                    openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.00'
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
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = useCallback(async (currentFilter: LogFilter, currentSearch: string, currentPage: number) => {
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
        // Debounce search term to avoid excessive API calls
        const handler = setTimeout(() => {
            fetchLogs(filter, searchTerm, page);
        }, 300); // 300ms delay

        return () => clearTimeout(handler);
    }, [filter, searchTerm, page, fetchLogs]);

    const markAsBounced = async (log: EmailLog, reason: string) => {
        try {
            const response = await fetch('/api/bounce', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientEmail: log.recipientEmail, reason }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'API error');
            fetchLogs(filter, searchTerm, page); // Refresh logs on success
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : 'An error occurred' };
        }
    };

    const deleteAllLogs = async () => {
        try {
            const response = await fetch('/api/emailLog', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to delete all logs');
            fetchLogs(filter, searchTerm, page); // Refresh logs on success
            return { success: true };
        } catch (err: unknown) {
            return { success: false, error: err instanceof Error ? err.message : 'An error occurred' };
        }
    };

    return {
        logs, loading, error,
        filter, setFilter,
        searchTerm, setSearchTerm,
        page, setPage, totalPages,
        refresh: () => fetchLogs(filter, searchTerm, page),
        markAsBounced,
        deleteAllLogs,
    };
};

export default function AdminDashboardPage() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [emails, setEmails] = useState<AuthEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'email-logs' | 'users' | 'emails'>('email-logs');
    const { settings } = useTheme();
    const emailLogsAllowed = useFeatureAllowed('emailLogs');
    const { stats, isLoading: statsLoading } = useDashboardStats();
    const { logs, loading: logsLoading, error: logsError, filter, setFilter, searchTerm, setSearchTerm, page, setPage, totalPages, refresh: refreshLogs, markAsBounced, deleteAllLogs } = useEmailLogs();

    // Modal states
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [isBounceModalOpen, setBounceModalOpen] = useState(false);
    const [isDeleteAllModalOpen, setDeleteAllModalOpen] = useState(false);

    // User management modal states
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isEmailModalOpen, setEmailModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
    const [editingEmail, setEditingEmail] = useState<AuthEmail | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '' });
    const [emailForm, setEmailForm] = useState({ name: '', main: '', email: '', app_password: '' });
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'user' | 'email', id: string, email: string } | null>(null);

    const handleOpenBounceModal = () => {
        setBounceModalOpen(true);
    };

    const handleCloseBounceModal = () => {
        setBounceModalOpen(false);
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
            // You could add a notification here if you have one
            console.log('All logs deleted successfully');
        } else {
            console.error('Failed to delete logs:', result.error);
        }
        setDeleteAllModalOpen(false);
    };

    // Function to scroll to email logs section
    const scrollToEmailLogs = () => {
        const emailLogsSection = document.getElementById('email-logs-section');
        if (emailLogsSection) {
            emailLogsSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Handler for stat card clicks
    const handleDeliveryClick = () => {
        setActiveSection('email-logs');
        setFilter('today');
        setTimeout(scrollToEmailLogs, 100); // Small delay to ensure filter is set
    };

    const handleOpenRateClick = () => {
        setActiveSection('email-logs');
        setFilter('opened');
        setTimeout(scrollToEmailLogs, 100); // Small delay to ensure filter is set
    };

    // User management handlers
    const handleAddUser = () => {
        setEditingUser(null);
        setUserForm({ name: '', email: '' });
        setUserModalOpen(true);
    };

    const handleEditUser = (user: AuthUser) => {
        setEditingUser(user);
        setUserForm({ name: user.name, email: user.email });
        setUserModalOpen(true);
    };

    const handleDeleteUser = (user: AuthUser) => {
        setDeleteConfirm({ type: 'user', id: user._id, email: user.email });
    };

    const handleAddEmail = () => {
        setEditingEmail(null);
        setEmailForm({ name: '', main: '', email: '', app_password: '' });
        setEmailModalOpen(true);
    };

    const handleEditEmail = (email: AuthEmail) => {
        setEditingEmail(email);
        setEmailForm({ name: email.name, main: email.main, email: email.email, app_password: email.app_password });
        setEmailModalOpen(true);
    };

    const handleDeleteEmail = (email: AuthEmail) => {
        setDeleteConfirm({ type: 'email', id: email._id, email: email.email });
    };

    const handleUserSubmit = async () => {
        try {
            const url = editingUser ? `/api/authUsers/${editingUser._id}` : '/api/authUsers';
            const method = editingUser ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userForm),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save user');

            // Refresh users list
            fetchData();
            setUserModalOpen(false);
        } catch (error: unknown) {
            console.error('Error saving user:', error instanceof Error ? error.message : 'An error occurred');
            // You could show an error notification here
        }
    };

    const handleEmailSubmit = async () => {
        try {
            const url = editingEmail ? `/api/authEmails/${editingEmail._id}` : '/api/authEmails';
            const method = editingEmail ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailForm),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save email');

            // Refresh emails list
            fetchData();
            setEmailModalOpen(false);
        } catch (error: unknown) {
            console.error('Error saving email:', error instanceof Error ? error.message : 'An error occurred');
            // You could show an error notification here
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;

        try {
            const url = deleteConfirm.type === 'user'
                ? `/api/authUsers/${deleteConfirm.id}`
                : `/api/authEmails/${deleteConfirm.id}`;

            const response = await fetch(url, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to delete');

            // Refresh data
            fetchData();
            setDeleteConfirm(null);
        } catch (error: unknown) {
            console.error('Error deleting:', error instanceof Error ? error.message : 'An error occurred');
            // You could show an error notification here
        }
    };

    // Function to fetch users and emails data
    const fetchData = async () => {
        try {
            const [usersResponse, emailsResponse] = await Promise.all([
                fetch('/api/authUsers'),
                fetch('/api/authEmails')
            ]);

            const usersData = await usersResponse.json();
            const emailsData = await emailsResponse.json();

            if (usersData.success) {
                const sortedUsers = usersData.users.sort((a: AuthUser, b: AuthUser) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setUsers(sortedUsers);
            }
            if (emailsData.success) {
                const sortedEmails = emailsData.emails.sort((a: AuthEmail, b: AuthEmail) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setEmails(sortedEmails);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <AdminProtectedRoute>
                <DashboardLayout>
                    <SkeletonLoader />
                </DashboardLayout>
            </AdminProtectedRoute>
        );
    }

    return (
        <AdminProtectedRoute>
            <DashboardLayout>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Stat Cards take the full width on small screens, and 1/3 on large */}
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div onClick={() => setActiveSection('users')} className="cursor-pointer">
                            <StatCard
                                title="Authorized Users"
                                value={users.length}
                                icon={<FiUsers />}
                                color="white"
                                linkLabel="View Users"
                            />
                        </div>
                        <div onClick={() => setActiveSection('emails')} className="cursor-pointer">
                            <StatCard
                                title="Sender Emails"
                                value={emails.length}
                                icon={<FiMail />}
                                color="white"
                                linkLabel="View Emails"
                            />
                        </div>
                        {emailLogsAllowed && (
                            <>
                                {/* Today's Delivery Stat */}
                                <AdminStatCard
                                    title="Today's Delivery"
                                    value={stats.sent}
                                    total={stats.total}
                                    percentage={stats.sentPercentage}
                                    isLoading={statsLoading}
                                    icon={<FiMail />}
                                    onClick={handleDeliveryClick}
                                    themeColor={settings.themeColor}
                                />
                                {/* Today's Open Rate Stat */}
                                <AdminStatCard
                                    title="Today's Open Rate"
                                    value={stats.opened}
                                    total={stats.sent}
                                    percentage={stats.openRate}
                                    isLoading={statsLoading}
                                    note="(One-on-One)"
                                    icon={<FiCheckCircle />}
                                    onClick={handleOpenRateClick}
                                    themeColor={settings.themeColor}
                                />
                            </>
                        )}
                    </div>

                    {/* Section Navigation */}
                    <div className="lg:col-span-3 mt-8">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="border-b border-gray-200 dark:border-gray-700">
                                <nav className="-mb-px flex">
                                    {emailLogsAllowed && (
                                        <button
                                            onClick={() => setActiveSection('email-logs')}
                                            className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer ${activeSection === 'email-logs'
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            Email Logs
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setActiveSection('users')}
                                        className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer ${activeSection === 'users'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        Authorized Users ({users.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveSection('emails')}
                                        className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors cursor-pointer ${activeSection === 'emails'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        Sender Emails ({emails.length})
                                    </button>
                                </nav>
                            </div>

                            {/* Email Logs Section */}
                            {emailLogsAllowed && activeSection === 'email-logs' && (
                                <>
                                    {/* Header */}
                                    <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Email Logs</h2>
                                        <div className='flex gap-2'>
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
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-shrink-0 flex flex-wrap gap-2">
                                                {['all', 'today', 'sent', 'failed', 'opened', 'bounced'].map(f => (
                                                    <FilterButton key={f} active={filter === f} onClick={() => setFilter(f as LogFilter)} themeColor={settings.themeColor}>
                                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                                    </FilterButton>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Search by recipient, sender, or campaign ID..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full md:max-w-xs px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Table */}
                                    <div className="overflow-x-auto">
                                        {logsLoading && <p className="text-center p-8 text-gray-600 dark:text-gray-400">Loading...</p>}
                                        {logsError && <p className="text-center p-8 text-red-600">{logsError}</p>}
                                        {!logsLoading && !logsError && logs.length === 0 && <p className="text-center p-8 text-gray-600 dark:text-gray-400">No logs found for this filter.</p>}
                                        {!logsLoading && !logsError && logs.length > 0 && (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recipient</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sender</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sent At</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {logs.map((log, index) => (
                                                        <tr key={`${log.campaignId}-${log.recipientEmail}-${log.sentAt}-${index}`} >
                                                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={log.status} /></td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.recipientEmail}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{log.senderEmail}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{new Date(log.sentAt).toLocaleString()}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <button
                                                                    onClick={() => setSelectedLog(log)}
                                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
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
                                    {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
                                </>
                            )}

                            {/* Users Section */}
                            {activeSection === 'users' && (
                                <>
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Authorized Users</h2>
                                        <button
                                            onClick={handleAddUser}
                                            className="flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm cursor-pointer"
                                            style={{ backgroundColor: settings.themeColor }}
                                        >
                                            <FiPlus className="w-4 h-4 mr-2" />
                                            Add User
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {loading ? (
                                            <p className="text-center p-8 text-gray-600 dark:text-gray-400">Loading...</p>
                                        ) : users.length === 0 ? (
                                            <p className="text-center p-8 text-gray-600 dark:text-gray-400">No authorized users found.</p>
                                        ) : (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created At</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {users.map((user) => (
                                                        <tr key={user._id}>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.email}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                                {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                <div className="flex items-center space-x-4">
                                                                    <button
                                                                        onClick={() => handleEditUser(user)}
                                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                                                                        title="Edit user"
                                                                    >
                                                                        <FiEdit className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(user)}
                                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                        title="Delete user"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Emails Section */}
                            {activeSection === 'emails' && (
                                <>
                                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Sender Emails</h2>
                                        <button
                                            onClick={handleAddEmail}
                                            className="flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition text-sm cursor-pointer"
                                            style={{ backgroundColor: settings.themeColor }}
                                        >
                                            <FiPlus className="w-4 h-4 mr-2" />
                                            Add Email
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {loading ? (
                                            <p className="text-center p-8 text-gray-600 dark:text-gray-400">Loading...</p>
                                        ) : emails.length === 0 ? (
                                            <p className="text-center p-8 text-gray-600 dark:text-gray-400">No sender emails found.</p>
                                        ) : (
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Main</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">App Password</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created At</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {emails.map((email) => (
                                                        <tr key={email._id}>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{email.name}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{email.main}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{email.email}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                                {email.app_password}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                                {email.createdAt ? new Date(email.createdAt).toLocaleString() : 'N/A'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                <div className="flex items-center space-x-4">
                                                                    <button
                                                                        onClick={() => handleEditEmail(email)}
                                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                                                                        title="Edit email"
                                                                    >
                                                                        <FiEdit className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteEmail(email)}
                                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                                                                        title="Delete email"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}

                        </div>
                    </div>
                </div>
            </DashboardLayout>

            {/* Modals */}
            {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onMarkAsBounced={handleOpenBounceModal} />}
            {isBounceModalOpen && selectedLog && <BounceModal log={selectedLog} onClose={handleCloseBounceModal} onConfirm={markAsBounced} />}
            {isDeleteAllModalOpen && <DeleteAllModal onClose={handleCloseDeleteAllModal} onConfirm={handleDeleteAllConfirm} />}

            {/* User and Email Management Modals */}
            <UserModal
                isOpen={isUserModalOpen}
                onClose={() => setUserModalOpen(false)}
                onSubmit={handleUserSubmit}
                userForm={userForm}
                setUserForm={setUserForm}
                editingUser={editingUser}
            />
            <EmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                onSubmit={handleEmailSubmit}
                emailForm={emailForm}
                setEmailForm={setEmailForm}
                editingEmail={editingEmail}
            />
            <DeleteConfirmModal
                deleteConfirm={deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleConfirmDelete}
            />
        </AdminProtectedRoute>
    );
}

// Custom AdminStatCard component for dashboard-style stats
interface AdminStatCardProps {
    title: string;
    value: string | number;
    total?: number;
    percentage?: number | string;
    isLoading: boolean;
    note?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    themeColor: string;
}

const AdminStatCard = ({ title, value, total, percentage, isLoading, note, onClick, icon, themeColor }: AdminStatCardProps) => {
    const isClickable = !!onClick;
    const containerClasses = `
        bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
        ${isClickable ? 'cursor-pointer hover:shadow-xl transition-all duration-300' : ''}
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
                <div className="flex items-start justify-between mb-2">
                    <p className="text-base font-semibold text-gray-600 dark:text-gray-300">{title}</p>
                    {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
                </div>
                <div className="flex items-end mt-2">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                    {total !== undefined && <p className="text-lg font-medium text-gray-500 dark:text-gray-400 ml-2">/ {total}</p>}
                </div>
                {percentage !== undefined && (
                    <div className="mt-4">
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Progress</span>
                            <span className="text-sm font-medium" style={{ color: themeColor }}>{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: themeColor }}></div>
                        </div>
                    </div>
                )}
                {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{note}</p>}
            </>}
        </div>
    );
};

// --- UI Components for Email Logs ---
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

const StatusBadge = ({ status }: { status: EmailLog['status'] }) => {
    const styles: Record<string, string> = {
        sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        opened: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
        bounced: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 dark:bg-gray-700'}`}>{status}</span>;
};

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
        <div className="flex gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
                <FiChevronLeft />
            </button>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
                <FiChevronRight />
            </button>
        </div>
    </div>
);

interface DetailModalProps {
    log: EmailLog;
    onClose: () => void;
    onMarkAsBounced: () => void;
}

const DetailModal = ({ log, onClose, onMarkAsBounced }: DetailModalProps) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Log Details</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FiX />
                </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Status</span>
                    <span className="col-span-2"><StatusBadge status={log.status} /></span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Recipient</span>
                    <span className="col-span-2 text-gray-900 dark:text-gray-100">{log.recipientEmail}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Sender</span>
                    <span className="col-span-2 text-gray-900 dark:text-gray-100">{log.senderEmail}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Send Method</span>
                    <span className="col-span-2 text-gray-900 dark:text-gray-100">{log.sendMethod}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Sent At</span>
                    <span className="col-span-2 text-gray-900 dark:text-gray-100">{new Date(log.sentAt).toLocaleString()}</span>
                </div>
                {log.openedAt && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Opened At</span>
                        <span className="col-span-2 text-gray-900 dark:text-gray-100">{new Date(log.openedAt).toLocaleString()}</span>
                    </div>
                )}
                {log.failureReason && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Failure Reason</span>
                        <span className="col-span-2 text-red-600 dark:text-red-400">{log.failureReason}</span>
                    </div>
                )}
                {log.failureCategory && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Failure Category</span>
                        <span className="col-span-2 text-red-600 dark:text-red-400">{log.failureCategory}</span>
                    </div>
                )}
                {log.originalError && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Original Error</span>
                        <span className="col-span-2 text-red-600 dark:text-red-400 text-xs font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">{log.originalError}</span>
                    </div>
                )}
                {log.bounceReason && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Bounce Reason</span>
                        <span className="col-span-2 text-yellow-600 dark:text-yellow-400">{log.bounceReason}</span>
                    </div>
                )}
                {log.bounceCategory && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Bounce Category</span>
                        <span className="col-span-2 text-yellow-600 dark:text-yellow-400">{log.bounceCategory}</span>
                    </div>
                )}
            </div>
            {log.status === 'sent' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <button
                        onClick={onMarkAsBounced}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium transition"
                    >
                        Mark as Bounced
                    </button>
                </div>
            )}
        </div>
    </div>
);

interface BounceModalProps {
    log: EmailLog;
    onClose: () => void;
    onConfirm: (log: EmailLog, reason: string) => Promise<{ success: boolean; error?: string }>;
}

const BounceModal = ({ log, onClose, onConfirm }: BounceModalProps) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!reason) {
            setError('Bounce reason is required.');
            return;
        }
        setSubmitting(true);
        setError('');
        const result = await onConfirm(log, reason);
        if (result.success) {
            onClose();
        } else {
            setError(result.error || 'An error occurred');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mark as Bounced</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <FiX />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                        <FiAlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            You are marking <strong>{log.recipientEmail}</strong> as bounced. This will add them to the suppression list.
                        </p>
                    </div>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter bounce reason (e.g., 'Mailbox full')"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
                    />
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-yellow-500 text-white rounded disabled:bg-yellow-300 hover:bg-yellow-600 transition"
                    >
                        {isSubmitting ? 'Submitting...' : 'Confirm Bounce'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeleteAllModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
                        <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mt-5">Delete All Email Logs</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Are you sure you want to delete all email logs? This action cannot be undone and will permanently remove all log data.
                    </p>
                </div>
                <div className="mt-6 flex justify-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition"
                    >
                        Delete All
                    </button>
                </div>
            </div>
        </div>
    );
};

// User Modal Component
interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    userForm: { name: string; email: string };
    setUserForm: (form: { name: string; email: string }) => void;
    editingUser: AuthUser | null;
}

const UserModal = ({ isOpen, onClose, onSubmit, userForm, setUserForm, editingUser }: UserModalProps) => {
    const { settings } = useTheme();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                        {editingUser ? 'Edit User' : 'Add User'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 cursor-pointer">
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
                            Name
                        </label>
                        <input
                            id="userName"
                            type="text"
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter full name"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700  mb-2">
                            Email Address
                        </label>
                        <input
                            id="userEmail"
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter email address"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-white rounded transition cursor-pointer"
                            style={{ backgroundColor: settings.themeColor }}
                        >
                            {editingUser ? 'Update' : 'Add'} User
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Email Modal Component
interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    emailForm: { name: string; main: string; email: string; app_password: string };
    setEmailForm: (form: { name: string; main: string; email: string; app_password: string }) => void;
    editingEmail: AuthEmail | null;
}

const EmailModal = ({ isOpen, onClose, onSubmit, emailForm, setEmailForm, editingEmail }: EmailModalProps) => {
    const { settings } = useTheme();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {editingEmail ? 'Edit Email' : 'Add Email'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="emailName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Name
                        </label>
                        <input
                            id="emailName"
                            type="text"
                            value={emailForm.name}
                            onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter sender name"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="emailMain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Main
                        </label>
                        <input
                            id="emailMain"
                            type="text"
                            value={emailForm.main}
                            onChange={(e) => setEmailForm({ ...emailForm, main: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter main identifier"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Address
                        </label>
                        <input
                            id="emailAddress"
                            type="email"
                            value={emailForm.email}
                            onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter email address"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="appPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            App Password
                        </label>
                        <input
                            id="appPassword"
                            type="password"
                            value={emailForm.app_password}
                            onChange={(e) => setEmailForm({ ...emailForm, app_password: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Enter app password"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-white rounded transition cursor-pointer"
                            style={{ backgroundColor: settings.themeColor }}
                        >
                            {editingEmail ? 'Update' : 'Add'} Email
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Delete Confirmation Modal Component
interface DeleteConfirmModalProps {
    deleteConfirm: { type: 'user' | 'email'; id: string; email: string } | null;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteConfirmModal = ({ deleteConfirm, onClose, onConfirm }: DeleteConfirmModalProps) => {
    if (!deleteConfirm) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete {deleteConfirm.type === 'user' ? 'User' : 'Email'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <FiX />
                    </button>
                </div>
                <div className="p-6">
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
                            <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mt-5">
                            Are you sure?
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            You are about to delete the {deleteConfirm.type} &ldquo;{deleteConfirm.email}&rdquo;. This action cannot be undone.
                        </p>
                    </div>
                    <div className="mt-6 flex justify-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};