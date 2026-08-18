const mongoose = require('mongoose');
const COMMUNITY_LIMITS = require('../config/communityLimits');

const TeamHubCommentSchema = new mongoose.Schema({
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
  authorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  authorSnapshot: {
    displayName: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  body: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: COMMUNITY_LIMITS.COMMENT_BODY_MAX_CHARS,
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHubComment',
    default: null,
    index: true,
  },
  rootCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHubComment',
    default: null,
  },
  depth: {
    type: Number,
    default: 0,
    min: 0,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'removed_by_author', 'removed_by_moderator'],
    default: 'active',
    index: true,
  },
  isHidden: {
    type: Boolean,
    default: false,
    index: true,
  },
  editedAt: { type: Date, default: null },
  editCount: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  upvoteCount: { type: Number, default: 0, min: 0 },
  downvoteCount: { type: Number, default: 0, min: 0 },
  voteScore: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletionReason: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'team_hub_comments',
});

TeamHubCommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: 1 });
TeamHubCommentSchema.index({ postId: 1, createdAt: 1 });
TeamHubCommentSchema.index({ parentCommentId: 1, createdAt: 1 });
TeamHubCommentSchema.index({ authorUserId: 1, createdAt: -1 });

module.exports = mongoose.model('TeamHubComment', TeamHubCommentSchema);
