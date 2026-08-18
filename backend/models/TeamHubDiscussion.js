const mongoose = require('mongoose');
const COMMUNITY_LIMITS = require('../config/communityLimits');

const TeamHubDiscussionSchema = new mongoose.Schema({
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
  teamNameSnapshot: {
    type: String,
    default: '',
  },
  authorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  authorSnapshot: {
    displayName: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    role: { type: String, default: 'user' },
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: COMMUNITY_LIMITS.DISCUSSION_TITLE_MAX_CHARS,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: COMMUNITY_LIMITS.DISCUSSION_BODY_MAX_CHARS,
  },
  status: {
    type: String,
    enum: ['active', 'locked', 'removed_by_author', 'removed_by_moderator'],
    default: 'active',
    index: true,
  },
  isHidden: {
    type: Boolean,
    default: false,
    index: true,
  },
  stats: {
    commentCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  futureContext: {
    contextType: {
      type: String,
      enum: ['none', 'team', 'match', 'report'],
      default: 'team',
      index: true,
    },
    matchId: { type: Number, default: null },
    reportId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reportExternalId: { type: String, default: null },
  },
  editedAt: { type: Date, default: null },
  editCount: { type: Number, default: 0 },
  upvoteCount: { type: Number, default: 0, min: 0 },
  downvoteCount: { type: Number, default: 0, min: 0 },
  voteScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletionReason: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'team_hub_discussions',
});

TeamHubDiscussionSchema.index({ teamSlug: 1, isDeleted: 1, createdAt: -1 });
TeamHubDiscussionSchema.index({ teamSlug: 1, status: 1, createdAt: -1 });
TeamHubDiscussionSchema.index({ teamSlug: 1, 'stats.lastActivityAt': -1 });
TeamHubDiscussionSchema.index({ authorUserId: 1, createdAt: -1 });
TeamHubDiscussionSchema.index({ 'futureContext.contextType': 1, 'futureContext.matchId': 1 });
TeamHubDiscussionSchema.index({ 'futureContext.contextType': 1, 'futureContext.reportId': 1 });

module.exports = mongoose.model('TeamHubDiscussion', TeamHubDiscussionSchema);
