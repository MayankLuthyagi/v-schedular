import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

/**
 * Utility script to analyze and clean up false email opens
 * Run this to review opens that happened too quickly after sending
 */
export async function analyzeEmailOpens() {
    try {
        const { db } = await connectToDatabase();

        console.log('🔍 Analyzing email opens for potential false positives...\n');

        // Find emails that were opened very quickly (within 10 seconds of sending)
        const suspiciousOpens = await db.collection('EmailLog').find({
            status: 'opened',
            openedAt: { $exists: true },
            sentAt: { $exists: true },
            $expr: {
                $lt: [
                    { $subtract: ['$openedAt', '$sentAt'] },
                    10000 // 10 seconds in milliseconds
                ]
            }
        }).toArray();

        console.log(`Found ${suspiciousOpens.length} potentially false opens (opened within 10 seconds)\n`);

        if (suspiciousOpens.length > 0) {
            console.log('📊 Suspicious Opens Details:');
            suspiciousOpens.forEach((log, index) => {
                const sentTime = new Date(log.sentAt);
                const openedTime = new Date(log.openedAt);
                const timeDiff = openedTime.getTime() - sentTime.getTime();

                console.log(`${index + 1}. Email: ${log.recipientEmail}`);
                console.log(`   Campaign: ${log.campaignId}`);
                console.log(`   Time difference: ${timeDiff}ms (${(timeDiff / 1000).toFixed(2)}s)`);
                console.log(`   Send method: ${log.sendMethod}`);
                if (log.trackingData?.userAgent) {
                    console.log(`   User Agent: ${log.trackingData.userAgent}`);
                }
                console.log('');
            });
        }

        // Find opens by send method
        const opensByMethod = await db.collection('EmailLog').aggregate([
            { $match: { status: 'opened' } },
            {
                $group: {
                    _id: '$sendMethod',
                    count: { $sum: 1 },
                    avgTimeToOpen: {
                        $avg: {
                            $subtract: ['$openedAt', '$sentAt']
                        }
                    }
                }
            }
        ]).toArray();

        console.log('📈 Opens by Send Method:');
        opensByMethod.forEach(method => {
            console.log(`${method._id}: ${method.count} opens (avg: ${(method.avgTimeToOpen / 1000 / 60).toFixed(2)} minutes)`);
        });

        return {
            suspiciousOpens: suspiciousOpens.length,
            opensByMethod,
            details: suspiciousOpens
        };

    } catch (error) {
        console.error('❌ Error analyzing email opens:', error);
        throw error;
    }
}

/**
 * Clean up false opens (opens that happened within specified time threshold)
 */
export async function cleanupFalseOpens(thresholdSeconds: number = 10) {
    try {
        const { db } = await connectToDatabase();

        console.log(`🧹 Cleaning up opens that happened within ${thresholdSeconds} seconds...\n`);

        const result = await db.collection('EmailLog').updateMany(
            {
                status: 'opened',
                openedAt: { $exists: true },
                sentAt: { $exists: true },
                $expr: {
                    $lt: [
                        { $subtract: ['$openedAt', '$sentAt'] },
                        thresholdSeconds * 1000
                    ]
                }
            },
            {
                $set: {
                    status: 'sent',
                    falseOpenDetected: true,
                    originalOpenedAt: '$openedAt'
                },
                $unset: {
                    openedAt: 1
                }
            }
        );

        console.log(`✅ Cleaned up ${result.modifiedCount} false opens`);
        return result.modifiedCount;

    } catch (error) {
        console.error('❌ Error cleaning up false opens:', error);
        throw error;
    }
}

/**
 * Get email open statistics
 */
export async function getOpenStatistics() {
    try {
        const { db } = await connectToDatabase();

        const stats = await db.collection('EmailLog').aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();

        const totalEmails = stats.reduce((sum, stat) => sum + stat.count, 0);
        const openedEmails = stats.find(s => s._id === 'opened')?.count || 0;
        const sentEmails = stats.find(s => s._id === 'sent')?.count || 0;

        console.log('📊 Email Statistics:');
        console.log(`Total emails: ${totalEmails}`);
        console.log(`Sent emails: ${sentEmails}`);
        console.log(`Opened emails: ${openedEmails}`);
        console.log(`Open rate: ${totalEmails > 0 ? ((openedEmails / totalEmails) * 100).toFixed(2) : 0}%`);

        return {
            total: totalEmails,
            sent: sentEmails,
            opened: openedEmails,
            openRate: totalEmails > 0 ? ((openedEmails / totalEmails) * 100) : 0
        };

    } catch (error) {
        console.error('❌ Error getting statistics:', error);
        throw error;
    }
}

// Example usage:
// analyzeEmailOpens().then(console.log);
// cleanupFalseOpens(5); // Clean opens within 5 seconds
// getOpenStatistics().then(console.log);