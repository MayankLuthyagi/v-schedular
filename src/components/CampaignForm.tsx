'use client';

import React, { useState, useEffect } from 'react';
import { CampaignFormData, Campaign } from '@/types/campaign';

interface CampaignFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CampaignFormData, isEdit?: boolean) => void;
    editCampaign?: Campaign | null;
}

const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const sendMethods = [
    { value: 'one-on-one', label: 'One on One' },
    { value: 'cc', label: 'CC' },
    { value: 'bcc', label: 'BCC' }
];

export default function CampaignForm({ isOpen, onClose, onSubmit, editCampaign }: CampaignFormProps) {
    const [formData, setFormData] = useState<CampaignFormData>({
        campaignName: '',
        emailSubject: '',
        emailBody: '',
        commaId: [],
        startDate: '',
        endDate: '',
        sendTime: '',
        sendDays: [],
        dailySendLimitPerSender: 10,
        sendMethod: 'one-on-one',
        toEmail: '',
        sheetId: '',
        attachment: null,
        attachmentNote: '',
        isActive: true,
    });
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
    const [authEmails, setAuthEmails] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Load edit data when editCampaign changes
    useEffect(() => {
        if (editCampaign) {
            setFormData({
                campaignName: editCampaign.campaignName || '',
                emailSubject: editCampaign.emailSubject || '',
                emailBody: editCampaign.emailBody || '',
                commaId: editCampaign.commaId || [],
                startDate: editCampaign.startDate || '',
                endDate: editCampaign.endDate || '',
                sendTime: editCampaign.sendTime || '',
                sendDays: editCampaign.sendDays || [],
                dailySendLimitPerSender: editCampaign.dailySendLimitPerSender || 10,
                sendMethod: editCampaign.sendMethod || 'one-on-one',
                toEmail: editCampaign.toEmail || '',
                sheetId: editCampaign.sheetId || '',
                attachment: null, // File input will be reset
                attachmentNote: '',
                isActive: editCampaign.isActive ?? true
            });
        } else {
            // Reset form for new campaign
            setFormData({
                campaignName: '',
                emailSubject: '',
                emailBody: '',
                commaId: [],
                startDate: '',
                endDate: '',
                sendTime: '',
                sendDays: [],
                dailySendLimitPerSender: 10,
                sendMethod: 'one-on-one',
                toEmail: '',
                sheetId: '',
                attachment: null,
                attachmentNote: '',
                isActive: true
            });
        }
    }, [editCampaign]);

    // Fetch authorized emails
    useEffect(() => {
        const fetchAuthEmails = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/authEmails`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.emails)) {
                        // Extract email addresses from the email objects
                        const emailAddresses = data.emails.map((emailObj: any) => emailObj.email);
                        setAuthEmails(emailAddresses);
                    } else {
                        setAuthEmails([]);
                    }
                }
            } catch (error) {
                console.error('Error fetching auth emails:', error);
                setAuthEmails([]);
            }
        };

        if (isOpen) {
            fetchAuthEmails();
        }
    }, [isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({
                ...prev,
                [name]: checked
            }));
        } else if (type === 'number') {
            const numericValue = parseInt(value);
            setFormData(prev => ({
                ...prev,
                [name]: isNaN(numericValue) ? 0 : numericValue
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value || ''
            }));
        }
    };

    const handleEmailSelect = (email: string) => {
        setFormData(prev => {
            const currentEmails = prev.commaId || [];
            return {
                ...prev,
                commaId: currentEmails.includes(email)
                    ? currentEmails.filter(e => e !== email)
                    : [...currentEmails, email]
            };
        });
    };

    const handleDaySelect = (day: string) => {
        setFormData(prev => {
            const currentDays = prev.sendDays || [];
            return {
                ...prev,
                sendDays: currentDays.includes(day)
                    ? currentDays.filter(d => d !== day)
                    : [...currentDays, day]
            };
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setFormData(prev => ({
            ...prev,
            attachment: file
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSubmit(formData, !!editCampaign);

            // Only reset form if not editing (editing will be closed externally)
            if (!editCampaign) {
                setFormData({
                    campaignName: '',
                    emailSubject: '',
                    emailBody: '',
                    commaId: [],
                    startDate: '',
                    endDate: '',
                    sendTime: '',
                    sendDays: [],
                    dailySendLimitPerSender: 10,
                    sendMethod: 'one-on-one',
                    toEmail: '',
                    sheetId: '',
                    attachment: null,
                    attachmentNote: '',
                    isActive: true
                });
            }
            onClose();
        } catch (error) {
            console.error('Error submitting campaign:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {editCampaign ? 'Edit Campaign' : 'Create New Campaign'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer"
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 text-black">
                        {/* Campaign Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Campaign Name *
                            </label>
                            <input
                                type="text"
                                name="campaignName"
                                value={formData.campaignName || ''}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Email Subject */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Subject *
                            </label>
                            <input
                                type="text"
                                name="emailSubject"
                                value={formData.emailSubject || ''}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Email Body */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Body *
                            </label>
                            <textarea
                                name="emailBody"
                                value={formData.emailBody || ''}
                                onChange={handleInputChange}
                                required
                                rows={10}
                                placeholder="You can use HTML tags like <b>bold</b>, <i>italic</i>, etc."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Email Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Emails *
                            </label>
                            <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                                {Array.isArray(authEmails) && authEmails.length > 0 ? (
                                    authEmails.map((email) => (
                                        <label key={email} className="flex items-center space-x-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={(formData.commaId || []).includes(email)}
                                                onChange={() => handleEmailSelect(email)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">{email}</span>
                                        </label>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500">No authorized emails available</p>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Selected: {(formData.commaId || []).length} email(s)
                            </p>
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date *
                                </label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={formData.startDate || ''}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date *
                                </label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={formData.endDate || ''}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Send Time */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Send Time *
                            </label>
                            <input
                                type="time"
                                name="sendTime"
                                value={formData.sendTime || ''}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Send Days */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Send Days *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {daysOfWeek.map((day) => (
                                    <label key={day} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={(formData.sendDays || []).includes(day)}
                                            onChange={() => handleDaySelect(day)}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{day}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        {/* Daily Send Limit */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Daily Send Limit Per Sender *
                            </label>
                            <input
                                type="number"
                                name="dailySendLimitPerSender"
                                value={formData.dailySendLimitPerSender || 0}
                                onChange={handleInputChange}
                                min="1"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Send Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Send Method *
                            </label>
                            <select
                                name="sendMethod"
                                value={formData.sendMethod || 'one-on-one'}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {sendMethods.map((method) => (
                                    <option key={method.value} value={method.value}>
                                        {method.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* to Email for bcc and cc*/}
                        {(formData.sendMethod === 'bcc' || formData.sendMethod === 'cc') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    To Email Address *
                                </label>
                                <input
                                    type="email"
                                    name="toEmail"
                                    value={formData.toEmail || ''}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
                        {/* Sheet ID */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Google Sheet ID
                            </label>
                            <input
                                type="text"
                                name="sheetId"
                                value={formData.sheetId || ''}
                                onChange={handleInputChange}
                                placeholder="Enter Google Sheet ID"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Attachment */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Attachment
                            </label>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                                Supported formats: PDF, Images (PNG, JPG), CSV, XLS, XLSX
                            </p>
                        </div>

                        {/* Is Active */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive ?? true}
                                onChange={handleInputChange}
                                className="rounded"
                            />
                            <label className="text-sm font-medium text-gray-700">
                                Campaign is Active
                            </label>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex justify-end space-x-4 pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (formData.commaId || []).length === 0 || (formData.sendDays || []).length === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition duration-200 cursor-pointer"
                            >
                                {loading
                                    ? (editCampaign ? 'Updating...' : 'Creating...')
                                    : (editCampaign ? 'Update Campaign' : 'Create Campaign')
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}