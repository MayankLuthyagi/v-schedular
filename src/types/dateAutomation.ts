import { Attachment } from './campaign';

export interface ScheduledDate {
    date: string;   // YYYY-MM-DD
    sendTime: string; // HH:mm IST
}

export interface DateAutomation {
    _id?: string;
    automationId: string;
    name: string;
    templateId: string;
    senderEmails: string[];
    audienceId?: string;
    scheduledDates: ScheduledDate[]; // each date + its own send time
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    dailySendLimitPerSender: number;
    randomSend: boolean;
    attachments: Attachment[];
    isActive: boolean;
    sentDates: string[]; // YYYY-MM-DD dates that have already been sent
    createdAt: Date;
    updatedAt: Date;
}

export interface DateAutomationFormData {
    name: string;
    templateId: string;
    senderEmails: string[];
    audienceId?: string;
    scheduledDates: ScheduledDate[];
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    toEmail: string;
    replyToEmail: string;
    dailySendLimitPerSender: number;
    randomSend: boolean;
    isActive: boolean;
    attachment?: File | null;
    attachmentNote?: string;
}
