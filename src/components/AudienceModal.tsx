'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiUploadCloud, FiTrash2, FiUsers, FiAlertCircle } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';
import { Audience } from '@/types/audience';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

interface ParsedData {
    columns: string[];
    contacts: Record<string, string>[];
}

export default function AudienceModal({ isOpen, onClose, onSaved }: Props) {
    const { settings } = useTheme();
    const [name, setName] = useState('');
    const [parsed, setParsed] = useState<ParsedData | null>(null);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const reset = () => { setName(''); setParsed(null); setFileName(''); setError(''); };

    const handleClose = () => { reset(); onClose(); };

    const parseCSV = (text: string): ParsedData => {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('File must have at least a header row and one data row.');
        const columns = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
        if (!columns.includes('email')) throw new Error('File must have an "email" column.');
        const contacts = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj: Record<string, string> = {};
            columns.forEach((col, i) => { obj[col] = values[i] || ''; });
            return obj;
        }).filter(c => c.email?.trim());
        return { columns, contacts };
    };

    // Simple Excel parser without external lib — uses SheetJS if available, else falls back to CSV
    const parseExcel = async (file: File): Promise<ParsedData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    // Dynamically import SheetJS
                    const XLSX = await import('xlsx');
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
                    if (rows.length === 0) throw new Error('Sheet is empty.');
                    const rawColumns = Object.keys(rows[0]);
                    const columns = rawColumns.map(c => c.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
                    // also check raw headers for a case-insensitive 'email' match
                    const hasEmail = columns.includes('email') || rawColumns.some(c => c.trim().toLowerCase() === 'email');
                    if (!hasEmail) throw new Error('Sheet must have an "email" column (header must be exactly "email", case-insensitive).');
                    const contacts = rows.map(row => {
                        const obj: Record<string, string> = {};
                        rawColumns.forEach((rc, i) => { obj[columns[i]] = String(row[rc] || ''); });
                        return obj;
                    }).filter(c => c.email?.trim());
                    resolve({ columns, contacts });
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFile = async (file: File) => {
        setError('');
        setParsed(null);
        setFileName(file.name);
        try {
            let data: ParsedData;
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                data = parseCSV(text);
            } else {
                data = await parseExcel(file);
            }
            setParsed(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse file');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Audience name is required'); return; }
        if (!parsed) { setError('Please upload a file first'); return; }
        setIsSaving(true);
        try {
            const res = await fetch('/api/audiences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), columns: parsed.columns, contacts: parsed.contacts }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            onSaved();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save audience');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b">
                    <h2 className="text-xl font-bold flex items-center gap-2"><FiUsers /> Upload Audience</h2>
                    <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full"><FiX size={20} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <FiAlertCircle /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Audience Name</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. Newsletter Subscribers Oct 2025"
                        />
                    </div>

                    {/* Drop Zone */}
                    <div
                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => fileRef.current?.click()}
                    >
                        <FiUploadCloud className="mx-auto text-gray-400 mb-2" size={36} />
                        <p className="text-gray-600 text-sm">Drop your <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> file here</p>
                        <p className="text-gray-400 text-xs mt-1">The first row must be headers. An <strong>email</strong> column is required.</p>
                        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    </div>

                    {parsed && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-green-700 font-medium text-sm">✓ {fileName}</span>
                                <button onClick={() => { setParsed(null); setFileName(''); }} className="text-gray-400 hover:text-red-500"><FiTrash2 size={14} /></button>
                            </div>
                            <p className="text-sm text-gray-600"><strong>{parsed.contacts.length}</strong> contacts found</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {parsed.columns.map(col => (
                                    <span key={col} className="px-2 py-0.5 bg-white border rounded-full text-xs text-gray-700">
                                        {col === 'email' ? '📧 ' : ''}{col}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Use <code className="bg-gray-100 px-1 rounded">{'{{column_name}}'}</code> in your email body to insert contact data.
                            </p>

                            {/* Preview first 3 contacts */}
                            <div className="overflow-x-auto mt-2">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            {parsed.columns.map(col => (
                                                <th key={col} className="border px-2 py-1 text-left font-medium">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.contacts.slice(0, 3).map((c, i) => (
                                            <tr key={i} className="even:bg-gray-50">
                                                {parsed.columns.map(col => (
                                                    <td key={col} className="border px-2 py-1 truncate max-w-[120px]">{c[col]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                        {parsed.contacts.length > 3 && (
                                            <tr><td colSpan={parsed.columns.length} className="border px-2 py-1 text-center text-gray-400">+{parsed.contacts.length - 3} more</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !parsed || !name.trim()}
                            className="px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50"
                            style={{ backgroundColor: settings.themeColor }}
                        >
                            {isSaving ? 'Saving…' : `Save Audience (${parsed?.contacts.length ?? 0} contacts)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
