import type { Broadcast } from '@/types/broadcast';
import type { Campaign } from '@/types/campaign';
import type { DateAutomation } from '@/types/dateAutomation';
import { getEmailDomain } from '@/lib/emailAddress';

export interface SenderDirectoryEntry {
    email: string;
    main?: string | null;
}

export interface SenderLimitInfo {
    recommendedLimit: number;
    kind: 'gmail-app-password' | 'workspace-domain';
    label: string;
    reason: string;
}

interface SenderLoadArgs {
    date: string;
    sender: string;
    broadcasts: Array<Partial<Broadcast>>;
    campaigns: Array<Partial<Campaign>>;
    automations: Array<Partial<DateAutomation>>;
}

const PERSONAL_GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function getDayName(dateStr: string) {
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}

export function inferSenderLimit(sender: SenderDirectoryEntry | string): SenderLimitInfo {
    const entry = typeof sender === 'string' ? { email: sender } : sender;
    const domains = [getEmailDomain(entry.email), getEmailDomain(entry.main)].filter(Boolean);
    const isPersonalGmail = domains.some((domain) => PERSONAL_GMAIL_DOMAINS.has(domain as string));

    if (isPersonalGmail) {
        return {
            recommendedLimit: 500,
            kind: 'gmail-app-password',
            label: '500 (Gmail app pwd)',
            reason: 'Selected sender looks like a personal Gmail/app-password mailbox.',
        };
    }

    return {
        recommendedLimit: 2000,
        kind: 'workspace-domain',
        label: '2000 (Workspace)',
        reason: 'Selected sender looks like a domain/workspace mailbox.',
    };
}

export function summarizeSenderLimitSelection(
    selectedSenders: string[],
    senderDirectory: Record<string, SenderDirectoryEntry>,
) {
    if (!selectedSenders.length) {
        return {
            recommendedLimit: null as number | null,
            note: 'Select a sender to see the suggested daily cap.',
            hasMixedRecommendations: false,
        };
    }

    const recommendations = selectedSenders.map((sender) => inferSenderLimit(senderDirectory[sender] || sender));
    const distinctLimits = [...new Set(recommendations.map((item) => item.recommendedLimit))];

    if (distinctLimits.length === 1) {
        return {
            recommendedLimit: distinctLimits[0],
            note: recommendations[0].reason,
            hasMixedRecommendations: false,
        };
    }

    const safeSharedLimit = Math.min(...distinctLimits);
    return {
        recommendedLimit: safeSharedLimit,
        note: `Selected senders mix Gmail-style and workspace-style mailboxes. ${safeSharedLimit}/day is the safest shared cap.`,
        hasMixedRecommendations: true,
    };
}

export function getSenderScheduledLoad({
    date,
    sender,
    broadcasts,
    campaigns,
    automations,
}: SenderLoadArgs) {
    const dayName = getDayName(date);
    let totalPlanned = 0;
    const sources: string[] = [];

    broadcasts.forEach((broadcast) => {
        if (
            broadcast.sendDate === date &&
            broadcast.status !== 'sent' &&
            broadcast.senderEmails?.includes(sender)
        ) {
            totalPlanned += Number(broadcast.dailySendLimitPerSender) || 0;
            sources.push(`broadcast "${broadcast.name}"`);
        }
    });

    campaigns.forEach((campaign) => {
        if (
            campaign.senderEmails?.includes(sender) &&
            campaign.isActive !== false &&
            campaign.sendDays?.includes(dayName) &&
            date >= (campaign.startDate || '') &&
            date <= (campaign.endDate || '')
        ) {
            totalPlanned += Number(campaign.dailySendLimitPerSender) || 0;
            sources.push(`campaign "${campaign.campaignName}"`);
        }
    });

    automations.forEach((automation) => {
        const alreadySentThatDate = automation.sentDates?.includes(date);
        if (
            !alreadySentThatDate &&
            automation.senderEmails?.includes(sender) &&
            automation.isActive !== false &&
            automation.scheduledDates?.some((scheduledDate) => scheduledDate.date === date)
        ) {
            totalPlanned += Number(automation.dailySendLimitPerSender) || 0;
            sources.push(`automation "${automation.name}"`);
        }
    });

    return { totalPlanned, sources };
}
