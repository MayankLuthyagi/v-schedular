'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HiArrowLeft, HiRefresh, HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { FiX } from "react-icons/fi";
import ViewIconButton from '@/components/ViewIconButton';

// --- Types (from your original code) ---
interface EmailLog {
    _id: string;
    campaignId: string;
    recipientEmail: string;
    senderEmail: string;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    status: 'sent' | 'failed' | 'opened' | 'bounced';
    sentAt: string;
    openedAt?: string;
    bouncedAt?: string;
    failureReason?: string;
    failureCategory?: string;
    bounceReason?: string;
    bounceCategory?: string;
    originalError?: string;
}

type LogFilter = 'all' | 'today' | 'failed' | 'sent' | 'opened' | 'bounced';

// --- Custom Hook for Data & Logic ---
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

    return {
        logs, loading, error,
        filter, setFilter,
        searchTerm, setSearchTerm,
        page, setPage, totalPages,
        refresh: () => fetchLogs(filter, searchTerm, page),
        markAsBounced,
    };
};


// --- Main Page Component ---
export default function EmailLogsPage() {
    const { logs, loading, error, filter, setFilter, searchTerm, setSearchTerm, page, setPage, totalPages, refresh, markAsBounced } = useEmailLogs();
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [isBounceModalOpen, setBounceModalOpen] = useState(false);

    const handleOpenBounceModal = () => {
        setBounceModalOpen(true);
    };

    const handleCloseBounceModal = () => {
        setBounceModalOpen(false);
    };

    return (
        <>
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-lg shadow-md">
                        {/* Header */}
                        <div className="border-b p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 transition">
                                    <HiArrowLeft className="w-5 h-5 mr-2" />
                                    Dashboard
                                </Link>
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Email Logs</h1>
                            </div>
                            <button onClick={refresh} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                                <HiRefresh className="w-4 h-4 mr-2" />
                                Refresh
                            </button>
                        </div>

                        {/* Filters and Search */}
                        <div className="p-4 border-b">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-shrink-0 flex flex-wrap gap-2">
                                    {['all', 'today', 'sent', 'failed', 'opened', 'bounced'].map(f => (
                                        <FilterButton key={f} active={filter === f} onClick={() => setFilter(f as LogFilter)}>
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </FilterButton>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by recipient, sender, or campaign ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Content Table */}
                        <div className="overflow-x-auto">
                            {loading && <p className="text-center p-8">Loading...</p>}
                            {error && <p className="text-center p-8 text-red-600">{error}</p>}
                            {!loading && !error && logs.length === 0 && <p className="text-center p-8 text-gray-600">No logs found for this filter.</p>}
                            {!loading && !error && logs.length > 0 && (
                                <table className="min-w-full divide-y">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Recipient</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Sender</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Sent At</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y">
                                        {logs.map((log) => (
                                            <tr key={log._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={log.status} /></td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{log.recipientEmail}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.senderEmail}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(log.sentAt).toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <ViewIconButton onClick={() => setSelectedLog(log)} label="View Details" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onMarkAsBounced={handleOpenBounceModal} />}
            {isBounceModalOpen && selectedLog && <BounceModal log={selectedLog} onClose={handleCloseBounceModal} onConfirm={markAsBounced} />}
        </>
    );
}


// --- Sub-components for UI ---
interface FilterButtonProps {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

const FilterButton = ({ active, onClick, children }: FilterButtonProps) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
    >
        {children}
    </button>
);

const StatusBadge = ({ status }: { status: EmailLog['status'] }) => {
    const styles: Record<string, string> = {
        sent: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
        opened: "bg-blue-100 text-blue-800",
        bounced: "bg-yellow-100 text-yellow-800",
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
};

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => (
    <div className="p-4 border-t flex items-center justify-between text-sm">
        <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
        <div className="flex gap-2">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded disabled:opacity-50"><HiChevronLeft /></button>
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded disabled:opacity-50"><HiChevronRight /></button>
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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-medium">Log Details</h3>
                <button onClick={onClose}><FiX /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600">Status</span>
                    <span className="col-span-2"><StatusBadge status={log.status} /></span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600">Recipient</span>
                    <span className="col-span-2">{log.recipientEmail}</span>
                </div>
                {/* Add other details similarly */}
                <div className="grid grid-cols-3 gap-4">
                    <span className="font-medium text-gray-600">Sent At</span>
                    <span className="col-span-2">{new Date(log.sentAt).toLocaleString()}</span>
                </div>
                {log.failureReason && (
                    <div className="grid grid-cols-3 gap-4">
                        <span className="font-medium text-gray-600">Failure Reason</span>
                        <span className="col-span-2 text-red-600">{log.failureReason}</span>
                    </div>
                )}
            </div>
            {log.status === 'sent' && (
                <div className="p-4 bg-gray-50 border-t">
                    <button onClick={onMarkAsBounced} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm">
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-medium">Mark as Bounced</h3>
                    <button onClick={onClose}><FiX /></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm">You are marking <strong>{log.recipientEmail}</strong> as bounced. This will add them to the suppression list.</p>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Enter bounce reason (e.g., 'Mailbox full')"
                        className="w-full p-2 border rounded"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-yellow-500 text-white rounded disabled:bg-yellow-300">
                        {isSubmitting ? 'Submitting...' : 'Confirm Bounce'}
                    </button>
                </div>
            </div>
        </div>
    );
};