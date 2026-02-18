const admin = require('firebase-admin');
const serviceAccount = require('./new-key.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'trivia' });

// Helper to convert Firefoo's {"__time__": "..."} into real Dates
function transformData(obj) {
    if (obj && typeof obj === 'object') {
        if (obj.hasOwnProperty('__time__')) {
            return new Date(obj.__time__);
        }
        for (const key in obj) {
            obj[key] = transformData(obj[key]);
        }
    }
    return obj;
}

async function migrate() {
    const fileContents = JSON.parse(fs.readFileSync('./old_data.json', 'utf8'));
    const collections = fileContents.data.__collections__;

    console.log("🚀 Starting time-aware migration to 'trivia'...");

    for (const collectionName in collections) {
        const documents = collections[collectionName];
        console.log(`Processing collection: ${collectionName}`);

        for (const docId in documents) {
            let docData = documents[docId];
            
            // 1. Remove the sub-collection wrapper if present
            if (docData.__collections__) delete docData.__collections__;

            // 2. Convert __time__ fields to real Timestamps
            docData = transformData(docData);

            // 3. Set the data
            await db.collection(collectionName).doc(docId).set(docData);
            console.log(`   ✅ Migrated: ${docId}`);
        }
    }
    console.log("🏁 MIGRATION COMPLETE! Refresh your Firebase Console.");
}

migrate().catch(console.error);