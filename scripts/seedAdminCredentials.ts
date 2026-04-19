import 'dotenv/config';
import dns from 'node:dns';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

type CliArgs = {
    username?: string;
    password?: string;
    email?: string;
    dbName?: string;
    collectionName?: string;
    dnsServers?: string;
};

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const parsed: CliArgs = {};

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        const next = args[i + 1];

        if (arg === '--username' && next) parsed.username = next;
        if (arg === '--password' && next) parsed.password = next;
        if (arg === '--email' && next) parsed.email = next;
        if (arg === '--db' && next) parsed.dbName = next;
        if (arg === '--collection' && next) parsed.collectionName = next;
        if (arg === '--dns' && next) parsed.dnsServers = next;
    }

    return parsed;
}

async function seedAdminCredentials() {
    const cli = parseArgs();

    const uri = process.env.MONGODB_URI;
    const username = cli.username || process.env.ADMIN_USERNAME;
    const password = cli.password || process.env.ADMIN_PASSWORD;
    const email = cli.email || process.env.ADMIN_EMAIL || null;
    const dbName = cli.dbName || process.env.ADMIN_DB_NAME || 'schedular';
    const collectionName = cli.collectionName || process.env.ADMIN_COLLECTION_NAME || 'Admin';
    const dnsServersInput = cli.dnsServers || process.env.ADMIN_DNS_SERVERS || '8.8.8.8,1.1.1.1';

    if (!uri) {
        throw new Error('MONGODB_URI is required in environment.');
    }

    if (!username || !password) {
        throw new Error('Admin credentials are required. Provide --username and --password or set ADMIN_USERNAME and ADMIN_PASSWORD.');
    }

    const dnsServers = dnsServersInput
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);

    if (dnsServers.length > 0) {
        dns.setServers(dnsServers);
        console.log(`Using DNS servers for Mongo SRV lookup: ${dnsServers.join(', ')}`);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const now = new Date();
        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await collection.updateOne(
            { username },
            {
                $set: {
                    username,
                    password: hashedPassword,
                    email,
                    role: 'admin',
                    updatedAt: now,
                },
                $setOnInsert: {
                    createdAt: now,
                },
            },
            { upsert: true }
        );

        const action = result.upsertedCount > 0 ? 'created' : 'updated';
        console.log(`Admin credentials ${action} in ${dbName}.${collectionName} for username: ${username}`);
    } finally {
        await client.close();
    }
}

seedAdminCredentials().catch((error) => {
    console.error('Failed to seed admin credentials:', error instanceof Error ? error.message : error);
    process.exit(1);
});
