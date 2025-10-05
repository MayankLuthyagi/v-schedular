'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HiArrowLeft, HiRefresh, HiEye, HiX } from "react-icons/hi";

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
    failureCategory?: 'validation' | 'authentication' | 'rate_limit' | 'network' | 'recipient' | 'attachment' | 'configuration' | 'unknown';
    bounceReason?: string;
    bounceCategory?: 'validation' | 'recipient';
    originalError?: string;
}

export default function EmailLogsPage() {
    const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'all' | 'today' | 'failed' | 'sent' | 'opened' | 'bounced'>('today');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
    const [markingBounced, setMarkingBounced] = useState(false);

    const fetchEmailLogs = useCallback(async () => {
        try {
            setLoading(true);
            const queryParam = filter === 'today' ? '?today=true' : '';
            const response = await fetch(`/api/emailLog${queryParam}`);
            const data = await response.json();

            if (Array.isArray(data)) {
                let filteredData = data;

                // Apply status filter
                if (filter === 'failed') {
                    filteredData = data.filter((log: EmailLog) => log.status === 'failed');
                } else if (filter === 'sent') {
                    filteredData = data.filter((log: EmailLog) => log.status === 'sent');
                } else if (filter === 'opened') {
                    filteredData = data.filter((log: EmailLog) => log.status === 'opened');
                } else if (filter === 'bounced') {
                    filteredData = data.filter((log: EmailLog) => log.status === 'bounced');
                }

                setEmailLogs(filteredData);
            } else {
                setError('Failed to fetch email logs');
            }
        } catch (err) {
            setError('Failed to fetch email logs');
            console.error('Error fetching email logs:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchEmailLogs();
    }, [fetchEmailLogs]);

    const filteredLogs = emailLogs.filter(log =>
        log.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.senderEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.campaignId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
        switch (status) {
            case 'sent':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'failed':
                return `${baseClasses} bg-red-100 text-red-800`;
            case 'opened':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'bounced':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sent':
                return '✅';
            case 'failed':
                return '❌';
            case 'opened':
                return '👁️';
            case 'bounced':
                return '⚠️';
            default:
                return '❓';
        }
    };

    const markAsBounced = async (emailLog: EmailLog, reason: string) => {
        try {
            setMarkingBounced(true);
            const response = await fetch('/api/bounce', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipientEmail: emailLog.recipientEmail,
                    reason: reason
                }),
            });

            const data = await response.json();
            if (data.success) {
                // Refresh the email logs
                fetchEmailLogs();
                setSelectedLog(null);
                alert('Email marked as bounced successfully');
            } else {
                alert(`Failed to mark email as bounced: ${data.error}`);
            }
        } catch (error) {
            console.error('Error marking email as bounced:', error);
            alert('Failed to mark email as bounced');
        } finally {
            setMarkingBounced(false);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-lg shadow-lg">
                        {/* Header */}
                        <div className="border-b border-gray-200 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <Link
                                        href="/dashboard"
                                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        <HiArrowLeft className="w-5 h-5 mr-2" />
                                        Back to Admin
                                    </Link>
                                    <h1 className="text-2xl font-bold text-gray-900">Email Logs</h1>
                                </div>
                                <button
                                    onClick={fetchEmailLogs}
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <HiRefresh className="w-4 h-4 mr-2" />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* Filters and Search */}
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                                <div className="flex space-x-2">
                                    {['all', 'today', 'sent', 'failed', 'opened', 'bounced'].map((filterOption) => (
                                        <button
                                            key={filterOption}
                                            onClick={() => setFilter(filterOption as 'all' | 'today' | 'sent' | 'failed' | 'opened' | 'bounced')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === filterOption
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search by email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : error ? (
                                <div className="text-center py-8">
                                    <p className="text-red-600">{error}</p>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-600">No email logs found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Recipient
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Sender
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Sent At
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredLogs.map((log) => (
                                                <tr key={log._id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <span className="mr-2">{getStatusIcon(log.status)}</span>
                                                            <span className={getStatusBadge(log.status)}>
                                                                {log.status}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{log.recipientEmail}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-600">{log.senderEmail}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-600">
                                                            {new Date(log.sentAt).toLocaleString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <button
                                                            onClick={() => setSelectedLog(log)}
                                                            className="text-blue-600 hover:text-blue-900 transition-colors"
                                                        >
                                                            <HiEye className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Detail Modal */}
                {selectedLog && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                            <div className="mt-3">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-medium text-gray-900">Email Log Details</h3>
                                    <button
                                        onClick={() => setSelectedLog(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <HiX className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Status</label>
                                        <div className="mt-1 flex items-center">
                                            <span className="mr-2">{getStatusIcon(selectedLog.status)}</span>
                                            <span className={getStatusBadge(selectedLog.status)}>
                                                {selectedLog.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Recipient Email</label>
                                        <p className="mt-1 text-sm text-gray-900">{selectedLog.recipientEmail}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Sender Email</label>
                                        <p className="mt-1 text-sm text-gray-900">{selectedLog.senderEmail}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Campaign ID</label>
                                        <p className="mt-1 text-sm text-gray-900 font-mono">{selectedLog.campaignId}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Send Method</label>
                                        <p className="mt-1 text-sm text-gray-900 capitalize">
                                            {selectedLog.sendMethod}
                                            {(selectedLog.sendMethod === 'cc' || selectedLog.sendMethod === 'bcc') && (
                                                <span className="ml-2 text-xs text-gray-500">(No open tracking)</span>
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Sent At</label>
                                        <p className="mt-1 text-sm text-gray-900">{new Date(selectedLog.sentAt).toLocaleString()}</p>
                                    </div>
                                    {selectedLog.openedAt && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Opened At</label>
                                            <p className="mt-1 text-sm text-gray-900">{new Date(selectedLog.openedAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                    {selectedLog.failureReason && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Failure Reason
                                                {selectedLog.failureCategory && (
                                                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${selectedLog.failureCategory === 'validation' ? 'bg-yellow-100 text-yellow-800' :
                                                        selectedLog.failureCategory === 'authentication' ? 'bg-red-100 text-red-800' :
                                                            selectedLog.failureCategory === 'rate_limit' ? 'bg-orange-100 text-orange-800' :
                                                                selectedLog.failureCategory === 'network' ? 'bg-purple-100 text-purple-800' :
                                                                    selectedLog.failureCategory === 'recipient' ? 'bg-blue-100 text-blue-800' :
                                                                        selectedLog.failureCategory === 'attachment' ? 'bg-green-100 text-green-800' :
                                                                            selectedLog.failureCategory === 'configuration' ? 'bg-pink-100 text-pink-800' :
                                                                                'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {selectedLog.failureCategory}
                                                    </span>
                                                )}
                                            </label>
                                            <p className="mt-1 text-sm text-red-600">{selectedLog.failureReason}</p>
                                            {selectedLog.originalError && selectedLog.originalError !== selectedLog.failureReason && (
                                                <p className="mt-1 text-xs text-gray-500">Original: {selectedLog.originalError}</p>
                                            )}
                                        </div>
                                    )}
                                    {selectedLog.bounceReason && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Bounce Reason
                                                {selectedLog.bounceCategory && (
                                                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${selectedLog.bounceCategory === 'validation' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {selectedLog.bounceCategory}
                                                    </span>
                                                )}
                                            </label>
                                            <p className="mt-1 text-sm text-yellow-600">{selectedLog.bounceReason}</p>
                                        </div>
                                    )}
                                    {selectedLog.bouncedAt && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Bounced At</label>
                                            <p className="mt-1 text-sm text-gray-900">{new Date(selectedLog.bouncedAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons for sent emails */}
                                {selectedLog.status === 'sent' && (
                                    <div className="mt-6 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                const reason = prompt('Enter bounce reason:');
                                                if (reason) {
                                                    markAsBounced(selectedLog, reason);
                                                }
                                            }}
                                            disabled={markingBounced}
                                            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {markingBounced ? 'Marking as Bounced...' : 'Mark as Bounced'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}