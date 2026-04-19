'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Broadcast, BroadcastFormData } from '@/types/broadcast';
import { EmailTemplate } from '@/types/template';
import { Audience } from '@/types/audience';
import { FiX, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    editBroadcast?: Broadcast | null;
}

type FormValues = BroadcastFormData;

const SEND_METHODS = ['one-on-one', 'cc', 'bcc'] as const;

export default function BroadcastModal({ isOpen, onClose, onSaved, editBroadcast }: Props) {
    const { settings } = useTheme();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [audiences, setAudiences] = useState<Audience[]>([]);
    const [senderEmails, setSenderEmails] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const defaultValues = useMemo<FormValues>(() => ({
        name: '', templateId: '',
        senderEmails: [], audienceId: '', sendDate: '', sendTime: '',
        sendMethod: 'one-on-one', toEmail: '', replyToEmail: '',
        dailySendLimitPerSender: 100, randomSend: false,
        attachment: null, attachmentNote: '',
    }), []);

    const { register, handleSubmit, control, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({ defaultValues });

    const selectedSenders = watch('senderEmails');

    useEffect(() => {
        if (!isOpen) return;
        Promise.all([
            fetch('/api/templates').then(r => r.json()),
            fetch('/api/audiences').then(r => r.json()),
            fetch('/api/authEmails').then(r => r.json()),
        ]).then(([t, a, e]) => {
            if (t.success) setTemplates(t.templates);
            if (a.success) setAudiences(a.audiences);
            if (e.success) setSenderEmails(e.emails.map((em: { email: string }) => em.email));
        });
    }, [isOpen]);

    useEffect(() => {
        if (editBroadcast) {
            reset({
                ...editBroadcast,
                templateId: editBroadcast.templateId || '',
                audienceId: editBroadcast.audienceId || '',
                attachment: null,
            });
        } else {
            reset(defaultValues);
        }
        setShowDeleteConfirm(false);
    }, [editBroadcast, isOpen, reset, defaultValues]);

    const toggleSender = (email: string) => {
        const current = selectedSenders || [];
        setValue('senderEmails', current.includes(email) ? current.filter(e => e !== email) : [...current, email]);
    };

    const onSubmit = async (data: FormValues) => {
        const fd = new FormData();
        Object.entries({ ...data, senderEmails: JSON.stringify(data.senderEmails) }).forEach(([k, v]) => {
            if (v !== null && v !== undefined && k !== 'attachment') fd.append(k, String(v));
        });
        if (data.attachment) fd.append('attachment', data.attachment);

        const url = editBroadcast ? `/api/broadcasts/${editBroadcast.broadcastId}` : '/api/broadcasts';
        const method = editBroadcast ? 'PUT' : 'POST';
        const res = await fetch(url, { method, body: fd });
        if (res.ok) { onSaved(); onClose(); }
    };

    const handleDelete = async () => {
        if (!editBroadcast) return;
        setIsDeleting(true);
        await fetch(`/api/broadcasts/${editBroadcast.broadcastId}`, { method: 'DELETE' });
        setIsDeleting(false);
        onSaved();
        onClose();
    };

    if (!isOpen) return null;

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
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast Name</label>
                        <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Product Launch Announcement" />
                    </div>

                    {/* Template selector (required) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Template <span className="text-red-500">*</span>
                        </label>
                        <select {...register('templateId', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="">— Select a template (required) —</option>
                            {templates.map(t => <option key={t.templateId} value={t.templateId}>{t.name} — {t.subject}</option>)}
                        </select>
                        {templates.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">No templates yet — create one in Email Templates first.</p>
                        )}
                    </div>

                    {/* Sender emails */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender Emails</label>
                        <div className="flex flex-wrap gap-2">
                            {senderEmails.length === 0 && <p className="text-sm text-gray-400">No sender emails configured yet.</p>}
                            {senderEmails.map(email => {
                                const active = (selectedSenders || []).includes(email);
                                return (
                                    <button key={email} type="button" onClick={() => toggleSender(email)}
                                        className="px-3 py-1 rounded-full border text-sm transition-colors"
                                        style={active ? { backgroundColor: settings.themeColor, color: 'white', borderColor: settings.themeColor } : {}}>
                                        {email}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Audience */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Audience <span className="text-red-500">*</span></label>
                        <select {...register('audienceId', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm">
                            <option value="">— Select audience —</option>
                            {audiences.map(a => <option key={a.audienceId} value={a.audienceId}>{a.name} ({a.totalContacts} contacts)</option>)}
                        </select>
                    </div>

                    {/* Send date + time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Send Date (IST)</label>
                            <input type="date" {...register('sendDate', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Send Time (IST)</label>
                            <input type="time" {...register('sendTime', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>

                    {/* Send method */}
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

                    {/* To email / Reply-To */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Email <span className="text-gray-400 font-normal">(for CC/BCC)</span></label>
                            <input {...register('toEmail')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="recipient@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To</label>
                            <input {...register('replyToEmail')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="reply@example.com" />
                        </div>
                    </div>

                    {/* Daily limit + random */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Limit / Sender</label>
                            <input type="number" min={1} {...register('dailySendLimitPerSender', { valueAsNumber: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <input type="checkbox" id="bc-random" {...register('randomSend')} />
                            <label htmlFor="bc-random" className="text-sm">Random send order</label>
                        </div>
                    </div>

                    {/* Attachment */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Attachment <span className="text-gray-400 font-normal">(optional, max 5MB)</span></label>
                        <Controller
                            name="attachment"
                            control={control}
                            render={({ field }) => (
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                                        <FiUploadCloud /> {field.value ? (field.value as File).name : 'Choose file…'}
                                        <input type="file" className="hidden" onChange={e => field.onChange(e.target.files?.[0] ?? null)} />
                                    </label>
                                    {field.value && <input {...register('attachmentNote')} placeholder="Attachment note" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />}
                                </div>
                            )}
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                        {editBroadcast ? (
                            showDeleteConfirm ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-red-600">Delete this broadcast?</span>
                                    <button type="button" onClick={handleDelete} disabled={isDeleting} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg">{isDeleting ? 'Deleting…' : 'Yes, Delete'}</button>
                                    <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-gray-200 text-sm rounded-lg">Cancel</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-red-500 text-sm hover:text-red-700"><FiTrash2 size={14} /> Delete</button>
                            )
                        ) : <span />}
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                {isSubmitting ? 'Saving…' : editBroadcast ? 'Update Broadcast' : 'Schedule Broadcast'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
