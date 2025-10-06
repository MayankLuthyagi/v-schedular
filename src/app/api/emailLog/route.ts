import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Collection } from 'mongodb';

export async function GET(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        const collection: Collection = db.collection('EmailLog');

        const { searchParams } = new URL(request.url);

        // --- 1. Get All Query Parameters ---
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const skip = (page - 1) * limit;

        // --- 2. Build a Dynamic MongoDB Query ---
        const query: Record<string, unknown> = {};

        // Handle the 'status' filter
        if (status && status !== 'today') {
            query.status = status;
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query.sentAt = { $gte: start, $lte: end };
        }

        // Handle the special 'today' filter
        if (status === 'today') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            query.sentAt = { $gte: start, $lte: end };
        }

        // Handle the 'search' term
        if (search) {
            query.$or = [
                { recipientEmail: { $regex: search, $options: 'i' } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { campaignId: { $regex: search, $options: 'i' } },
            ];
        }

        // --- 3. Execute Database Queries ---
        // We run two queries at the same time for efficiency:
        // - One to get the actual data for the current page.
        // - One to count the total number of documents that match the filter.
        const [logs, totalLogs] = await Promise.all([
            collection
                .find(query)
                .sort({ sentAt: -1 }) // Show the newest logs first
                .skip(skip)
                .limit(limit)
                .toArray(),
            collection.countDocuments(query),
        ]);

        // --- 4. Calculate Total Pages for Pagination ---
        const totalPages = Math.ceil(totalLogs / limit);

        // --- 5. Return Data in the Correct Format ---
        return NextResponse.json({
            logs,
            totalPages,
            currentPage: page,
        });

    } catch (error: unknown) {
        console.error('Error fetching email logs:', error);
        // Provide a more informative error response
        return NextResponse.json({ error: 'An internal server error occurred.', details: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        const collection: Collection = db.collection('EmailLog');

        // Delete all email logs
        const result = await collection.deleteMany({});

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} email logs`,
            deletedCount: result.deletedCount
        });

    } catch (error: unknown) {
        console.error('Error deleting email logs:', error);
        return NextResponse.json({
            error: 'Failed to delete email logs',
            details: (error as Error).message
        }, { status: 500 });
    }
}