'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Broadcast, BroadcastFormData } from '@/types/broadcast';
import { EmailTemplate } from '@/types/template';
import { Audience } from '@/types/audience';
import { FiX, FiTrash2, FiUploadCloud, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';
import { isValidEmailAddress } from '@/lib/emailAddress';
import {
    SenderDirectoryEntry,
    getSenderScheduledLoad,
    inferSenderLimit,
    summarizeSenderLimitSelection,
} from '@/lib/scheduleLoad';
import { getTemplateAudienceWarning } from '@/lib/templateVariables';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    editBroadcast?: Broadcast | null;
}

type FormValues = BroadcastFormData;
const SEND_METHODS = ['one-on-one', 'cc', 'bcc'] as const;

function truncateLabel(name: string, subject: string, max = 72) {
    const full = `${name} \u2014 ${subject}`;
    return full.length > max ? full.slice(0, max - 1) + '\u2026' : full;
}

export default function BroadcastModal({ isOpen, onClose, onSaved, editBroadcast }: Props) {
    const { settings } = useTheme();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [audiences, setAudiences] = useState<Audience[]>([]);
    const [senderEmails, setSenderEmails] = useState<SenderDirectoryEntry[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [existingBroadcasts, setExistingBroadcasts] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [existingCampaigns, setExistingCampaigns] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [existingAutomations, setExistingAutomations] = useState<any[]>([]);

    const defaultValues = useMemo<FormValues>(() => ({
        name: '', templateId: '',
        senderEmails: [], audienceId: '', sendDate: '', sendTime: '',
        sendMethod: 'one-on-one', toEmail: '', replyToEmail: '',
        dailySendLimitPerSender: 100, randomSend: false,
        attachment: null, attachmentNote: '',
    }), []);

    const { register, handleSubmit, control, reset, watch, setValue, formState: { isSubmitting, errors } } = useForm<FormValues>({
        defaultValues,
        mode: 'onChange',
        reValidateMode: 'onChange',
    });

    const selectedSendersValue = watch('senderEmails');
    const selectedSenders = useMemo(() => selectedSendersValue || [], [selectedSendersValue]);
    const sendMethod = watch('sendMethod');
    const sendDate = watch('sendDate');
    const dailyLimit = watch('dailySendLimitPerSender');
    const senderDirectory = useMemo(
        () => Object.fromEntries(senderEmails.map((entry) => [entry.email, entry])),
        [senderEmails]
    );
    const senderLimitSummary = useMemo(
        () => summarizeSenderLimitSelection(selectedSenders, senderDirectory),
        [selectedSenders, senderDirectory]
    );
    const templateId = watch('templateId');
    const audienceId = watch('audienceId');
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

    useEffect(() => {
        if (!isOpen) return;
        setSubmitError('');
        Promise.all([
            fetch('/api/templates').then(r => r.json()),
            fetch('/api/audiences').then(r => r.json()),
            fetch('/api/authEmails').then(r => r.json()),
            fetch('/api/broadcasts').then(r => r.json()),
            fetch('/api/campaigns').then(r => r.json()),
            fetch('/api/date-automations').then(r => r.json()),
        ]).then(([t, a, e, bc, cp, da]) => {
            if (t.success) setTemplates(t.templates);
            if (a.success) setAudiences(a.audiences);
            if (e.success) setSenderEmails(e.emails.map((em: { email: string; main?: string | null }) => ({ email: em.email, main: em.main || '' })));
            if (bc.success) setExistingBroadcasts((bc.broadcasts || []).filter((b: Broadcast) => b.broadcastId !== editBroadcast?.broadcastId));
            setExistingCampaigns(Array.isArray(cp) ? cp : (cp?.campaigns || []));
            if (da.success) setExistingAutomations(da.automations || []);
        });
    }, [isOpen, editBroadcast?.broadcastId]);

    useEffect(() => {
        if (editBroadcast) {
            reset({ ...editBroadcast, templateId: editBroadcast.templateId || '', audienceId: editBroadcast.audienceId || '', attachment: null });
        } else {
            reset(defaultValues);
        }
        setShowDeleteConfirm(false);
        setSubmitError('');
    }, [editBroadcast, isOpen, reset, defaultValues]);

    const scheduleConflicts = useMemo(() => {
        if (!sendDate || !selectedSenders?.length) return [];
        const conflicts: string[] = [];
        selectedSenders.forEach(sender => {
            const { totalPlanned, sources } = getSenderScheduledLoad({
                date: sendDate,
                sender,
                broadcasts: existingBroadcasts,
                campaigns: existingCampaigns,
                automations: existingAutomations,
            });
            const recommendedLimit = inferSenderLimit(senderDirectory[sender] || sender).recommendedLimit;
            const proposedLoad = Number(dailyLimit) || 0;
            const totalAfterThisBroadcast = totalPlanned + proposedLoad;

            if (sources.length > 0 || totalAfterThisBroadcast > recommendedLimit) {
                if (totalAfterThisBroadcast > recommendedLimit) {
                    conflicts.push(`${sender}: ${totalAfterThisBroadcast}/day after this broadcast (${totalPlanned} already planned${sources.length ? ` from ${sources.join(', ')}` : ''}). Suggested max: ${recommendedLimit}/day.`);
                } else {
                    conflicts.push(`${sender}: ${totalPlanned} already planned from ${sources.join(', ')}. This broadcast would take it to ${totalAfterThisBroadcast}/${recommendedLimit}.`);
                }
            }
        });
        return conflicts;
    }, [sendDate, selectedSenders, dailyLimit, existingBroadcasts, existingCampaigns, existingAutomations, senderDirectory]);

    const onSubmit = async (data: FormValues) => {
        setSubmitError('');
        const fd = new FormData();
        Object.entries({ ...data, senderEmails: JSON.stringify(data.senderEmails) }).forEach(([k, v]) => {
            if (v !== null && v !== undefined && k !== 'attachment') fd.append(k, String(v));
        });
        if (data.attachment) fd.append('attachment', data.attachment);
        const url = editBroadcast ? `/api/broadcasts/${editBroadcast.broadcastId}` : '/api/broadcasts';
        const method = editBroadcast ? 'PUT' : 'POST';
        const res = await fetch(url, { method, body: fd });
        if (res.ok) { onSaved(); onClose(); }
        else {
            const errData = await res.json().catch(() => ({}));
            setSubmitError(errData.error || errData.message || `Failed to ${editBroadcast ? 'update' : 'create'} broadcast. Please check all required fields.`);
        }
    };

    const handleDelete = async () => {
        if (!editBroadcast) return;
        setIsDeleting(true);
        await fetch(`/api/broadcasts/${editBroadcast.broadcastId}`, { method: 'DELETE' });
        setIsDeleting(false);
        onSaved(); onClose();
    };

    if (!isOpen) return null;

    const fieldErr = (msg: string | undefined) => msg
        ? <p className="text-xs text-red-500 mt-0.5">{msg}</p>
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h2 className="text-xl font-bold">{editBroadcast ? 'Edit Broadcast' : 'New One-Time Broadcast'}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Sends once on the chosen date &amp; time, then auto-deletes.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><FiX size={20} /></button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
                    {submitError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <FiAlertTriangle className="shrink-0 mt-0.5" size={16} />
                            <span>{submitError}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast Name</label>
                        <input {...register('name', { required: 'Broadcast name is required' })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.name ? 'border-red-400' : ''}`}
                            placeholder="e.g. Product Launch Announcement" />
                        {fieldErr(errors.name?.message)}
                    </div>

                    <div className="max-w-2xl">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Template <span className="text-red-500">*</span>
                        </label>
                        <select {...register('templateId', { required: 'Please select an email template' })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.templateId ? 'border-red-400' : ''}`}>
                            <option value="">&#8212; Select a template (required) &#8212;</option>
                            {templates.map(t => (
                                <option key={t.templateId} value={t.templateId}>{truncateLabel(t.name, t.subject)}</option>
                            ))}
                        </select>
                        {fieldErr(errors.templateId?.message)}
                        {templates.length === 0 && <p className="text-xs text-gray-400 mt-1">No templates yet &mdash; create one in Email Templates first.</p>}
                        {templateAudienceWarning && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                    <FiAlertTriangle size={13} /> Template warning
                                </p>
                                <p className="text-xs text-amber-600 mt-1">{templateAudienceWarning.message}</p>
                            </div>
                        )}
                    </div>

                    <Controller
                        name="senderEmails"
                        control={control}
                        rules={{ validate: (value) => value?.length ? true : 'Select at least one sender email' }}
                        render={({ field }) => (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Emails</label>
                                <div className="flex flex-wrap gap-2">
                                    {senderEmails.length === 0 && <p className="text-sm text-gray-400">No sender emails configured yet.</p>}
                                    {senderEmails.map((entry) => {
                                        const active = (field.value || []).includes(entry.email);
                                        const next = active
                                            ? (field.value || []).filter((email: string) => email !== entry.email)
                                            : [...(field.value || []), entry.email];
                                        return (
                                            <button
                                                key={entry.email}
                                                type="button"
                                                onClick={() => field.onChange(next)}
                                                className="px-3 py-1 rounded-full border text-sm transition-colors"
                                                style={active ? { backgroundColor: settings.themeColor, color: 'white', borderColor: settings.themeColor } : {}}
                                            >
                                                {entry.email}
                                            </button>
                                        );
                                    })}
                                </div>
                                {fieldErr(errors.senderEmails?.message as string | undefined)}
                            </div>
                        )}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Audience <span className="text-red-500">*</span></label>
                        <select {...register('audienceId', { required: 'Please select an audience' })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.audienceId ? 'border-red-400' : ''}`}>
                            <option value="">&#8212; Select audience &#8212;</option>
                            {audiences.map(a => <option key={a.audienceId} value={a.audienceId}>{a.name} ({a.totalContacts} contacts)</option>)}
                        </select>
                        {fieldErr(errors.audienceId?.message)}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Send Date (IST)</label>
                            <input type="date" {...register('sendDate', { required: 'Send date is required' })}
                                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.sendDate ? 'border-red-400' : ''}`} />
                            {fieldErr(errors.sendDate?.message)}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Send Time (IST)</label>
                            <input type="time" {...register('sendTime', { required: 'Send time is required' })}
                                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.sendTime ? 'border-red-400' : ''}`} />
                            {fieldErr(errors.sendTime?.message)}
                        </div>
                    </div>

                    {scheduleConflicts.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                                <FiAlertTriangle size={13} /> Scheduling conflict on {sendDate}
                            </p>
                            {scheduleConflicts.map((c, i) => (
                                <p key={i} className="text-xs text-amber-600 ml-4">{c}</p>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Send Method</label>
                        <div className="flex gap-3">
                            {SEND_METHODS.map(m => (
                                <label key={m} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" value={m} {...register('sendMethod')} />
                                    <span className="text-sm capitalize">{m}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={`grid gap-4 ${sendMethod === 'cc' || sendMethod === 'bcc' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {(sendMethod === 'cc' || sendMethod === 'bcc') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    To Email <span className="text-red-500">*</span>
                                    <span className="text-gray-400 font-normal"> (for {sendMethod.toUpperCase()})</span>
                                </label>
                                <input {...register('toEmail', {
                                    validate: (value) => {
                                        if (sendMethod !== 'cc' && sendMethod !== 'bcc') return true;
                                        if (!value) return 'To email is required for CC/BCC';
                                        return isValidEmailAddress(value) || 'Enter a valid To email';
                                    }
                                })}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.toEmail ? 'border-red-400' : ''}`}
                                    placeholder="recipient@example.com" />
                                {fieldErr(errors.toEmail?.message)}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To</label>
                            <input
                                {...register('replyToEmail', {
                                    required: 'Reply-To address is required',
                                    validate: (value) => isValidEmailAddress(value) || 'Enter a valid reply-to email',
                                })}
                                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.replyToEmail ? 'border-red-400' : ''}`}
                                placeholder="reply@example.com"
                            />
                            {fieldErr(errors.replyToEmail?.message)}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Limit / Sender</label>
                            <input type="number" min={1} {...register('dailySendLimitPerSender', {
                                valueAsNumber: true,
                                min: { value: 1, message: 'Daily send limit must be at least 1' },
                            })}
                                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.dailySendLimitPerSender ? 'border-red-400' : ''}`} />
                            {fieldErr(errors.dailySendLimitPerSender?.message)}
                            <p className="mt-1 text-xs text-gray-500">
                                {senderLimitSummary.recommendedLimit
                                    ? `Suggested max for selected sender(s): ${senderLimitSummary.recommendedLimit}/day. ${senderLimitSummary.note}`
                                    : senderLimitSummary.note}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-xs text-gray-400 flex items-center gap-0.5"><FiInfo size={11} /> Suggest:</span>
                                <button type="button" onClick={() => setValue('dailySendLimitPerSender', 500)}
                                    className={`text-xs px-2 py-0.5 border rounded-full hover:bg-gray-50 ${senderLimitSummary.recommendedLimit === 500 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'text-gray-600'}`}>500 (Gmail app pwd)</button>
                                <button type="button" onClick={() => setValue('dailySendLimitPerSender', 2000)}
                                    className={`text-xs px-2 py-0.5 border rounded-full hover:bg-gray-50 ${senderLimitSummary.recommendedLimit === 2000 && !senderLimitSummary.hasMixedRecommendations ? 'border-amber-400 bg-amber-50 text-amber-700' : 'text-gray-600'}`}>2000 (Workspace)</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <input type="checkbox" id="bc-random" {...register('randomSend')} />
                            <label htmlFor="bc-random" className="text-sm">Random send order</label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Attachment <span className="text-gray-400 font-normal">(optional, max 5MB)</span></label>
                        <Controller name="attachment" control={control} render={({ field }) => (
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                                    <FiUploadCloud /> {field.value ? (field.value as File).name : 'Choose file\u2026'}
                                    <input type="file" className="hidden" onChange={e => field.onChange(e.target.files?.[0] ?? null)} />
                                </label>
                                {field.value && <input {...register('attachmentNote')} placeholder="Attachment note" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />}
                            </div>
                        )} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                        {editBroadcast ? (
                            showDeleteConfirm ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-red-600">Delete this broadcast?</span>
                                    <button type="button" onClick={handleDelete} disabled={isDeleting}
                                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg">{isDeleting ? 'Deleting\u2026' : 'Yes, Delete'}</button>
                                    <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-gray-200 text-sm rounded-lg">Cancel</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center gap-1 text-red-500 text-sm hover:text-red-700"><FiTrash2 size={14} /> Delete</button>
                            )
                        ) : <span />}
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white rounded-lg text-sm"
                                style={{ backgroundColor: settings.themeColor }}>
                                {isSubmitting ? 'Saving\u2026' : editBroadcast ? 'Update Broadcast' : 'Schedule Broadcast'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
