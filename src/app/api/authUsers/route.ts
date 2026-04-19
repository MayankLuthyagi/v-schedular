import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

        const sanitizedUsers = users.map((user) => {
            const sanitizedUser = { ...user };
            delete sanitizedUser.password;
            return sanitizedUser;
        });

        const response = NextResponse.json({ success: true, users: sanitizedUsers });
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



export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name, password } = body;

        if (!email || !name || !password) {
            return NextResponse.json(
                { success: false, error: 'Email, name and password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check if user already exists
        const existingUser = await db.collection('AuthUsers').findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'User with this email already exists' },
                { status: 400 }
            );
        }

        const newUser = {
            email,
            name,
            password,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('AuthUsers').insertOne(newUser);
        const sanitizedUser = { ...newUser };
        delete sanitizedUser.password;

        const response = NextResponse.json({
            success: true,
            user: { ...sanitizedUser, _id: result.insertedId }
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

