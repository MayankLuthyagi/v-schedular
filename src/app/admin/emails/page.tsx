'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ToastViewport from '@/components/ToastViewport';
import EditIconButton from '@/components/EditIconButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/useToast';
import { HiPlus, HiArrowLeft } from "react-icons/hi";
interface Email {
    _id: string;
    name: string;
    main: string;
    email: string;
    app_password: string;
    createdAt: string;
    updatedAt: string;
}

export default function ManageEmailPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEmail, setNewEmail] = useState({ email: '', name: '', main: '', app_password: '' });
    const [addingEmail, setAddingEmail] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingEmail, setEditingEmail] = useState<Email | null>(null);
    const [updatingEmail, setUpdatingEmail] = useState(false);
    const { settings } = useTheme();
    const { toasts, showToast, dismissToast } = useToast();

    const fetchemails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/authEmails');
            const data = await response.json();

            if (data.success) {
                setEmails(data.emails);
            } else {
                setError(data.error || 'Failed to fetch emails');
                showToast(data.error || 'Failed to fetch emails', 'error', 'Unable to load emails');
            }
        } catch (err) {
            setError('Failed to fetch emails');
            console.error('Error fetching emails:', err);
            showToast('Failed to fetch emails', 'error', 'Unable to load emails');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchemails();
    }, [fetchemails]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showAddModal) {
                    setShowAddModal(false);
                    setNewEmail({ email: '', name: '', main: '', app_password: '' });
                    setError('');
                } else if (showEditModal) {
                    setShowEditModal(false);
                    setEditingEmail(null);
                    setError('');
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showAddModal, showEditModal]);

    const handleAddEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingEmail(true);
        setError('');

        try {
            const response = await fetch('/api/authEmails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newEmail),
            });

            const data = await response.json();

            if (data.success) {
                setEmails([...emails, data.email]);
                setNewEmail({ email: '', name: '', main: '', app_password: '' });
                setShowAddModal(false);
                showToast('The sender email has been added successfully.', 'success', 'Email added');
            } else {
                setError(data.error || 'Failed to add email');
                showToast(data.error || 'Failed to add email', 'error', 'Email not saved');
            }
        } catch (err) {
            setError('Failed to add email');
            console.error('Error adding email:', err);
            showToast('Failed to add email', 'error', 'Email not saved');
        } finally {
            setAddingEmail(false);
        }
    };

    const handleEditEmail = (email: Email) => {
        setEditingEmail(email);
        setShowAddModal(false);
        setShowEditModal(true);
        setError('');
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEmail) return;

        setUpdatingEmail(true);
        setError('');

        try {
            const response = await fetch('/api/authEmails', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: editingEmail._id,
                    email: editingEmail.email,
                    name: editingEmail.name,
                    main: editingEmail.main,
                    app_password: editingEmail.app_password,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setEmails(emails.map(email =>
                    email._id === editingEmail._id ? data.email : email
                ));
                setEditingEmail(null);
                setShowEditModal(false);
                showToast('Sender email details were updated successfully.', 'success', 'Email updated');
            } else {
                setError(data.error || 'Failed to update email');
                showToast(data.error || 'Failed to update email', 'error', 'Email not saved');
            }
        } catch (err) {
            setError('Failed to update email');
            console.error('Error updating email:', err);
            showToast('Failed to update email', 'error', 'Email not saved');
        } finally {
            setUpdatingEmail(false);
        }
    };

    const deleteEmail = async (id: Email['_id']) => {
        try {
            setLoading(true);
            const response = await fetch('/api/authEmails', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });
            const data = await response.json();

            if (data.success) {
                setEmails(emails.filter(email => email._id !== id));
                showToast('The sender email has been deleted successfully.', 'success', 'Email deleted');
            } else {
                setError(data.error || 'Failed to delete email');
                showToast(data.error || 'Failed to delete email', 'error', 'Delete failed');
            }
        } catch (err) {
            setError('Failed to delete email');
            console.error('Error deleting email:', err);
            showToast('Failed to delete email', 'error', 'Delete failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <ToastViewport toasts={toasts} onDismiss={dismissToast} themeColor={settings.themeColor} />
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Manage Emails</h1>
                            <p className="text-gray-600 mt-2">View and manage Authorized Emails collection</p>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded-lg transition duration-200 flex items-center justify-center"
                            >
                                <HiPlus className="w-5 h-5" />
                            </button>

                            <Link
                                href="/admin"
                                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-1 px-3 rounded-lg transition duration-200 flex items-center justify-center"
                            >
                                <HiArrowLeft className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>

                    {/* Add Email Modal */}
                    {showAddModal && (
                        <div
                            className="fixed inset-0 bg-transparent flex items-center justify-center z-50"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowAddModal(false);
                                    setNewEmail({ email: '', name: '', main: '', app_password: '' });
                                    setError('');
                                }
                            }}
                        >
                            <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full mx-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900">Add New Email</h3>
                                    <button
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setNewEmail({ email: '', name: '', main: '', app_password: '' });
                                            setError('');
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={handleAddEmail} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                                Name
                                            </label>
                                            <input
                                                id="name"
                                                type="text"
                                                required
                                                value={newEmail.name}
                                                onChange={(e) => setNewEmail({ ...newEmail, name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="main" className="block text-sm font-medium text-gray-700 mb-2">
                                                Main
                                            </label>
                                            <input
                                                id="main"
                                                type="email"
                                                required
                                                value={newEmail.main}
                                                onChange={(e) => setNewEmail({ ...newEmail, main: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                placeholder="Enter main email"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <input
                                                id="email"
                                                type="email"
                                                required
                                                value={newEmail.email}
                                                onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                placeholder="Enter email address"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="app_password" className="block text-sm font-medium text-gray-700 mb-2">
                                                App Password
                                            </label>
                                            <input
                                                id="app_password"
                                                type="text"
                                                required
                                                value={newEmail.app_password}
                                                onChange={(e) => setNewEmail({ ...newEmail, app_password: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                placeholder="Enter app password"
                                            />
                                        </div>
                                    </div>
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={addingEmail}
                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            {addingEmail ? 'Adding...' : 'Add Email'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAddModal(false);
                                                setNewEmail({ email: '', name: '', main: '', app_password: '' });
                                                setError('');
                                            }}
                                            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Edit Email Modal */}
                    {showEditModal && editingEmail && (
                        <div
                            className="fixed inset-0 bg-transparent flex items-center justify-center z-50"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowEditModal(false);
                                    setEditingEmail(null);
                                    setError('');
                                }
                            }}
                        >
                            <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full mx-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900">Edit Email</h3>
                                    <button
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingEmail(null);
                                            setError('');
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={handleUpdateEmail} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                                                Name
                                            </label>
                                            <input
                                                id="edit-name"
                                                type="text"
                                                required
                                                value={editingEmail.name}
                                                onChange={(e) => setEditingEmail({ ...editingEmail, name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="edit-main" className="block text-sm font-medium text-gray-700 mb-2">
                                                Main
                                            </label>
                                            <input
                                                id="edit-main"
                                                type="email"
                                                required
                                                value={editingEmail.main}
                                                onChange={(e) => setEditingEmail({ ...editingEmail, main: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Enter main email"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-2">
                                                Email
                                            </label>
                                            <input
                                                id="edit-email"
                                                type="email"
                                                required
                                                value={editingEmail.email}
                                                onChange={(e) => setEditingEmail({ ...editingEmail, email: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Enter email address"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="edit-app-password" className="block text-sm font-medium text-gray-700 mb-2">
                                                App Password
                                            </label>
                                            <input
                                                id="edit-app-password"
                                                type="text"
                                                required
                                                value={editingEmail.app_password}
                                                onChange={(e) => setEditingEmail({ ...editingEmail, app_password: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Enter app password"
                                            />
                                        </div>
                                    </div>
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={updatingEmail}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            {updatingEmail ? 'Updating...' : 'Update Email'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowEditModal(false);
                                                setEditingEmail(null);
                                                setError('');
                                            }}
                                            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Error Message (for general errors) */}
                    {error && !showAddModal && !showEditModal && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Users Table */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                                <p className="mt-2 text-gray-600">Loading emails...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-600">No emails found in the Auth Users collection.</p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                >
                                    Add First Email
                                </button>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Main
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            App Password
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Created At
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {emails.map((email) => (
                                        <tr key={email._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{email.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900">{email.main}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900">{email.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900">{email.app_password}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-500">
                                                    {new Date(email.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <span className="mr-4 inline-flex">
                                                    <EditIconButton
                                                        onClick={() => handleEditEmail(email)}
                                                        themeColor={settings.themeColor}
                                                    />
                                                </span>
                                                <button
                                                    onClick={() => deleteEmail(email._id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Summary */}
                    {!loading && emails.length > 0 && (
                        <div className="mt-6 text-sm text-gray-600">
                            Total emails: {emails.length}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
