const mongoose = require('mongoose');

const TeamHubCommentVoteSchema = new mongoose.Schema({
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHubComment',
    required: true,
    index: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamHubDiscussion',
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
  voterUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  value: {
    type: Number,
    enum: [-1, 1],
    required: true,
  },
}, {
  timestamps: true,
  collection: 'team_hub_comment_votes',
});

TeamHubCommentVoteSchema.index({ commentId: 1, voterUserId: 1 }, { unique: true });
TeamHubCommentVoteSchema.index({ voterUserId: 1, createdAt: -1 });

module.exports = mongoose.model('TeamHubCommentVote', TeamHubCommentVoteSchema);
