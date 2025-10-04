'use client';

import React, { useState, useEffect } from 'react';
import { Campaign } from '@/types/campaign';

interface CampaignListProps {
    isOpen: boolean;
    onClose: () => void;
    onEditCampaign: (campaign: Campaign) => void;
}

export default function CampaignList({ isOpen, onClose, onEditCampaign }: CampaignListProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchCampaigns();
        }
    }, [isOpen]);

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/campaigns');
            if (response.ok) {
                const data = await response.json();
                setCampaigns(data);
            }
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteCampaign = async (campaignId: string) => {
        if (!confirm('Are you sure you want to delete this campaign?')) {
            return;
        }

        try {
            const response = await fetch(`/api/campaigns?campaignId=${campaignId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Refresh the campaigns list
                fetchCampaigns();
            } else {
                alert('Failed to delete campaign');
            }
        } catch (error) {
            console.error('Error deleting campaign:', error);
            alert('Failed to delete campaign');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const formatTime = (timeString: string) => {
        return new Date(`1970-01-01T${timeString}`).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">All Campaigns</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading campaigns...</p>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-gray-400 text-6xl mb-4">📧</div>
                            <p className="text-gray-600 text-lg">No campaigns found</p>
                            <p className="text-gray-500">Create your first campaign to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {campaigns.map((campaign) => (
                                <div key={campaign.campaignId} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                                {campaign.campaignName}
                                            </h3>
                                            <div className="flex items-center space-x-4 mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${campaign.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {campaign.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    ID: {campaign.campaignId}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Email Subject</h4>
                                            <p className="text-sm text-gray-600">{campaign.emailSubject}</p>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Duration</h4>
                                            <p className="text-sm text-gray-600">
                                                {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Send Time</h4>
                                            <p className="text-sm text-gray-600">{formatTime(campaign.sendTime)}</p>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Send Days</h4>
                                            <p className="text-sm text-gray-600">{campaign.sendDays.join(', ')}</p>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Send Method</h4>
                                            <p className="text-sm text-gray-600 capitalize">{campaign.sendMethod}</p>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-1">Daily Limit</h4>
                                            <p className="text-sm text-gray-600">{campaign.dailySendLimitPerSender} emails/sender</p>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h4 className="font-medium text-gray-700 mb-1">Selected Emails ({campaign.commaId.length})</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {campaign.commaId.slice(0, 5).map((email, index) => (
                                                <span
                                                    key={index}
                                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                                >
                                                    {email}
                                                </span>
                                            ))}
                                            {campaign.commaId.length > 5 && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                    +{campaign.commaId.length - 5} more
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h4 className="font-medium text-gray-700 mb-1">Email Body</h4>
                                        <div className="bg-gray-50 p-3 rounded max-h-64 overflow-y-auto">
                                            <div
                                                className="text-sm text-gray-600 whitespace-pre-wrap break-words"
                                                style={{
                                                    lineHeight: '1.6',
                                                    wordBreak: 'break-word'
                                                }}
                                                dangerouslySetInnerHTML={{
                                                    __html: campaign.emailBody.replace(/\n/g, '<br>')
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {campaign.sheetId && (
                                        <div className="mb-2">
                                            <h4 className="font-medium text-gray-700 mb-1">Google Sheet ID</h4>
                                            <p className="text-sm text-gray-600 font-mono">{campaign.sheetId}</p>
                                        </div>
                                    )}

                                    {campaign.attachments && campaign.attachments.length > 0 && (
                                        <div className="mb-2">
                                            <h4 className="font-medium text-gray-700 mb-1">Attachments</h4>
                                            <div className="space-y-1">
                                                {campaign.attachments.map((attachment, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                                        <div>
                                                            <span className="text-sm text-gray-600">{attachment.filename}</span>
                                                            {attachment.note && (
                                                                <span className="text-xs text-gray-500 ml-2">({attachment.note})</span>
                                                            )}
                                                        </div>
                                                        <a
                                                            href={`/api/campaigns/attachment?campaignId=${campaign.campaignId}&index=${index}`}
                                                            download={attachment.filename}
                                                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                                                        >
                                                            Download
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-xs text-gray-500 mt-4">
                                        Created: {new Date(campaign.createdAt).toLocaleString()}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => onEditCampaign(campaign)}
                                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition duration-200"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteCampaign(campaign.campaignId)}
                                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition duration-200"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}