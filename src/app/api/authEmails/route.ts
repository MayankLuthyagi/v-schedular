import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const emails = await db.collection('AuthEmails').find({}).toArray();

        return NextResponse.json({ success: true, emails });
    } catch (error) {
        console.error('Error fetching emails:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch emails' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Email ID is required' },
                { status: 400 }
            );
        }

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name, main, app_password } = body;

        if (!email || !name || !main || !app_password) {
            return NextResponse.json(
                { success: false, error: 'Email, name, main, and app_password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check if user already exists
        const existingUser = await db.collection('AuthEmails').findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'Email already exists' },
                { status: 400 }
            );
        }

        const newEmail = {
            name,
            main,
            email,
            app_password,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('AuthEmails').insertOne(newEmail);

        return NextResponse.json({
            success: true,
            email: { ...newEmail, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating authorized email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create authorized email' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, email, name, main, app_password } = body;

        if (!id || !email || !name || !main || !app_password) {
            return NextResponse.json(
                { success: false, error: 'ID, email, name, main, and app_password are required' },
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