'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Descendant } from 'slate';
import SlateEmailEditor, { initialSlateValue, serializeSlateToHTML, deserializeHTMLToSlate } from './SlateEmailEditor';
import { EmailTemplate, EmailTemplateFormData } from '@/types/template';
import { FiX, FiTrash2, FiEye, FiCode, FiEdit2 } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    editTemplate?: EmailTemplate | null;
}

type EditorMode = 'rich' | 'html';

type FormValues = Omit<EmailTemplateFormData, 'body'> & { body: Descendant[] };

function GmailPreviewModal({ html, subject, onClose }: { html: string; subject: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Gmail-style header */}
                <div className="bg-white border-b px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">S</div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">Sender Name &lt;sender@example.com&gt;</p>
                                <p className="text-xs text-gray-500">to me</p>
                            </div>
                        </div>
                        <h3 className="text-base font-medium text-gray-900 truncate">{subject || '(no subject)'}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full shrink-0"><FiX size={18} /></button>
                </div>
                {/* Email body rendered in sandboxed iframe */}
                <div className="flex-1 overflow-hidden">
                    <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;font-size:14px;color:#202124;background:#fff;}</style></head><body>${html}</body></html>`}
                        sandbox="allow-same-origin"
                        className="w-full h-full min-h-[400px]"
                        title="Email Preview"
                    />
                </div>
                <div className="border-t px-4 py-3 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Close Preview</button>
                </div>
            </div>
        </div>
    );
}

export default function TemplateModal({ isOpen, onClose, onSaved, editTemplate }: Props) {
    const { settings } = useTheme();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>('rich');
    const [rawHtml, setRawHtml] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    const defaultValues = useMemo<FormValues>(() => ({
        name: '',
        subject: '',
        body: initialSlateValue,
    }), []);

    const { register, handleSubmit, control, reset, watch, formState: { isSubmitting } } = useForm<FormValues>({ defaultValues });

    const watchedBody = watch('body');
    const watchedSubject = watch('subject');

    // Derive preview HTML from current mode
    const previewHtml = editorMode === 'html' ? rawHtml : serializeSlateToHTML(watchedBody);

    useEffect(() => {
        if (editTemplate) {
            reset({ name: editTemplate.name, subject: editTemplate.subject, body: deserializeHTMLToSlate(editTemplate.body) });
            setRawHtml(editTemplate.body);
        } else {
            reset(defaultValues);
            setRawHtml('');
        }
        setShowDeleteConfirm(false);
        setEditorMode('rich');
    }, [editTemplate, isOpen, reset, defaultValues]);

    const onSubmit = async (data: FormValues) => {
        const finalBody = editorMode === 'html' ? rawHtml : serializeSlateToHTML(data.body);
        const payload = { name: data.name, subject: data.subject, body: finalBody };
        const url = editTemplate ? `/api/templates/${editTemplate.templateId}` : '/api/templates';
        const method = editTemplate ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { onSaved(); onClose(); }
    };

    const handleDelete = async () => {
        if (!editTemplate) return;
        setIsDeleting(true);
        await fetch(`/api/templates/${editTemplate.templateId}`, { method: 'DELETE' });
        setIsDeleting(false);
        onSaved();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b shrink-0">
                        <h2 className="text-xl font-bold">{editTemplate ? 'Edit Template' : 'New Email Template'}</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                            >
                                <FiEye size={14} /> Preview
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><FiX size={20} /></button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                                <input {...register('name', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Welcome Email" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
                                <input {...register('subject', { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Subject line" />
                            </div>

                            {/* Editor mode toggle */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Email Body</label>
                                    <div className="flex rounded-lg border overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (editorMode === 'html') {
                                                    // switching to rich: parse HTML back
                                                    setEditorMode('rich');
                                                }
                                            }}
                                            className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${editorMode === 'rich' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                            style={editorMode === 'rich' ? { backgroundColor: settings.themeColor } : {}}
                                        >
                                            <FiEdit2 size={11} /> Rich Text
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (editorMode === 'rich') {
                                                    // switching to HTML: serialize current slate value
                                                    setRawHtml(serializeSlateToHTML(watchedBody));
                                                    setEditorMode('html');
                                                }
                                            }}
                                            className={`flex items-center gap-1 px-3 py-1.5 transition-colors border-l ${editorMode === 'html' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                            style={editorMode === 'html' ? { backgroundColor: settings.themeColor } : {}}
                                        >
                                            <FiCode size={11} /> HTML
                                        </button>
                                    </div>
                                </div>

                                {editorMode === 'rich' ? (
                                    <Controller
                                        name="body"
                                        control={control}
                                        render={({ field }) => (
                                            <SlateEmailEditor
                                                value={field.value}
                                                onChange={field.onChange}
                                                editorKey={editTemplate?.templateId || 'new'}
                                                placeholder="Write your template… Use {{name}}, {{company}} etc. for personalisation."
                                            />
                                        )}
                                    />
                                ) : (
                                    <div>
                                        <textarea
                                            value={rawHtml}
                                            onChange={e => setRawHtml(e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono min-h-[300px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            placeholder={`<p>Hello {{name}},</p>\n<p>Your content here...</p>`}
                                            spellCheck={false}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            Paste raw HTML here. Use <code className="bg-gray-100 px-1 rounded">{'{{column_name}}'}</code> for audience variable substitution.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-5 border-t shrink-0">
                            {editTemplate ? (
                                showDeleteConfirm ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-red-600">Delete this template? All linked items will also be deleted.</span>
                                        <button type="button" onClick={handleDelete} disabled={isDeleting} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg">
                                            {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                                        </button>
                                        <button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-red-500 text-sm hover:text-red-700">
                                        <FiTrash2 size={14} /> Delete
                                    </button>
                                )
                            ) : <span />}
                            <div className="flex gap-2">
                                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: settings.themeColor }}>
                                    {isSubmitting ? 'Saving…' : editTemplate ? 'Update' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {showPreview && (
                <GmailPreviewModal
                    html={previewHtml}
                    subject={watchedSubject}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </>
    );
}
