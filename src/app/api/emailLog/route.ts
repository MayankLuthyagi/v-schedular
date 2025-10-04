import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const today = searchParams.get('today');
        if (today) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const { db } = await connectToDatabase();
            const emailLogs = await db.collection('EmailLog').find({
                sentAt: { $gte: start, $lte: end }
            }).toArray();
            return NextResponse.json(emailLogs);
        }
        const { db } = await connectToDatabase();
        const emailLogs = await db.collection('EmailLog').find({}).toArray();
        return NextResponse.json(emailLogs);
    } catch (error) {
        console.error('Error fetching email logs:', error);
        return NextResponse.error();
    }
}
