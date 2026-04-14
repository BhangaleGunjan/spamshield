const mongoose = require('mongoose');

const redirectSchema = new mongoose.Schema({
  url: String,
  statusCode: Number,
}, { _id: false });

const domainInfoSchema = new mongoose.Schema({
  registrar: String,
  createdDate: Date,
  expiresDate: Date,
  ageInDays: Number,
  isNewDomain: Boolean,
  tld: String,
  isSuspiciousTld: Boolean,
  sslValid: Boolean,
  sslExpiry: Date,
  sslIssuer: String,
}, { _id: false });

const metadataSchema = new mongoose.Schema({
  title: String,
  description: String,
  favicon: String,
  finalUrl: String,
  redirectChain: [redirectSchema],
  contentType: String,
  statusCode: Number,
}, { _id: false });

const threatSchema = new mongoose.Schema({
  googleSafeBrowsing: {
    isThreat: Boolean,
    threatType: String,
    checkedAt: Date,
  },
  phishingIndicators: [String],
  suspiciousKeywords: [String],
  hasLoginForm: Boolean,
  hasMismatchedDomain: Boolean,
  ipAddress: String,
}, { _id: false });

const scoringSchema = new mongoose.Schema({
  total: { type: Number, min: 0, max: 100 },
  label: { type: String, enum: ['safe', 'suspicious', 'dangerous'] },
  breakdown: {
    domainAge: Number,
    suspiciousTld: Number,
    sslIssues: Number,
    safeBrowsing: Number,
    phishingPatterns: Number,
    redirectCount: Number,
  },
  explanation: [String],
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    index: true,
  },
  urlHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'complete', 'failed'],
    default: 'pending',
  },
  error: String,
  metadata: metadataSchema,
  domainInfo: domainInfoSchema,
  threats: threatSchema,
  scoring: scoringSchema,
  processingTimeMs: Number,
  analyzedAt: Date,
}, {
  timestamps: true,
});

// TTL: auto-delete records older than 30 days
analysisSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;
