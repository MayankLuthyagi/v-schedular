'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import CampaignForm from '@/components/CampaignForm';
import { useAuth } from '@/contexts/AuthContext';
import { CampaignFormData, Campaign } from '@/types/campaign';
import { EmailLog } from '@/types/emailLog';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [userPhoto, setUserPhoto] = useState('');
    const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
    const [campaignsCount, setCampaignsCount] = useState(0);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
    const [emailLogsCount, setEmailLogsCount] = useState(0);
    const [emailLogsSentCount, setEmailLogsSentCount] = useState(0);
    const [emailLogsOpenedCount, setEmailLogsOpenedCount] = useState(0);
    const handleDeleteCampaign = async (campaignId: string) => {
        try {
            const response = await fetch(`/api/campaigns?campaignId=${campaignId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete campaign');
            }

            alert('Campaign deleted successfully!');

            // Refresh campaigns list
            const countResponse = await fetch('/api/campaigns');
            if (countResponse.ok) {
                const campaigns = await countResponse.json();
                setCampaignsCount(campaigns.length);
                setCampaigns(campaigns);
            }
        } catch (error) {
            console.error('Error deleting campaign:', error);
            alert('Failed to delete campaign. Please try again.');
        } finally {
            setDeleteConfirmOpen(false);
            setCampaignToDelete(null);
        }
    };

    const openDeleteConfirm = (campaign: Campaign, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click event
        setCampaignToDelete(campaign);
        setDeleteConfirmOpen(true);
    };

    useEffect(() => {
        // Fetch all email logs
        const fetchEmailLogsSent = async () => {
            try {
                const response = await fetch('/api/emailLog?today=true');
                if (response.ok) {
                    const emailLogs = await response.json();
                    setEmailLogsCount(emailLogs.length);
                    const sentLogs = emailLogs.filter((e: EmailLog) => e.status === 'sent' || e.status === 'opened');
                    setEmailLogsSentCount(sentLogs.length);
                    // Filter opened emails to only count one-on-one emails (not cc or bcc)
                    // CC/BCC emails can't be individually tracked for opens since they're sent as batch emails
                    const openedLogs = emailLogs.filter((e: EmailLog) =>
                        e.status === 'opened' && e.sendMethod !== 'cc' && e.sendMethod !== 'bcc'
                    );
                    setEmailLogsOpenedCount(openedLogs.length);
                }
            } catch (error) {
                console.error('Error fetching email logs:', error);
            }
        };

        fetchEmailLogsSent();
    }, []);


    useEffect(() => {
        // Fetch all campaigns for editing
        const fetchCampaigns = async () => {
            try {
                const response = await fetch('/api/campaigns');
                if (response.ok) {
                    const campaigns = await response.json();
                    setCampaigns(campaigns);
                    setCampaignsCount(campaigns.length);
                }
            } catch (error) {
                console.error('Error fetching campaigns:', error);
            }
        };

        fetchCampaigns();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserEmail(localStorage.getItem('userEmail') || user?.email || '');
            setUserName(localStorage.getItem('userName') || user?.displayName || '');
            setUserPhoto(localStorage.getItem('userPhoto') || user?.photoURL || '');
        }
    }, [user]);

    const handleCampaignSubmit = async (campaignData: CampaignFormData, isEdit?: boolean) => {
        try {
            const formData = new FormData();

            // Add campaign ID for editing
            if (isEdit && editingCampaign) {
                formData.append('campaignId', editingCampaign.campaignId);
            }

            // Append all form fields
            formData.append('campaignName', campaignData.campaignName);
            formData.append('emailSubject', campaignData.emailSubject);
            formData.append('emailBody', campaignData.emailBody);
            formData.append('commaId', JSON.stringify(campaignData.commaId));
            formData.append('startDate', campaignData.startDate);
            formData.append('endDate', campaignData.endDate);
            formData.append('sendTime', campaignData.sendTime);
            formData.append('sendDays', JSON.stringify(campaignData.sendDays));
            formData.append('dailySendLimitPerSender', campaignData.dailySendLimitPerSender.toString());
            formData.append('sendMethod', campaignData.sendMethod);
            formData.append('toEmail', campaignData.toEmail);
            formData.append('replyToEmail', campaignData.replyToEmail);
            formData.append('sheetId', campaignData.sheetId);
            formData.append('isActive', campaignData.isActive.toString());

            // Append file if present
            if (campaignData.attachment) {
                formData.append('attachment', campaignData.attachment);
            }

            const response = await fetch('/api/campaigns', {
                method: isEdit ? 'PUT' : 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Failed to ${isEdit ? 'update' : 'create'} campaign`);
            }

            const result = await response.json();
            console.log(`Campaign ${isEdit ? 'updated' : 'created'}:`, result);
            alert(`Campaign ${isEdit ? 'updated' : 'created'} successfully!`);

            // Reset editing state
            setEditingCampaign(null);

            // Refresh campaigns count and list
            const countResponse = await fetch('/api/campaigns');
            if (countResponse.ok) {
                const campaigns = await countResponse.json();
                setCampaignsCount(campaigns.length);
                setCampaigns(campaigns);
            }
        } catch (error) {
            console.error(`Error ${isEdit ? 'updating' : 'creating'} campaign:`, error);
            alert(`Failed to ${isEdit ? 'update' : 'create'} campaign. Please try again.`);
        }
    };

    const handleCloseCampaignForm = () => {
        setIsCampaignFormOpen(false);
        setEditingCampaign(null);
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
                {/* Header */}
                <header className="bg-white shadow-sm border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-4">
                            <div className="flex items-center space-x-4">
                                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                            </div>

                            <div className="flex items-center space-x-4">
                                {userPhoto && (
                                    <Image
                                        src={userPhoto}
                                        alt="Profile"
                                        width={40}
                                        height={40}
                                        className="rounded-full"
                                    />
                                )}
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{userName}</p>
                                    <p className="text-sm text-gray-500">{userEmail}</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-200"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div
                                className="bg-white overflow-hidden shadow rounded-lg cursor-pointer h-full border border-transparent hover:border-blue-500 hover:shadow-lg transition-all duration-300 ease-in-out"
                                onClick={() => setIsCampaignFormOpen(true)}
                            >
                                <div className="flex flex-col items-center justify-center p-6 h-full">
                                    {/* Using a more prominent Heroicon */}
                                    <div className="bg-blue-100 p-4 rounded-full">
                                        <svg className="h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-gray-800">
                                        Create Campaign
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Start a new email campaign
                                    </p>
                                </div>
                            </div>
                            {/* Today's Email Delivery */}
                            {(() => {
                                // Calculate percentage safely, avoiding division by zero
                                const total = emailLogsCount;
                                const sent = emailLogsSentCount;
                                const percentage = total > 0 ? ((sent / total) * 100).toFixed(2) : '0.00';
                                return (
                                    <div
                                        className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-xl transition-shadow duration-300 ease-in-out"
                                        onClick={() => router.push('/email-logs')}
                                    >
                                        <div className="p-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-base font-semibold text-gray-600">
                                                        Today&apos;s Email Delivery
                                                    </p>
                                                    <div className="flex items-end mt-2">
                                                        <p className="text-3xl font-bold text-gray-900">{sent}</p>
                                                        <p className="text-lg font-medium text-gray-500 ml-2">/ {total} sent</p>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-100 p-3 rounded-full">
                                                    {/* Using a Paper Airplane icon */}
                                                    <svg className="h-7 w-7 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-500">Progress</span>
                                                    <span className="text-sm font-medium text-blue-700">{percentage}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                    <div
                                                        className="bg-blue-600 h-2.5 rounded-full"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* Today's Email Opens */}
                            {(() => {
                                // Calculate open rate safely, avoiding division by zero
                                const sent = emailLogsSentCount;
                                const opened = emailLogsOpenedCount;
                                const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(2) : '0.00';
                                return (
                                    <div
                                        className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-xl transition-shadow duration-300 ease-in-out"
                                        onClick={() => router.push('/email-logs')}
                                    >
                                        <div className="p-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-base font-semibold text-gray-600">
                                                        Today&apos;s Email Opens (One-on-One)
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Filtered for genuine opens (excludes automated opens)
                                                    </p>
                                                    <div className="flex items-end mt-2">
                                                        <p className="text-3xl font-bold text-gray-900">{opened}</p>
                                                        <p className="text-lg font-medium text-gray-500 ml-2">/ {sent} opened</p>
                                                    </div>
                                                </div>
                                                <div className="bg-green-100 p-3 rounded-full">
                                                    {/* Using an Open Mail icon */}
                                                    <svg className="h-7 w-7 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839-5.657l-4.548-2.447A2.25 2.25 0 0012 6.75h0c-.625 0-1.232.242-1.683.681L3.75 12.75" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-500">Open Rate</span>
                                                    <span className="text-sm font-medium text-green-700">{openRate}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                    <div
                                                        className="bg-green-600 h-2.5 rounded-full"
                                                        style={{ width: `${openRate}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="mt-8">
                            <div className="bg-white shadow rounded-lg p-6">
                                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                                    Active Campaigns ({campaignsCount})
                                </h2>

                                {campaigns.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="text-gray-400 text-4xl mb-4">📧</div>
                                        <p className="text-gray-600">No campaigns created yet</p>
                                        <p className="text-gray-500 mb-4">Create your first campaign to get started!</p>
                                        <button
                                            onClick={() => setIsCampaignFormOpen(true)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-200"
                                        >
                                            Create Campaign
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {campaigns.map((campaign) => (
                                            <div
                                                key={campaign.campaignId}
                                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-gray-50 hover:bg-gray-100 relative"
                                                onClick={() => {
                                                    setEditingCampaign(campaign);
                                                    setIsCampaignFormOpen(true);
                                                }}
                                            >
                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e: React.MouseEvent) => openDeleteConfirm(campaign, e)}
                                                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10"
                                                    title="Delete Campaign"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>

                                                <div className="mb-3 pr-8">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                                        {campaign.campaignName}
                                                    </h3>
                                                    <p className="text-sm text-gray-600">
                                                        {campaign.emailSubject}
                                                    </p>
                                                </div>

                                                <div className="mb-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${campaign.isActive
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {campaign.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {campaign.commaId.length} email{campaign.commaId.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-gray-500 mb-2">
                                                    <div>📅 {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</div>
                                                    <div>🕒 {campaign.sendTime} on {campaign.sendDays.slice(0, 2).join(', ')}{campaign.sendDays.length > 2 ? `... +${campaign.sendDays.length - 2}` : ''}</div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500 capitalize">
                                                        📧 {campaign.sendMethod}
                                                    </span>
                                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                        Click to Edit
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Delete Confirmation Modal */}
                        {deleteConfirmOpen && (
                            <div className="fixed inset-0 bg-gray-600 bg-opacity-100 overflow-y-auto h-full w-full z-50">
                                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                                    <div className="mt-3 text-center">
                                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                            <svg
                                                className="h-6 w-6 text-red-600"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                                                />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mt-5">Delete Campaign</h3>
                                        <div className="mt-2 px-7 py-3">
                                            <p className="text-sm text-gray-500">
                                                Are you sure you want to delete &quot;{campaignToDelete?.campaignName}&quot;? This action cannot be undone.
                                            </p>
                                        </div>
                                        <div className="items-center px-4 py-3">
                                            <button
                                                onClick={() => campaignToDelete && handleDeleteCampaign(campaignToDelete.campaignId)}
                                                className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-24 mr-3 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeleteConfirmOpen(false);
                                                    setCampaignToDelete(null);
                                                }}
                                                className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-24 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                    </div>
                </main>

                {/* Campaign Form Modal */}
                <CampaignForm
                    isOpen={isCampaignFormOpen}
                    onClose={handleCloseCampaignForm}
                    onSubmit={handleCampaignSubmit}
                    editCampaign={editingCampaign}
                />
            </div>
        </ProtectedRoute>
    );
}
