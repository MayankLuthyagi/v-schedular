export interface EmailLog {
    campaignId: string;
    recipientEmail: string;
    senderEmail: string;
    status: 'sent' | 'failed' | 'opened' | 'bounced';
    sentAt: Date;
    openedAt?: Date;
    bouncedAt?: Date;
    failureReason?: string;
    failureCategory?: 'validation' | 'authentication' | 'rate_limit' | 'network' | 'recipient' | 'attachment' | 'configuration' | 'unknown';
    bounceReason?: string;
    bounceCategory?: 'validation' | 'recipient';
    originalError?: string;
}
