export interface Attachment {
    filename: string;
    content: string; // base64 encoded content
    contentType: string;
    note: string;
}

export interface Campaign {
    campaignId: string;
    campaignName: string;
    emailSubject: string;
    emailBody: string;
    commaId: string[]; // Array of selected email addresses
    startDate: string;
    endDate: string;
    sendTime: string;
    sendDays: string[];
    dailySendLimitPerSender: number;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    sheetId: string;
    attachments: Attachment[]; // Store attachments directly in MongoDB
    isActive: boolean;
    todaySent: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface CampaignFormData {
    campaignName: string;
    emailSubject: string;
    emailBody: string;
    commaId: string[];
    startDate: string;
    endDate: string;
    sendTime: string;
    sendDays: string[];
    dailySendLimitPerSender: number;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    sheetId: string;
    attachment?: File | null;
    attachmentNote?: string;
    isActive: boolean;
}