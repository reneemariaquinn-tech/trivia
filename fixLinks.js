const admin = require('firebase-admin');
const serviceAccount = require('./new-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'resparke-hub.firebasestorage.app'
});

const db = admin.firestore();
db.settings({ databaseId: 'trivia' });
const bucket = admin.storage().bucket();

async function fixPathsAndRefresh() {
    const snapshot = await db.collection('questions').get();
    const oldId = "trivia-34f8c";
    const newId = "resparke-hub";

    console.log(`Updating paths and tokens for ${snapshot.size} questions...`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        let updated = false;

        // 1. Fix Image URLs
        if (data.imageUrl) {
            // Remove old project ID and tokens, then add 'trivia/' prefix
            let path = data.imageUrl.split('/o/')[1]?.split('?')[0];
            if (path) {
                let decodedPath = decodeURIComponent(path);
                // Prepend 'trivia/' if it's not already there
                if (!decodedPath.startsWith('trivia/')) {
                    decodedPath = `trivia/${decodedPath}`;
                }
                
                // Make public and create a clean URL
                const file = bucket.file(decodedPath);
                await file.makePublic().catch(() => console.log(`Missing file: ${decodedPath}`));
                data.imageUrl = `https://storage.googleapis.com/${bucket.name}/${decodedPath}`;
                updated = true;
            }
        }

        // 2. Fix Audio URLs
        if (data.audioUrls && typeof data.audioUrls === 'object') {
            for (let lang in data.audioUrls) {
                let audioPath = data.audioUrls[lang].split('/o/')[1]?.split('?')[0];
                if (audioPath) {
                    let decodedAudio = decodeURIComponent(audioPath);
                    if (!decodedAudio.startsWith('trivia/')) {
                        decodedAudio = `trivia/${decodedAudio}`;
                    }

                    const audioFile = bucket.file(decodedAudio);
                    await audioFile.makePublic().catch(() => {});
                    data.audioUrls[lang] = `https://storage.googleapis.com/${bucket.name}/${decodedAudio}`;
                    updated = true;
                }
            }
        }

        if (updated) {
            await db.collection('questions').doc(doc.id).update(data);
            console.log(`   ✅ Fixed: ${doc.id}`);
        }
    }
    console.log("🏁 DONE! Images and Audio should now be visible in the Admin and App.");
}

fixPathsAndRefresh().catch(console.error);