// MongoDB initialization script
// Creates indexes and initial configuration for SpamShield

db = db.getSiblingDB('spamshield');

// Create indexes for performance
db.analyses.createIndex({ urlHash: 1 }, { unique: true });
db.analyses.createIndex({ originalUrl: 1 });
db.analyses.createIndex({ status: 1 });
db.analyses.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL
db.analyses.createIndex({ 'scoring.label': 1 });

print('SpamShield MongoDB initialized successfully.');
