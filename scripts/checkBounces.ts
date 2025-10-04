// scripts/checkBounces.ts
import { connectToDatabase } from "@/lib/db";
import { validateEmail } from "@/lib/emailValidation";
import "dotenv/config";

(async () => {
    console.log("🔍 Starting bounce check for sent emails...");

    try {
        const { db } = await connectToDatabase();
        console.log("✔️ Database connected.");

        // Get all emails marked as 'sent' from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const sentEmails = await db
            .collection("EmailLog")
            .find({
                status: "sent",
                sentAt: { $gte: today, $lt: tomorrow }
            })
            .toArray();

        console.log(`🔎 Found ${sentEmails.length} emails marked as sent today.`);

        if (sentEmails.length === 0) {
            console.log("No sent emails to check. Exiting.");
            process.exit(0);
        }

        let checkedCount = 0;
        let bouncedCount = 0;

        for (const emailLog of sentEmails) {
            const { recipientEmail, _id } = emailLog;

            console.log(`Checking email: ${recipientEmail}`);

            // Validate the email
            const validation = await validateEmail(recipientEmail);

            if (!validation.isValid) {
                console.log(`❌ Email ${recipientEmail} is invalid: ${validation.reason}`);

                // Update status to bounced
                await db.collection("EmailLog").updateOne(
                    { _id },
                    {
                        $set: {
                            status: "bounced",
                            bounceReason: `Post-send validation: ${validation.reason}`,
                            bounceCategory: 'validation',
                            bouncedAt: new Date()
                        }
                    }
                );

                bouncedCount++;
                console.log(`  ↳ Updated status to 'bounced'`);
            } else {
                console.log(`✅ Email ${recipientEmail} appears valid`);
            }

            checkedCount++;

            // Add a small delay to avoid overwhelming DNS servers
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n📊 Bounce check completed:`);
        console.log(`  - Emails checked: ${checkedCount}`);
        console.log(`  - Emails marked as bounced: ${bouncedCount}`);
        console.log(`  - Valid emails: ${checkedCount - bouncedCount}`);

        // Show summary of bounced emails
        if (bouncedCount > 0) {
            console.log(`\n🚫 Bounced emails summary:`);
            const bouncedEmails = await db
                .collection("EmailLog")
                .find({
                    status: "bounced",
                    bouncedAt: { $gte: today }
                })
                .toArray();

            for (const bounced of bouncedEmails) {
                console.log(`  - ${bounced.recipientEmail}: ${bounced.bounceReason}`);
            }
        }

        console.log("\n✅ Bounce check completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("🔥 Critical error in bounce check script:", error);
        process.exit(1);
    }
})();