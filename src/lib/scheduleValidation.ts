import { isValidEmailAddress } from '@/lib/emailAddress';
import type { ScheduledDate } from '@/types/dateAutomation';

const SEND_METHODS = new Set(['one-on-one', 'cc', 'bcc']);

interface CommonScheduleFields {
    name: string;
    templateId: string;
    audienceId?: string;
    senderEmails: string[];
    sendMethod: string;
    toEmail: string;
    replyToEmail: string;
    dailySendLimitPerSender: number;
}

function validateCommonFields(fields: CommonScheduleFields): string | null {
    if (!fields.name?.trim()) return 'Name is required';
    if (!fields.templateId?.trim()) return 'Please select an email template';
    if (!fields.audienceId?.trim()) return 'Please select an audience';
    if (!Array.isArray(fields.senderEmails) || fields.senderEmails.length === 0) return 'Select at least one sender email';
    if (!SEND_METHODS.has(fields.sendMethod)) return 'Select a valid send method';
    if (!fields.replyToEmail?.trim()) return 'Reply-To address is required';
    if (!isValidEmailAddress(fields.replyToEmail)) return 'Enter a valid Reply-To address';
    if ((fields.sendMethod === 'cc' || fields.sendMethod === 'bcc')) {
        if (!fields.toEmail?.trim()) return 'To email is required for CC/BCC';
        if (!isValidEmailAddress(fields.toEmail)) return 'Enter a valid To email';
    }
    if (!Number.isFinite(fields.dailySendLimitPerSender) || fields.dailySendLimitPerSender < 1) {
        return 'Daily send limit must be at least 1';
    }
    return null;
}

export function validateCampaignPayload(fields: CommonScheduleFields & {
    startDate: string;
    endDate: string;
    sendTime: string;
    sendDays: string[];
}) {
    const commonError = validateCommonFields(fields);
    if (commonError) return commonError;
    if (!fields.startDate) return 'Start date is required';
    if (!fields.endDate) return 'End date is required';
    if (!fields.sendTime) return 'Send time is required';
    if (!Array.isArray(fields.sendDays) || fields.sendDays.length === 0) return 'Select at least one send day';
    if (fields.endDate < fields.startDate) return 'End date must be on or after start date';
    return null;
}

export function validateBroadcastPayload(fields: CommonScheduleFields & {
    sendDate: string;
    sendTime: string;
}) {
    const commonError = validateCommonFields(fields);
    if (commonError) return commonError;
    if (!fields.sendDate) return 'Send date is required';
    if (!fields.sendTime) return 'Send time is required';
    return null;
}

export function validateDateAutomationPayload(fields: CommonScheduleFields & {
    scheduledDates: ScheduledDate[];
}) {
    const commonError = validateCommonFields(fields);
    if (commonError) return commonError;
    if (!Array.isArray(fields.scheduledDates) || fields.scheduledDates.length === 0) {
        return 'Please add at least one scheduled date';
    }
    const invalidDate = fields.scheduledDates.some((item) => !item?.date || !item?.sendTime);
    if (invalidDate) return 'Each scheduled date needs both a date and a send time';
    return null;
}
