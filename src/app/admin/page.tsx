'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import { HiHome, HiLogout } from "react-icons/hi";
interface Email {
    _id: string;
    name: string;
    main: string;
    email: string;
    app_password: string;
    createdAt: string;
    updatedAt: string;
}

export default function AdminPage() {
    const [users, setUsers] = useState([]);
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adminUser, setAdminUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        fetchUsers();
        // Get admin user info from localStorage
        if (typeof window !== 'undefined') {
            const adminUserData = localStorage.getItem('adminUser');
            if (adminUserData) {
                setAdminUser(JSON.parse(adminUserData));
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('adminUser');
        localStorage.removeItem('isAdminLoggedIn');
        router.push('/admin/login');
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/authUsers');
            const data = await response.json();

            if (data.success) {
                setUsers(data.users);
            } else {
                setError(data.error || 'Failed to fetch users');
            }
        } catch (err) {
            setError('Failed to fetch users');
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchemails();
    }, []);

    const fetchemails = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/authEmails');
            const data = await response.json();

            if (data.success) {
                setEmails(data.emails);
            } else {
                setError(data.error || 'Failed to fetch emails');
            }
        } catch (err) {
            setError('Failed to fetch emails');
            console.error('Error fetching emails:', err);
        } finally {
            setLoading(false);
        }
    };
    return (
        <AdminProtectedRoute>
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="mb-8 flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                                <p className="text-gray-600 mt-2">
                                    Welcome to the admin panel
                                    {adminUser && <span>, {adminUser.username}</span>}
                                </p>
                            </div>
                            <div className='flex gap-4'>
                                <Link
                                    href="/login"
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-1 px-3 rounded-lg transition duration-200 flex items-center justify-center"
                                >
                                    <HiHome className="w-5 h-5" />
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium transition duration-200 cursor-pointer flex items-center justify-center"
                                >
                                    <HiLogout className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Dashboard Cards */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-blue-900 mb-2">Auth Users</h3>
                                    {!loading && users.length >= 0 && (
                                        <div className="text-3xl font-bold text-blue-600">
                                            {users.length}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Link
                                        href="/admin/users"
                                        className="bg-blue-500 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                    >
                                        Manage Users
                                    </Link>
                                </div>
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-green-900 mb-2">Auth Emails</h3>
                                    {!loading && emails.length >= 0 && (
                                        <div className="text-3xl font-bold text-blue-600">
                                            {emails.length}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Link
                                        href="/admin/emails"
                                        className="bg-green-500 hover:bg-black text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                    >
                                        Manage Emails
                                    </Link>
                                </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 flex justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-purple-900 mb-2">Email Logs</h3>
                                    <div className="text-sm text-purple-700">
                                        View delivery status
                                    </div>
                                </div>
                                <div>
                                    <Link
                                        href="/admin/email-logs"
                                        className="bg-purple-500 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                    >
                                        View Logs
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminProtectedRoute>
    );
}