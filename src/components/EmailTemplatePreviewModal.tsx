'use client';

import { EmailTemplate } from '@/types/template';
import { FiX } from 'react-icons/fi';

interface EmailTemplatePreviewModalProps {
    template: EmailTemplate;
    onClose: () => void;
}

export default function EmailTemplatePreviewModal({ template, onClose }: EmailTemplatePreviewModalProps) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-white border-b px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email Template Preview</p>
                        <h3 className="text-lg font-semibold text-gray-900 truncate mt-1">{template.name}</h3>
                        <p className="text-sm text-gray-500 truncate mt-1">{template.subject || '(no subject)'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full shrink-0" title="Close Preview">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="flex-1 bg-gray-100 p-4 sm:p-8 overflow-hidden flex justify-center">
                    <div className="w-full max-w-[800px] h-full bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <iframe
                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;font-size:14px;color:#202124;background:#fff;}</style></head><body>${template.body}</body></html>`}
                            title={`Preview of ${template.name}`}
                            className="w-full h-full border-none bg-white"
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
