import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { username, password, email } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();

        // Check if admin already exists
        const existingAdmin = await db.collection('Admin').findOne({ username });
        if (existingAdmin) {
            return NextResponse.json(
                { success: false, error: 'Admin with this username already exists' },
                { status: 400 }
            );
        }

        const newAdmin = {
            username,
            password,
            email: email || null,
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('Admin').insertOne(newAdmin);

        return NextResponse.json({
            success: true,
            message: 'Admin created successfully',
            admin: {
                id: result.insertedId,
                username,
                email: email || null,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const admins = await db.collection('Admin').find({}).toArray();

        // Remove passwords from response
        const adminList = admins.map(admin => ({
            id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt
        }));

        return NextResponse.json({ success: true, admins: adminList });
    } catch (error) {
        console.error('Error fetching admins:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch admins' },
            { status: 500 }
        );
    }
}