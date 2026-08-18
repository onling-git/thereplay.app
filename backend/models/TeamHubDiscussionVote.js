const mongoose = require('mongoose');

const TeamHubDiscussionVoteSchema = new mongoose.Schema({
  discussionId: {
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
  collection: 'team_hub_discussion_votes',
});

TeamHubDiscussionVoteSchema.index({ discussionId: 1, voterUserId: 1 }, { unique: true });
TeamHubDiscussionVoteSchema.index({ voterUserId: 1, createdAt: -1 });

module.exports = mongoose.model('TeamHubDiscussionVote', TeamHubDiscussionVoteSchema);
