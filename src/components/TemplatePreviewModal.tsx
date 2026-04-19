'use client';

import { Campaign } from '@/types/campaign';
import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

interface TemplatePreviewModalProps {
    campaign: Campaign;
    onClose: () => void;
}

const TemplatePreviewModal = ({ campaign, onClose }: TemplatePreviewModalProps) => {
    const [templateName, setTemplateName] = useState('');
    const [templateSubject, setTemplateSubject] = useState('');
    const [htmlString, setHtmlString] = useState('');

    useEffect(() => {
        if (!campaign.templateId) return;
        fetch(`/api/templates/${campaign.templateId}`)
            .then(r => r.json())
            .then(d => {
                if (d.success && d.template) {
                    setTemplateName(d.template.name);
                    setTemplateSubject(d.template.subject);
                    setHtmlString(d.template.body);
                }
            })
            .catch(() => {});
    }, [campaign.templateId]);

    const previewHtml = htmlString || "<div style='text-align:center; padding: 40px; font-family: sans-serif; color: #666;'>Template content loading…</div>";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{campaign.campaignName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Template: {templateName || campaign.templateId} {templateSubject ? `· ${templateSubject}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Close Preview">
                        <FiX className="w-6 h-6" />
                    </button>
                </div>

                {/* Preview */}
                <div className="flex-1 bg-gray-100 p-4 sm:p-8 overflow-hidden flex justify-center">
                    <div className="w-full max-w-[800px] h-full bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden relative">
                        <iframe
                            srcDoc={previewHtml}
                            title={`Preview of ${campaign.campaignName}`}
                            className="w-full h-full absolute inset-0 border-none bg-white"
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplatePreviewModal;
