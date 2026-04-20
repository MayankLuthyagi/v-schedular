'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Descendant } from 'slate';
import SlateEmailEditor, { initialSlateValue, serializeSlateToHTML, deserializeHTMLToSlate } from './SlateEmailEditor';
import { EmailTemplate, EmailTemplateFormData } from '@/types/template';
import { FiX, FiTrash2, FiCode, FiEdit2 } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    editTemplate?: EmailTemplate | null;
}

type EditorMode = 'rich' | 'html';
type BodySource = 'original' | 'rich' | 'html';

type FormValues = Omit<EmailTemplateFormData, 'body'> & { body: Descendant[] };

export default function TemplateModal({ isOpen, onClose, onSaved, editTemplate }: Props) {
    const { settings } = useTheme();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>('rich');
    const [rawHtml, setRawHtml] = useState('');
    const [bodySource, setBodySource] = useState<BodySource>('rich');

    const defaultValues = useMemo<FormValues>(() => ({
        name: '',
        subject: '',
        body: initialSlateValue,
    }), []);

    const { register, handleSubmit, control, reset, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({ defaultValues });

    const watchedBody = watch('body');

    useEffect(() => {
        if (editTemplate) {
            reset({ name: editTemplate.name, subject: editTemplate.subject, body: deserializeHTMLToSlate(editTemplate.body) });
            setRawHtml(editTemplate.body);
            setBodySource('original');
        } else {
            reset(defaultValues);
            setRawHtml('');
            setBodySource('rich');
        }
        setShowDeleteConfirm(false);
        setEditorMode('rich');
        setIsDeleting(false);
    }, [editTemplate, isOpen, reset, defaultValues]);

    const onSubmit = async (data: FormValues) => {
        const finalBody = bodySource === 'rich' ? serializeSlateToHTML(data.body) : rawHtml;
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
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><FiX size={20} /></button>
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
                                                    setValue('body', deserializeHTMLToSlate(rawHtml), { shouldDirty: bodySource !== 'original' });
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
                                                    if (bodySource === 'rich' || !editTemplate) {
                                                        setRawHtml(serializeSlateToHTML(watchedBody));
                                                    }
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
                                                onChange={(value) => {
                                                    field.onChange(value);
                                                    setBodySource('rich');
                                                }}
                                                editorKey={editTemplate?.templateId || 'new'}
                                                placeholder="Write your template… Use {{name}}, {{company}} etc. for personalisation."
                                            />
                                        )}
                                    />
                                ) : (
                                    <div>
                                        <textarea
                                            value={rawHtml}
                                            onChange={e => {
                                                setRawHtml(e.target.value);
                                                setBodySource('html');
                                            }}
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

        </>
    );
}
