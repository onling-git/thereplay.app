const mongoose = require('mongoose');

const TeamHubReportSchema = new mongoose.Schema({
  reporterUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: ['post', 'comment'],
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  targetSubtype: {
    type: String,
    enum: ['discussion', 'top_level_comment', 'reply'],
    default: 'discussion',
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHubDiscussion',
    required: true,
    index: true,
  },
  teamId: {
    type: Number,
    required: true,
    index: true,
  },
  teamSlug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  reasonCode: {
    type: String,
    enum: [
      'spam',
      'harassment_abuse',
      'hate_or_discrimination',
      'threats_or_violence',
      'sexual_content',
      'misinformation',
      'impersonation',
      'self_promotion',
      'off_topic',
      'other',
    ],
    required: true,
    index: true,
  },
  reasonText: {
    type: String,
    default: '',
    maxlength: 500,
  },
  status: {
    type: String,
    enum: ['open', 'in_review', 'action_taken', 'dismissed', 'closed_content_deleted'],
    default: 'open',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low',
    index: true,
  },
  contentSnapshot: {
    title: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  resolutionCode: {
    type: String,
    default: null,
  },
  reviewedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: { type: Date, default: null },
  resolutionNote: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'team_hub_reports',
});

TeamHubReportSchema.index({ targetType: 1, targetId: 1, status: 1 });
TeamHubReportSchema.index({ status: 1, priority: -1, createdAt: 1 });
TeamHubReportSchema.index({ reporterUserId: 1, createdAt: -1 });
TeamHubReportSchema.index({ reporterUserId: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('TeamHubReport', TeamHubReportSchema);
