import { Attachment } from './campaign';

export interface Broadcast {
    _id?: string;
    broadcastId: string;
    name: string;
    templateId: string;
    senderEmails: string[]; // AuthEmail addresses
    audienceId?: string;
    sendDate: string; // YYYY-MM-DD (IST)
    sendTime: string; // HH:mm (IST)
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    dailySendLimitPerSender: number;
    randomSend: boolean;
    attachments: Attachment[];
    status: 'pending' | 'sent';
    createdAt: Date;
    updatedAt: Date;
}

export interface BroadcastFormData {
    name: string;
    templateId: string;
    senderEmails: string[];
    audienceId?: string;
    sendDate: string;
    sendTime: string;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    dailySendLimitPerSender: number;
    randomSend: boolean;
    attachment?: File | null;
    attachmentNote?: string;
}
