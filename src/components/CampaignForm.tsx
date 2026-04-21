'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller, UseFormRegister, RegisterOptions } from 'react-hook-form';
import { CampaignFormData, Campaign } from '@/types/campaign';
import { FiX, FiUploadCloud, FiTrash2, FiLoader, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';
import { isValidEmailAddress } from '@/lib/emailAddress';
import {
    SenderDirectoryEntry,
    getSenderScheduledLoad,
    inferSenderLimit,
    summarizeSenderLimitSelection,
} from '@/lib/scheduleLoad';
import { getTemplateAudienceWarning } from '@/lib/templateVariables';

interface EmailTemplateOption { templateId: string; name: string; subject: string; body: string; }
interface AudienceOption { audienceId: string; name: string; totalContacts: number; columns: string[]; }

// Truncate template option text
function truncateLabel(name: string, subject: string, max = 72) {
    const full = `${name} — ${subject}`;
    return full.length > max ? full.slice(0, max - 1) + '…' : full;
}

// --- Custom Hook for Fetching Data ---
const useAuthEmails = (isOpen: boolean) => {
    const [authEmails, setAuthEmails] = useState<SenderDirectoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        if (!isOpen) return;
        const fetchEmails = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/authEmails`);
                if (!response.ok) throw new Error("Failed to fetch sender emails.");
                const data = await response.json();
                if (data.success && Array.isArray(data.emails)) {
                    setAuthEmails(data.emails.map((emailObj: { email: string; main?: string | null }) => ({
                        email: emailObj.email,
                        main: emailObj.main || '',
                    })));
                }
            } catch (error) {
                console.error('Error fetching auth emails:', error);
                setAuthEmails([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEmails();
    }, [isOpen]);
    return { authEmails, isLoading };
};

const useTemplatesAndAudiences = (isOpen: boolean) => {
    const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
    const [audiences, setAudiences] = useState<AudienceOption[]>([]);
    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            fetch('/api/templates').then(r => r.json()),
            fetch('/api/audiences').then(r => r.json()),
        ]).then(([t, a]) => {
            if (t.success) setTemplates(t.templates);
            if (a.success) setAudiences(a.audiences);
        }).catch(console.error);
    }, [isOpen]);
    return { templates, audiences };
};

const useExistingSchedules = (isOpen: boolean, editCampaignId?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [campaigns, setCampaigns] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [automations, setAutomations] = useState<any[]>([]);
    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            fetch('/api/broadcasts').then(r => r.json()),
            fetch('/api/campaigns').then(r => r.json()),
            fetch('/api/date-automations').then(r => r.json()),
        ]).then(([bc, cp, da]) => {
            if (bc.success) setBroadcasts(bc.broadcasts || []);
            const cpArr = Array.isArray(cp) ? cp : (cp?.campaigns || []);
            setCampaigns(cpArr.filter((c: { campaignId?: string }) => c.campaignId !== editCampaignId));
            if (da.success) setAutomations(da.automations || []);
        }).catch(console.error);
    }, [isOpen, editCampaignId]);
    return { broadcasts, campaigns, automations };
};

// --- Main Campaign Form Component ---
interface CampaignFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CampaignFormData, isEdit?: boolean) => Promise<void> | void;
    onDelete?: (campaignId: string) => Promise<void> | void;
    onToggleSentToday?: (campaignId: string, markAsSent: boolean) => Promise<void>;
    editCampaign?: Campaign | null;
    isDeleting?: boolean;
}

/** Convert any todaySent value to a YYYY-MM-DD IST string, or null. */
function toISTDateStr(val: Date | string | null | undefined): string | null {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(String(val));
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** Returns true if the given todaySent value matches today's IST date. */
function isTodaySent(todaySent: Campaign['todaySent']): boolean {
    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    return toISTDateStr(todaySent) === todayIST;
}

type Tab = 'content' | 'scheduling' | 'sending';
type LegacyCampaignSenderIds = { commaId?: string[] };

export default function CampaignForm({ isOpen, onClose, onSubmit, onDelete, onToggleSentToday, editCampaign, isDeleting = false }: CampaignFormProps) {
    const [activeTab, setActiveTab] = useState<Tab>('content');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sentTodayToggle, setSentTodayToggle] = useState(false);
    const [isTogglingResend, setIsTogglingResend] = useState(false);
    const { authEmails, isLoading: emailsLoading } = useAuthEmails(isOpen);
    const { templates, audiences } = useTemplatesAndAudiences(isOpen);
    const { broadcasts: existingBroadcasts, campaigns: existingCampaigns, automations: existingAutomations } = useExistingSchedules(isOpen, editCampaign?.campaignId);
    const { settings } = useTheme();

    const defaultValues = useMemo<CampaignFormData>(() => ({
        campaignName: '',
        templateId: '',
        audienceId: '',
        senderEmails: [],
        startDate: '',
        endDate: '',
        sendTime: '',
        sendDays: [],
        dailySendLimitPerSender: 10,
        sendMethod: 'one-on-one',
        toEmail: '',
        replyToEmail: '',
        attachment: null,
        attachmentNote: '',
        randomSend: false,
        isActive: true,
    }), []);

    const { register, handleSubmit, control, watch, reset, setValue, formState: { isSubmitting, errors } } = useForm<CampaignFormData>({
        defaultValues,
        mode: 'onChange',
        reValidateMode: 'onChange',
    });

    // Populate form with data when editing
    useEffect(() => {
        if (editCampaign) {
            const legacyCommaIds = (editCampaign as LegacyCampaignSenderIds).commaId || [];
            reset({
                campaignName: editCampaign.campaignName || '',
                templateId: editCampaign.templateId || '',
                audienceId: editCampaign.audienceId || '',
                senderEmails: editCampaign.senderEmails || legacyCommaIds,
                startDate: editCampaign.startDate || '',
                endDate: editCampaign.endDate || '',
                sendTime: editCampaign.sendTime || '',
                sendDays: editCampaign.sendDays || [],
                dailySendLimitPerSender: editCampaign.dailySendLimitPerSender || 10,
                sendMethod: editCampaign.sendMethod || 'one-on-one',
                toEmail: editCampaign.toEmail || '',
                replyToEmail: editCampaign.replyToEmail || '',
                attachment: null,
                attachmentNote: editCampaign.attachments?.[0]?.note || '',
                isActive: editCampaign.isActive !== undefined ? editCampaign.isActive : true,
                randomSend: editCampaign.randomSend || false,
            });
        } else {
            reset(defaultValues);
        }
        setShowDeleteConfirm(false);
        setSentTodayToggle(editCampaign ? isTodaySent(editCampaign.todaySent) : false);
        setActiveTab('content');
    }, [editCampaign, reset, defaultValues]);

    useEffect(() => {
        if (!isOpen) setShowDeleteConfirm(false);
    }, [isOpen]);

    const handleFormSubmit = async (data: CampaignFormData) => {
        try {
            await onSubmit(data, !!editCampaign);
        } catch (error) {
            console.error('Form submission error:', error);
        }
    };

    const handleDelete = async () => {
        if (editCampaign?.campaignId && onDelete) {
            try {
                await onDelete(editCampaign.campaignId);
                setShowDeleteConfirm(false);
            } catch (error) {
                console.error('Delete error:', error);
                setShowDeleteConfirm(false);
            }
        }
    };

    const handleSentTodayToggle = async (markAsSent: boolean) => {
        if (!editCampaign?.campaignId || !onToggleSentToday) return;
        setIsTogglingResend(true);
        try {
            await onToggleSentToday(editCampaign.campaignId, markAsSent);
            setSentTodayToggle(markAsSent);
        } finally {
            setIsTogglingResend(false);
        }
    };

    const templateId = watch('templateId');
    const audienceId = watch('audienceId');
    const sendMethod = watch('sendMethod');
    const startDate = watch('startDate');
    const endDate = watch('endDate');
    const sendDays = watch('sendDays');
    const senderEmailsValue = watch('senderEmails');
    const senderEmails = useMemo(() => senderEmailsValue || [], [senderEmailsValue]);
    const dailyLimit = watch('dailySendLimitPerSender');
    const showSentTodayBanner = !!editCampaign && (sentTodayToggle || isTodaySent(editCampaign.todaySent));
    const senderDirectory = useMemo(
        () => Object.fromEntries(authEmails.map((entry) => [entry.email, entry])),
        [authEmails]
    );
    const senderLimitSummary = useMemo(
        () => summarizeSenderLimitSelection(senderEmails, senderDirectory),
        [senderEmails, senderDirectory]
    );
    const selectedTemplate = useMemo(
        () => templates.find((template) => template.templateId === templateId) || null,
        [templates, templateId]
    );
    const selectedAudience = useMemo(
        () => audiences.find((audience) => audience.audienceId === audienceId) || null,
        [audiences, audienceId]
    );
    const templateAudienceWarning = useMemo(
        () => getTemplateAudienceWarning({ template: selectedTemplate, audience: selectedAudience, sendMethod }),
        [selectedTemplate, selectedAudience, sendMethod]
    );

    // Compute scheduling conflict warnings for the campaign date range + days
    const scheduleConflicts = useMemo(() => {
        if (!startDate || !endDate || !sendDays?.length || !senderEmails?.length) return [];
        // Check next 14 days within the range for conflicts
        const conflicts: string[] = [];
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkStart = start < today ? today : start;
        const maxCheck = new Date(checkStart);
        maxCheck.setDate(maxCheck.getDate() + 14);
        const checkEnd = end < maxCheck ? end : maxCheck;

        const conflictDates: string[] = [];
        const cur = new Date(checkStart);
        while (cur <= checkEnd) {
            const dateStr = cur.toISOString().split('T')[0];
            const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
            if (sendDays.includes(dayName)) {
                senderEmails.forEach(sender => {
                    const { totalPlanned, sources } = getSenderScheduledLoad({
                        date: dateStr,
                        sender,
                        broadcasts: existingBroadcasts,
                        campaigns: existingCampaigns,
                        automations: existingAutomations,
                    });
                    const recommendedLimit = inferSenderLimit(senderDirectory[sender] || sender).recommendedLimit;
                    const proposedLoad = Number(dailyLimit) || 0;
                    const totalAfterThisCampaign = totalPlanned + proposedLoad;

                    if ((sources.length > 0 || totalAfterThisCampaign > recommendedLimit) && !conflictDates.includes(`${dateStr}-${sender}`)) {
                        conflictDates.push(`${dateStr}-${sender}`);
                        if (totalAfterThisCampaign > recommendedLimit) {
                            conflicts.push(`${sender} on ${dateStr}: ${totalAfterThisCampaign}/day after this campaign (${totalPlanned} already planned${sources.length ? ` from ${sources.join(', ')}` : ''}). Suggested max: ${recommendedLimit}/day.`);
                        } else {
                            conflicts.push(`${sender} on ${dateStr}: ${totalPlanned} already planned from ${sources.join(', ')}. This campaign would take it to ${totalAfterThisCampaign}/${recommendedLimit}.`);
                        }
                    }
                });
            }
            cur.setDate(cur.getDate() + 1);
        }
        return conflicts.slice(0, 5); // show max 5 to avoid clutter
    }, [startDate, endDate, sendDays, senderEmails, dailyLimit, existingBroadcasts, existingCampaigns, existingAutomations, senderDirectory]);

    if (!isOpen) return null;

    const TabButton = ({ tab, label }: { tab: Tab, label: string }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            style={{ backgroundColor: activeTab === tab ? settings.themeColor : 'transparent' }}
        >
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col relative" key={editCampaign?.campaignId || 'new-campaign'}>
                {/* Loading Overlay */}
                {(isSubmitting || isDeleting) && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10 rounded-lg">
                        <div className="flex flex-col items-center space-y-3">
                            <FiLoader className="animate-spin text-4xl" style={{ color: settings.themeColor }} />
                            <p className="text-lg font-medium text-gray-700">
                                {isDeleting ? 'Deleting campaign...' : 'Saving campaign...'}
                            </p>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {editCampaign ? 'Edit Campaign' : 'Create New Campaign'}
                    </h2>
                    <button onClick={onClose} disabled={isSubmitting || isDeleting} className="text-gray-400 hover:text-gray-700 transition disabled:opacity-50">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Sent-Today banner — only shown when editing a campaign that ran today */}
                {showSentTodayBanner && onToggleSentToday && (
                    <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-amber-800">Already sent today</p>
                            <p className="text-xs text-amber-600">Toggle off to allow sending again today</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            {isTogglingResend && (
                                <FiLoader className="animate-spin text-amber-600 h-4 w-4" />
                            )}
                            <span className="text-sm text-amber-700 font-medium">
                                {sentTodayToggle ? 'Sent' : 'Resend'}
                            </span>
                            <button
                                type="button"
                                disabled={isTogglingResend}
                                onClick={() => handleSentTodayToggle(!sentTodayToggle)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${sentTodayToggle ? 'bg-amber-500' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sentTodayToggle ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </label>
                    </div>
                )}

                {/* Form Content */}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-grow overflow-y-auto">
                    <div className="p-6">
                        {/* Tabs */}
                        <div className="flex space-x-2 border-b mb-6 pb-4">
                            <TabButton tab="content" label="1. Content" />
                            <TabButton tab="scheduling" label="2. Scheduling" />
                            <TabButton tab="sending" label="3. Sending" />
                        </div>

                        <div className="space-y-6">
                            {/* --- CONTENT TAB --- */}
                            {activeTab === 'content' && (
                                <div className="space-y-6">
                                    <FormInput
                                        label="Campaign Name"
                                        name="campaignName"
                                        register={register}
                                        required="Campaign name is required"
                                        error={errors.campaignName?.message}
                                    />

                                    {/* Template selector (required) */}
                                    <div className="max-w-2xl">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email Template <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            {...register('templateId', { required: 'Please select an email template' })}
                                            className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.templateId ? 'border-red-400' : 'border-gray-300'}`}
                                        >
                                            <option value="">— Select a template (required) —</option>
                                            {templates.map(t => (
                                                <option key={t.templateId} value={t.templateId}>{truncateLabel(t.name, t.subject)}</option>
                                            ))}
                                        </select>
                                        {errors.templateId && <p className="text-xs text-red-500 mt-0.5">{errors.templateId.message || 'Required'}</p>}
                                        {templates.length === 0 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                No templates yet — go to Email Templates and create one first.
                                            </p>
                                        )}
                                        {templateAudienceWarning && (
                                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                                    <FiAlertTriangle size={13} /> Template warning
                                                </p>
                                                <p className="text-xs text-amber-600 mt-1">{templateAudienceWarning.message}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* --- SCHEDULING TAB --- */}
                            {activeTab === 'scheduling' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormInput
                                            label="Start Date"
                                            name="startDate"
                                            type="date"
                                            register={register}
                                            required="Start date is required"
                                            error={errors.startDate?.message}
                                        />
                                        <FormInput
                                            label="End Date"
                                            name="endDate"
                                            type="date"
                                            register={register}
                                            required="End date is required"
                                            rules={{
                                                validate: (value: string) => !startDate || !value || value >= startDate || 'End date must be on or after start date',
                                            }}
                                            error={errors.endDate?.message}
                                        />
                                    </div>
                                    <FormInput
                                        label="Send Time"
                                        name="sendTime"
                                        type="time"
                                        register={register}
                                        required="Send time is required"
                                        error={errors.sendTime?.message}
                                    />
                                    <Controller
                                        name="sendDays"
                                        control={control}
                                        rules={{ required: 'Select at least one day' }}
                                        render={({ field }) => (
                                            <ToggleButtonGroup
                                                label="Send on Days"
                                                options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']}
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={errors.sendDays?.message as string | undefined}
                                            />
                                        )}
                                    />
                                    <div>
                                        <FormInput
                                            label="Daily Send Limit (per Sender)"
                                            name="dailySendLimitPerSender"
                                            type="number"
                                            register={register}
                                            required="Daily send limit is required"
                                            rules={{
                                                min: { value: 1, message: 'Daily send limit must be at least 1' },
                                                valueAsNumber: true,
                                            }}
                                            error={errors.dailySendLimitPerSender?.message}
                                            min="1"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            {senderLimitSummary.recommendedLimit
                                                ? `Suggested max for selected sender(s): ${senderLimitSummary.recommendedLimit}/day. ${senderLimitSummary.note}`
                                                : senderLimitSummary.note}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                            <span className="text-xs text-gray-400 flex items-center gap-0.5"><FiInfo size={11} /> Suggest:</span>
                                            <button type="button" onClick={() => setValue('dailySendLimitPerSender', 500)}
                                                className={`text-xs px-2 py-0.5 border rounded-full hover:bg-gray-50 ${senderLimitSummary.recommendedLimit === 500 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'text-gray-600'}`}>
                                                500 (Gmail app pwd)
                                            </button>
                                            <button type="button" onClick={() => setValue('dailySendLimitPerSender', 2000)}
                                                className={`text-xs px-2 py-0.5 border rounded-full hover:bg-gray-50 ${senderLimitSummary.recommendedLimit === 2000 && !senderLimitSummary.hasMixedRecommendations ? 'border-amber-400 bg-amber-50 text-amber-700' : 'text-gray-600'}`}>
                                                2000 (Workspace)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Scheduling conflict warnings */}
                                    {scheduleConflicts.length > 0 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                                            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                                <FiAlertTriangle size={13} /> Scheduling conflicts (next 14 days)
                                            </p>
                                            {scheduleConflicts.map((c, i) => (
                                                <p key={i} className="text-xs text-amber-600 ml-4">{c}</p>
                                            ))}
                                            {scheduleConflicts.length === 5 && (
                                                <p className="text-xs text-amber-500 ml-4">…and possibly more</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- SENDING TAB --- */}
                            {activeTab === 'sending' && (
                                <div className="space-y-6">
                                    {emailsLoading ? <p>Loading emails...</p> : (
                                        <Controller
                                            name="senderEmails"
                                            control={control}
                                            rules={{ validate: (value) => value?.length ? true : 'Select at least one sender email' }}
                                            render={({ field }) => (
                                                <ToggleButtonGroup
                                                    key={editCampaign?.campaignId || 'new'}
                                                    label="Send From Emails"
                                                    options={authEmails.map((entry) => entry.email)}
                                                    value={field.value || []}
                                                    onChange={field.onChange}
                                                    error={errors.senderEmails?.message as string | undefined}
                                                />
                                            )}
                                        />
                                    )}
                                    <Controller
                                        name="randomSend"
                                        control={control}
                                        render={({ field }) => (
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value}
                                                    onChange={field.onChange}
                                                    className="h-4 w-4 border-gray-300 rounded"
                                                    style={{ accentColor: settings.themeColor }}
                                                />
                                                <span className="text-sm font-medium text-gray-700">Randomly Sent</span>
                                            </label>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormSelect
                                            key={`sendMethod-${editCampaign?.campaignId || 'new'}`}
                                            label="Send Method"
                                            name="sendMethod"
                                            register={register}
                                            required
                                            options={[
                                                { value: 'one-on-one', label: 'One on One' },
                                                { value: 'cc', label: 'CC' },
                                                { value: 'bcc', label: 'BCC' },
                                            ]}
                                        />
                                        {(sendMethod === 'cc' || sendMethod === 'bcc') && (
                                            <FormInput
                                                key={`toEmail-${editCampaign?.campaignId || 'new'}`}
                                                label="Recipient 'To' Address"
                                                name="toEmail"
                                                register={register}
                                                rules={{
                                                    validate: (value: string) => {
                                                        if (sendMethod !== 'cc' && sendMethod !== 'bcc') return true;
                                                        if (!value) return 'To email is required for CC/BCC';
                                                        return isValidEmailAddress(value) || 'Enter a valid To email';
                                                    },
                                                }}
                                                error={errors.toEmail?.message}
                                            />
                                        )}
                                    </div>
                                    <FormInput
                                        key={`replyToEmail-${editCampaign?.campaignId || 'new'}`}
                                        label="Reply-To Address"
                                        name="replyToEmail"
                                        type="email"
                                        register={register}
                                        required="Reply-To address is required"
                                        rules={{
                                            validate: (value: string) => isValidEmailAddress(value) || 'Enter a valid reply-to email',
                                        }}
                                        error={errors.replyToEmail?.message}
                                    />
                                    {/* Audience selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Audience <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            {...register('audienceId', { required: 'Please select an audience' })}
                                            className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.audienceId ? 'border-red-400' : 'border-gray-300'}`}
                                        >
                                            <option value="">— Select audience —</option>
                                            {audiences.map(a => (
                                                <option key={a.audienceId} value={a.audienceId}>
                                                    {a.name} ({a.totalContacts} contacts)
                                                </option>
                                            ))}
                                        </select>
                                        {errors.audienceId && <p className="text-xs text-red-500 mt-0.5">{errors.audienceId.message}</p>}
                                        {audiences.length === 0 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                No audiences yet — go to the Audiences section and upload a sheet first.
                                            </p>
                                        )}
                                    </div>
                                    <Controller
                                        name="attachment"
                                        control={control}
                                        render={({ field: { onChange, value } }) => (
                                            <div key={`attachment-${editCampaign?.campaignId || 'new'}`}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment</label>
                                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                                    <div className="space-y-1 text-center">
                                                        <FiUploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                                                        <div className="flex text-sm text-gray-600">
                                                            <label htmlFor="attachment-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                                                                <span>Upload a file</span>
                                                                <input id="attachment-upload" type="file" className="sr-only" onChange={e => onChange(e.target.files?.[0] ?? null)} />
                                                            </label>
                                                            <p className="pl-1">or drag and drop</p>
                                                        </div>
                                                        <p className="text-xs text-gray-500">PDF, PNG, JPG, CSV, XLS up to 10MB</p>
                                                    </div>
                                                </div>
                                                {value && (
                                                    <div className="mt-2 text-sm text-gray-700 flex items-center justify-between bg-gray-100 p-2 rounded">
                                                        <span>{(value as File).name}</span>
                                                        <button type="button" onClick={() => onChange(null)}><FiTrash2 className="text-red-500" /></button>
                                                    </div>
                                                )}
                                                {editCampaign && editCampaign.attachments?.length > 0 && !value && (
                                                    <div className="mt-2 text-sm text-blue-600">
                                                        Existing attachment: {editCampaign.attachments[0].filename}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Footer / Actions */}
                    <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                        <Controller
                            name="isActive"
                            control={control}
                            render={({ field }) => (
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={field.onChange}
                                        className="h-4 w-4 border-gray-300 rounded"
                                        style={{ accentColor: settings.themeColor }}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Campaign is Active</span>
                                </label>
                            )}
                        />
                        {activeTab === 'sending' && (
                            <div className="flex space-x-4">
                                {editCampaign && onDelete && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={isDeleting || isSubmitting}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center"
                                    >
                                        {isDeleting && <FiLoader className="animate-spin mr-2 h-4 w-4" />}
                                        {isDeleting ? 'Deleting...' : 'Delete Campaign'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting || isDeleting}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isDeleting}
                                    className="px-5 py-2.5 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:bg-gray-400 flex items-center"
                                    style={{ backgroundColor: (isSubmitting || isDeleting) ? '#9CA3AF' : settings.themeColor }}
                                >
                                    {isSubmitting && <FiLoader className="animate-spin mr-2 h-4 w-4" />}
                                    {isSubmitting ? 'Saving...' : (editCampaign ? 'Update Campaign' : 'Create Campaign')}
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Campaign</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete &quot;{editCampaign?.campaignName}&quot;? This cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                                Cancel
                            </button>
                            <button type="button" onClick={handleDelete} disabled={isDeleting}
                                className="px-4 py-2 text-sm text-white rounded-md flex items-center"
                                style={{ backgroundColor: isDeleting ? '#9CA3AF' : '#DC2626' }}>
                                {isDeleting && <FiLoader className="animate-spin mr-2 h-4 w-4" />}
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Reusable Form Field Components ---
interface FormInputProps {
    label: string;
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: UseFormRegister<any>;
    required?: boolean | string;
    type?: string;
    placeholder?: string;
    min?: string;
    rules?: RegisterOptions;
    error?: string;
    [key: string]: unknown;
}

interface FormSelectProps {
    label: string;
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: UseFormRegister<any>;
    required?: boolean | string;
    options: { value: string; label: string }[];
    rules?: RegisterOptions;
    error?: string;
    [key: string]: unknown;
}

const FormInput = ({ label, name, register, required, type = "text", rules, error, ...props }: FormInputProps) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            id={name}
            type={type}
            {...register(name, {
                ...(required ? { required: typeof required === 'string' ? required : `${label} is required` } : {}),
                ...(rules || {}),
            })}
            {...props}
            className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
        />
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
);

const FormSelect = ({ label, name, register, required, options, rules, error, ...props }: FormSelectProps) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
            id={name}
            {...register(name, {
                ...(required ? { required: typeof required === 'string' ? required : `${label} is required` } : {}),
                ...(rules || {}),
            })}
            {...props}
            className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
        >
            {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
);

const ToggleButtonGroup = ({ label, options, value, onChange, error }: { label: string; options: string[]; value: string[]; onChange: (newValue: string[]) => void; error?: string; }) => {
    const { settings } = useTheme();
    const handleSelect = useCallback((option: string) => {
        const newValue = value.includes(option) ? value.filter(item => item !== option) : [...value, option];
        onChange(newValue);
    }, [value, onChange]);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="flex flex-wrap gap-2">
                {options.length > 0 ? options.map(option => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className="px-3 py-1.5 text-sm rounded-full border transition-colors"
                        style={{
                            backgroundColor: value.includes(option) ? settings.themeColor : 'white',
                            color: value.includes(option) ? 'white' : '#374151',
                            borderColor: value.includes(option) ? settings.themeColor : '#D1D5DB',
                        }}
                    >
                        {option}
                    </button>
                )) : <p className="text-sm text-gray-500">No options available.</p>}
            </div>
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        </div>
    );
};
