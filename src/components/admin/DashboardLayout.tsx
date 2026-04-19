'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { HiHome, HiLogout, HiCog } from "react-icons/hi";

// NEW: Header component for the top bar
const Header = () => {
    const [adminUsername, setAdminUsername] = useState('');
    const router = useRouter();

    useEffect(() => {
        const adminData = localStorage.getItem('adminProfile');
        if (adminData) {
            setAdminUsername(JSON.parse(adminData).username);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminProfile');
        router.push('/admin/login');
    };

    return (
        <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center transition-theme">
            <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Welcome back, {adminUsername || 'Admin'}</p>
            </div>
            <div className="flex items-center space-x-3">
                <button
                    onClick={handleLogout}
                    title="Logout"
                    className="px-6 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer"
                >
                    <HiLogout className="w-8 h-8" />
                </button>
            </div>
        </header>
    );
};

// NEW: Main Layout component
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900 transition-theme">
            {/* Sidebar */}
            <aside className="w-80 bg-black text-white flex flex-col transition-theme">
                <div className="p-4 text-2xl font-bold border-b border-gray-700 dark:border-gray-600">
                    Schedular Tools
                </div>
                <nav className="flex-1 p-4 space-y-4">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                        <HiHome /> Dashboard
                    </Link>
                    <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
                        <HiCog /> Settings
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <Header />
                <div className="p-6 flex-1 bg-gray-50 dark:bg-gray-800 transition-theme">
                    {children}
                </div>
            </main>
        </div>
    );
}