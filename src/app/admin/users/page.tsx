'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HiArrowLeft, HiUserAdd } from "react-icons/hi";
interface User {
    _id: string;
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export default function ManageUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', name: '' });
    const [addingUser, setAddingUser] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [updatingUser, setUpdatingUser] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showAddModal) {
                    setShowAddModal(false);
                    setNewUser({ email: '', name: '' });
                    setError('');
                } else if (showEditModal) {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setError('');
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showAddModal, showEditModal]);

    const deleteUser = async (id: User['_id']) => {
        try {
            setLoading(true);
            const response = await fetch('/api/authUsers', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });
            const data = await response.json();

            if (data.success) {
                setUsers(users.filter(user => user._id !== id));
            } else {
                setError(data.error || 'Failed to delete user');
            }
        } catch (err) {
            setError('Failed to delete users');
            console.error('Error deleting users:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setShowAddModal(false);
        setShowEditModal(true);
        setError('');
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setUpdatingUser(true);
        setError('');

        try {
            const response = await fetch('/api/authUsers', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: editingUser._id,
                    email: editingUser.email,
                    name: editingUser.name,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setUsers(users.map(user =>
                    user._id === editingUser._id ? data.user : user
                ));
                setEditingUser(null);
                setShowEditModal(false);
            } else {
                setError(data.error || 'Failed to update user');
            }
        } catch (err) {
            setError('Failed to update user');
            console.error('Error updating user:', err);
        } finally {
            setUpdatingUser(false);
        }
    };

    const cancelEdit = () => {
        setEditingUser(null);
        setShowEditModal(false);
        setError('');
    };

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

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingUser(true);
        setError('');

        try {
            const response = await fetch('/api/authUsers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newUser),
            });

            const data = await response.json();

            if (data.success) {
                setUsers([...users, data.user]);
                setNewUser({ email: '', name: '' });
                setShowAddModal(false);
            } else {
                setError(data.error || 'Failed to add user');
            }
        } catch (err) {
            setError('Failed to add user');
            console.error('Error adding user:', err);
        } finally {
            setAddingUser(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
                            {/* Summary */}
                            {!loading && users.length >= 0 && (
                                <div className="mt-4 text-sm text-gray-600">
                                    Total users: {users.length}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded-lg transition duration-200 cursor-pointer flex items-center justify-center"
                            >
                                <HiUserAdd className="w-5 h-5" />
                            </button>

                            <Link
                                href="/admin"
                                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-1 px-3 rounded-lg transition duration-200 flex items-center justify-center"
                            >
                                <HiArrowLeft className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>

                    {/* Add User Modal */}
                    {showAddModal && (
                        <div
                            className="fixed inset-0 bg-transparent flex items-center justify-center z-50"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowAddModal(false);
                                    setNewUser({ email: '', name: '' });
                                    setError('');
                                }
                            }}
                        >
                            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900">Add New User</h3>
                                    <button
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setNewUser({ email: '', name: '' });
                                            setError('');
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                            Name
                                        </label>
                                        <input
                                            id="name"
                                            type="text"
                                            required
                                            value={newUser.name}
                                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Enter full name"
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
                                            value={newUser.email}
                                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Enter email address"
                                        />
                                    </div>
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={addingUser}
                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            {addingUser ? 'Adding...' : 'Add User'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAddModal(false);
                                                setNewUser({ email: '', name: '' });
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

                    {/* Edit User Modal */}
                    {showEditModal && editingUser && (
                        <div
                            className="fixed inset-0 bg-transparent flex items-center justify-center z-50"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowEditModal(false);
                                    setEditingUser(null);
                                    setError('');
                                }
                            }}
                        >
                            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900">Edit User</h3>
                                    <button
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingUser(null);
                                            setError('');
                                        }}
                                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <form onSubmit={handleUpdateUser} className="space-y-4">
                                    <div>
                                        <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                                            Name
                                        </label>
                                        <input
                                            id="edit-name"
                                            type="text"
                                            required
                                            value={editingUser.name}
                                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter full name"
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
                                            value={editingUser.email}
                                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 text-black rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter email address"
                                        />
                                    </div>
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="submit"
                                            disabled={updatingUser}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                                        >
                                            {updatingUser ? 'Updating...' : 'Update'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowEditModal(false);
                                                setEditingUser(null);
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
                                <p className="mt-2 text-gray-600">Loading users...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-600">No users found in the Auth Users collection.</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
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
                                    {users.map((user) => (
                                        <tr key={user._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{user.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-500">
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                                <button onClick={() => deleteUser(user._id)} className="text-red-600 hover:text-red-900 cursor-pointer">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
