import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { db } = await connectToDatabase();
        const { id } = await params;

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid email ID format' },
                { status: 400 }
            );
        }

        const email = await db.collection('AuthEmails').findOne({ _id: objectId });

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, email });
    } catch (error) {
        console.error('Error fetching email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch email' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { email, name, main, app_password } = body;
        const { id } = await params;

        if (!email || !name || !main || !app_password) {
            return NextResponse.json(
                { success: false, error: 'Email, name, main, and app_password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid email ID format' },
                { status: 400 }
            );
        }

        // Check if another email with the same address exists (excluding current email)
        const existingEmail = await db.collection('AuthEmails').findOne({
            email,
            _id: { $ne: objectId }
        });

        if (existingEmail) {
            return NextResponse.json(
                { success: false, error: 'Email address already exists' },
                { status: 400 }
            );
        }

        const updateData = {
            email,
            name,
            main,
            app_password,
            updatedAt: new Date(),
        };

        const result = await db.collection('AuthEmails').updateOne(
            { _id: objectId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'Email not found' },
                { status: 404 }
            );
        }

        // Get the updated email
        const updatedEmail = await db.collection('AuthEmails').findOne({ _id: objectId });

        return NextResponse.json({
            success: true,
            email: updatedEmail
        });
    } catch (error) {
        console.error('Error updating email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update email' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { db } = await connectToDatabase();
        const { id } = await params;

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid email ID format' },
                { status: 400 }
            );
        }

        const result = await db.collection('AuthEmails').deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'Email not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete email' },
            { status: 500 }
        );
    }
}