import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
}

export async function OPTIONS() {
    return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const users = await db.collection('AuthUsers').find({}).toArray();

        const response = NextResponse.json({ success: true, users });
        return addCorsHeaders(response);
    } catch (error) {
        console.error('Error fetching users:', error);
        const response = NextResponse.json(
            { success: false, error: 'Failed to fetch users' },
            { status: 500 }
        );
        return addCorsHeaders(response);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        const { id } = await request.json();

        if (!id) {
            const response = NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
            return addCorsHeaders(response);
        }

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            const response = NextResponse.json(
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
            return addCorsHeaders(response);
        }

        const result = await db.collection('AuthUsers').deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            const response = NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
            return addCorsHeaders(response);
        }

        const response = NextResponse.json({ success: true });
        return addCorsHeaders(response);
    } catch (error) {
        console.error('Error deleting user:', error);
        const response = NextResponse.json(
            { success: false, error: 'Failed to delete user' },
            { status: 500 }
        );
        return addCorsHeaders(response);
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

        const response = NextResponse.json({
            success: true,
            user: { ...newUser, _id: result.insertedId }
        });
        return addCorsHeaders(response);
    } catch (error) {
        console.error('Error creating user:', error);
        const response = NextResponse.json(
            { success: false, error: 'Failed to create user' },
            { status: 500 }
        );
        return addCorsHeaders(response);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, email, name } = body;

        if (!id || !email || !name) {
            const response = NextResponse.json(
                { success: false, error: 'ID, email and name are required' },
                { status: 400 }
            );
            return addCorsHeaders(response);
        }

        const { db } = await connectToDatabase();

        // Convert string ID to MongoDB ObjectId
        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch {
            const response = NextResponse.json(
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
            return addCorsHeaders(response);
        }

        // Check if another user with the same email exists (excluding current user)
        const existingUser = await db.collection('EmailAdmin').findOne({
            email,
            _id: { $ne: objectId }
        });

        if (existingUser) {
            const response = NextResponse.json(
                { success: false, error: 'User with this email already exists' },
                { status: 400 }
            );
            return addCorsHeaders(response);
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
            const response = NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
            return addCorsHeaders(response);
        }

        // Get the updated user
        const updatedUser = await db.collection('EmailAdmin').findOne({ _id: objectId });

        const response = NextResponse.json({
            success: true,
            user: updatedUser
        });
        return addCorsHeaders(response);
    } catch (error) {
        console.error('Error updating user:', error);
        const response = NextResponse.json(
            { success: false, error: 'Failed to update user' },
            { status: 500 }
        );
        return addCorsHeaders(response);
    }
}