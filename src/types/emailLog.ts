export interface EmailLog {
    campaignId: string;
    recipientEmail: string;
    senderEmail: string;
    sendMethod: 'one-on-one' | 'cc' | 'bcc';
    status: 'sent' | 'failed' | 'opened' | 'bounced';
    sentAt: Date;
    openedAt?: Date;
    bouncedAt?: Date;
    failureReason?: string;
    failureCategory?: 'validation' | 'authentication' | 'rate_limit' | 'network' | 'recipient' | 'attachment' | 'configuration' | 'unknown';
    bounceReason?: string;
    bounceCategory?: 'validation' | 'recipient';
    originalError?: string;
    trackingData?: {
        userAgent?: string;
        referer?: string;
        ip?: string;
        timeDiff?: number;
    };
}
