export interface Attachment {
    filename: string;
    content: string; // base64 encoded content
    contentType: string;
    note: string;
}

export interface Campaign {
    campaignId: string;
    campaignName: string;
    templateId: string;
    audienceId?: string;
    senderEmails: string[];
    startDate: string;
    endDate: string;
    sendTime: string;
    sendDays: string[];
    dailySendLimitPerSender: number;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    attachments: Attachment[];
    isActive: boolean;
    randomSend: boolean;
    todaySent: Date | string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CampaignFormData {
    campaignName: string;
    templateId: string;
    audienceId?: string;
    senderEmails: string[];
    startDate: string;
    endDate: string;
    sendTime: string;
    sendDays: string[];
    dailySendLimitPerSender: number;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    attachment?: File | null;
    attachmentNote?: string;
    isActive: boolean;
    randomSend: boolean;
}
