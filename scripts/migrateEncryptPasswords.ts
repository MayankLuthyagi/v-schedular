// scripts/migrateEncryptPasswords.ts
//
// One-time migration: reads every document in AuthEmails that has a
// plaintext app_password and encrypts it in-place.
//
// Usage:
//   APP_PASSWORD_ENCRYPTION_KEY=<64-hex-chars> npx tsx scripts/migrateEncryptPasswords.ts
//
// It is safe to run multiple times — already-encrypted values are skipped.

import { connectToDatabase } from "@/lib/db";
import { encrypt, isEncrypted } from "@/lib/crypto";
import "dotenv/config";

(async () => {
    console.log("Starting app_password encryption migration...");

    if (!process.env.APP_PASSWORD_ENCRYPTION_KEY) {
        console.error("ERROR: APP_PASSWORD_ENCRYPTION_KEY is not set.");
        process.exit(1);
    }

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection("AuthEmails");

        const docs = await collection.find({}).toArray();
        console.log(`Found ${docs.length} AuthEmail document(s).`);

        let migrated = 0;
        let skipped = 0;

        for (const doc of docs) {
            if (!doc.app_password) {
                console.log(`Skipping ${doc.email}: no app_password field.`);
                skipped++;
                continue;
            }

            if (isEncrypted(doc.app_password)) {
                console.log(`Skipping ${doc.email}: already encrypted.`);
                skipped++;
                continue;
            }

            const encryptedPassword = encrypt(doc.app_password);
            await collection.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        app_password: encryptedPassword,
                        updatedAt: new Date(),
                    },
                }
            );
            console.log(`Encrypted app_password for ${doc.email}`);
            migrated++;
        }

        console.log(`\nMigration complete. Migrated: ${migrated}, Skipped: ${skipped}.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
})();
