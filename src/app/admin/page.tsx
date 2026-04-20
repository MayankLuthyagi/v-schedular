'use client';

import { useState, useEffect } from 'react';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import DashboardLayout from '@/components/admin/DashboardLayout';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import StatCard from '@/components/admin/StatCard';
import ToastViewport from '@/components/ToastViewport';
import EditIconButton from '@/components/EditIconButton';
import DeleteIconButton from '@/components/DeleteIconButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/useToast';
import { FiUsers, FiMail, FiX, FiAlertCircle, FiPlus } from 'react-icons/fi';

interface AuthUser {
    _id: string;
    name: string;
    email: string;
    password?: string;
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

export default function AdminDashboardPage() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [emails, setEmails] = useState<AuthEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'users' | 'emails'>('users');
    const { settings } = useTheme();
    const { toasts, showToast, dismissToast } = useToast();

    // User management modal states
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isEmailModalOpen, setEmailModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
    const [editingEmail, setEditingEmail] = useState<AuthEmail | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
    const [emailForm, setEmailForm] = useState({ name: '', main: '', email: '', app_password: '' });
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'user' | 'email', id: string, email: string } | null>(null);

    // Loading states
    const [isUserSubmitting, setIsUserSubmitting] = useState(false);
    const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // User management handlers
    const handleAddUser = () => {
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '' });
        setUserModalOpen(true);
    };

    const handleEditUser = (user: AuthUser) => {
        setEditingUser(user);
        setUserForm({ name: user.name, email: user.email, password: '' });
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
        setIsUserSubmitting(true);
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
            showToast(
                editingUser ? 'User details were updated successfully.' : 'The new user has been added successfully.',
                'success',
                editingUser ? 'User updated' : 'User added'
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';
            showToast(errorMessage, 'error', 'User not saved');
        } finally {
            setIsUserSubmitting(false);
        }
    };

    const handleEmailSubmit = async () => {
        setIsEmailSubmitting(true);
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
            showToast(
                editingEmail ? 'Sender email details were updated successfully.' : 'The sender email has been added successfully.',
                'success',
                editingEmail ? 'Email updated' : 'Email added'
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';
            showToast(errorMessage, 'error', 'Email not saved');
        } finally {
            setIsEmailSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;

        setIsDeleting(true);
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
            showToast(
                `${deleteConfirm.type === 'user' ? 'User' : 'Email'} was deleted successfully.`,
                'success',
                `${deleteConfirm.type === 'user' ? 'User' : 'Email'} deleted`
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';
            showToast(errorMessage, 'error', 'Delete failed');
        } finally {
            setIsDeleting(false);
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

                    </div>

                    {/* Section Navigation */}
                    <div className="lg:col-span-3 mt-8">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="border-b border-gray-200 dark:border-gray-700">
                                <nav className="-mb-px flex">
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
                                                                    <EditIconButton
                                                                        onClick={() => handleEditUser(user)}
                                                                        themeColor={settings.themeColor}
                                                                    />
                                                                    <DeleteIconButton
                                                                        onClick={() => handleDeleteUser(user)}
                                                                        label="Delete user"
                                                                    />
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
                                                                    <EditIconButton
                                                                        onClick={() => handleEditEmail(email)}
                                                                        themeColor={settings.themeColor}
                                                                    />
                                                                    <DeleteIconButton
                                                                        onClick={() => handleDeleteEmail(email)}
                                                                        label="Delete email"
                                                                    />
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

            {/* User and Email Management Modals */}
            <UserModal
                isOpen={isUserModalOpen}
                onClose={() => setUserModalOpen(false)}
                onSubmit={handleUserSubmit}
                userForm={userForm}
                setUserForm={setUserForm}
                editingUser={editingUser}
                isSubmitting={isUserSubmitting}
            />
            <EmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                onSubmit={handleEmailSubmit}
                emailForm={emailForm}
                setEmailForm={setEmailForm}
                editingEmail={editingEmail}
                isSubmitting={isEmailSubmitting}
            />
            <DeleteConfirmModal
                deleteConfirm={deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
            />

            <ToastViewport toasts={toasts} onDismiss={dismissToast} themeColor={settings.themeColor} />
        </AdminProtectedRoute>
    );
}

// User Modal Component
interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    userForm: { name: string; email: string; password: string };
    setUserForm: (form: { name: string; email: string; password: string }) => void;
    editingUser: AuthUser | null;
    isSubmitting: boolean;
}

const UserModal = ({ isOpen, onClose, onSubmit, userForm, setUserForm, editingUser, isSubmitting }: UserModalProps) => {
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
                        {editingUser ? 'Edit User' : 'Add User'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 cursor-pointer" disabled={isSubmitting}>
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="userName" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="userEmail" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="userPassword" className="block text-sm font-medium text-black mb-2">
                            Password {editingUser ? '(leave empty to keep current)' : ''}
                        </label>
                        <input
                            id="userPassword"
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder={editingUser ? 'Enter new password (optional)' : 'Enter password'}
                            required={!editingUser}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-800 dark:text-gray-200 rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-white rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{ backgroundColor: settings.themeColor }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {editingUser ? 'Updating...' : 'Adding...'}
                                </>
                            ) : (
                                <>{editingUser ? 'Update' : 'Add'} User</>
                            )}
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
    isSubmitting: boolean;
}

const EmailModal = ({ isOpen, onClose, onSubmit, emailForm, setEmailForm, editingEmail, isSubmitting }: EmailModalProps) => {
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
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 cursor-pointer" disabled={isSubmitting}>
                        <FiX />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="emailName" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="emailMain" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="emailAddress" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="appPassword" className="block text-sm font-medium text-black mb-2">
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
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-800 dark:text-gray-200 rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-white rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{ backgroundColor: settings.themeColor }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {editingEmail ? 'Updating...' : 'Adding...'}
                                </>
                            ) : (
                                <>{editingEmail ? 'Update' : 'Add'} Email</>
                            )}
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
    isDeleting: boolean;
}

const DeleteConfirmModal = ({ deleteConfirm, onClose, onConfirm, isDeleting }: DeleteConfirmModalProps) => {
    if (!deleteConfirm) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete {deleteConfirm.type === 'user' ? 'User' : 'Email'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-600 cursor-pointer" disabled={isDeleting}>
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
                            className="px-6 py-2 bg-gray-200 text-gray-800 dark:text-gray-200 font-medium rounded-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
