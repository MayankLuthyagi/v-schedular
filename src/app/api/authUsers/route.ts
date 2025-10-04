import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const users = await db.collection('AuthUsers').find({}).toArray();

        return NextResponse.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch users' },
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
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        const result = await db.collection('AuthUsers').deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete user' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name } = body;

        if (!email || !name) {
            return NextResponse.json(
                { success: false, error: 'Email and name are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check if user already exists
        const existingUser = await db.collection('EmailAdmin').findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'User with this email already exists' },
                { status: 400 }
            );
        }

        const newUser = {
            email,
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('EmailAdmin').insertOne(newUser);

        return NextResponse.json({
            success: true,
            user: { ...newUser, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create user' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, email, name } = body;

        if (!id || !email || !name) {
            return NextResponse.json(
                { success: false, error: 'ID, email and name are required' },
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
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        // Check if another user with the same email exists (excluding current user)
        const existingUser = await db.collection('EmailAdmin').findOne({
            email,
            _id: { $ne: objectId }
        });

        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'User with this email already exists' },
                { status: 400 }
            );
        }

        const updateData = {
            email,
            name,
            updatedAt: new Date(),
        };

        const result = await db.collection('EmailAdmin').updateOne(
            { _id: objectId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        // Get the updated user
        const updatedUser = await db.collection('EmailAdmin').findOne({ _id: objectId });

        return NextResponse.json({
            success: true,
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update user' },
            { status: 500 }
        );
    }
}