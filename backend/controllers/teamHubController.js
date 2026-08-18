const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const TeamHubDiscussion = require('../models/TeamHubDiscussion');
const TeamHubDiscussionVote = require('../models/TeamHubDiscussionVote');
const TeamHubComment = require('../models/TeamHubComment');
const TeamHubCommentVote = require('../models/TeamHubCommentVote');
const TeamHubReport = require('../models/TeamHubReport');
const COMMUNITY_LIMITS = require('../config/communityLimits');

function parsePageLimit(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function getAuthorSnapshot(user) {
  const displayName = user.display_name || [user.first_name, user.surname].filter(Boolean).join(' ') || user.email || 'User';
  return {
    displayName,
    avatarUrl: user.avatar_url || '',
    role: user.role || 'user',
  };
}

function hasModerationRestriction(user) {
  const moderation = user?.moderation || {};
  const now = Date.now();

  if (moderation.isBanned) {
    return { blocked: true, code: 'banned', message: 'Your account is banned from community participation.' };
  }

  if (moderation.isSuspended && moderation.suspendedUntil && new Date(moderation.suspendedUntil).getTime() > now) {
    return { blocked: true, code: 'suspended', message: 'Your account is currently suspended from community participation.' };
  }

  if (moderation.isRestricted && moderation.restrictedUntil && new Date(moderation.restrictedUntil).getTime() > now) {
    return { blocked: true, code: 'restricted', message: 'Your account is temporarily restricted from posting.' };
  }

  return { blocked: false };
}

async function getTeamBySlug(teamSlug) {
  const slug = String(teamSlug || '').trim().toLowerCase();
  if (!slug) return null;
  return Team.findOne({ slug }).lean();
}

async function refreshDiscussionStats(postId) {
  const comments = await TeamHubComment.find({ postId, isDeleted: false }).select('depth createdAt').lean();
  const commentCount = comments.filter(c => c.depth === 0).length;
  const replyCount = comments.filter(c => c.depth > 0).length;
  const lastComment = comments.length ? comments.reduce((acc, cur) => (cur.createdAt > acc.createdAt ? cur : acc), comments[0]) : null;

  await TeamHubDiscussion.findByIdAndUpdate(postId, {
    $set: {
      'stats.commentCount': commentCount,
      'stats.replyCount': replyCount,
      'stats.lastActivityAt': lastComment ? lastComment.createdAt : new Date(),
    },
  });
}

function sortQuery(sort) {
  switch (sort) {
    case 'active':
      return { 'stats.lastActivityAt': -1, _id: -1 };
    case 'top':
      return { 'stats.commentCount': -1, createdAt: -1 };
    case 'new':
    default:
      return { createdAt: -1, _id: -1 };
  }
}

function normalizeVoteValue(value) {
  const parsed = Number(value);
  if (parsed === 1 || parsed === -1 || parsed === 0) return parsed;
  return null;
}

async function attachViewerVotes(commentsWithReplies, userId) {
  const allComments = [];
  const stack = [...commentsWithReplies];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    allComments.push(node);
    const replies = node.replies || [];
    for (const reply of replies) stack.push(reply);
  }

  if (!allComments.length) return commentsWithReplies;

  const ids = allComments.map(c => c._id);
  let userVotes = [];

  if (userId) {
    userVotes = await TeamHubCommentVote.find({
      voterUserId: userId,
      commentId: { $in: ids },
    }).select('commentId value').lean();
  }

  const voteMap = new Map(userVotes.map(v => [String(v.commentId), v.value]));

  const applyVotes = (node) => ({
    ...node,
    viewerVote: voteMap.get(String(node._id)) || 0,
    replies: (node.replies || []).map(applyVotes),
  });

  return commentsWithReplies.map(applyVotes);
}

function validateCharLimit(value, maxChars, label) {
  const content = String(value || '').trim();
  if (!content) {
    return { ok: false, message: `${label} is required` };
  }
  if (content.length > maxChars) {
    return { ok: false, message: `${label} must be ${maxChars} characters or fewer` };
  }
  return { ok: true, content };
}

async function attachDiscussionViewerVotes(discussions, userId) {
  if (!Array.isArray(discussions) || !discussions.length || !userId) {
    return discussions;
  }

  const ids = discussions.map(d => d._id);
  const userVotes = await TeamHubDiscussionVote.find({
    voterUserId: userId,
    discussionId: { $in: ids },
  }).select('discussionId value').lean();

  const voteMap = new Map(userVotes.map(v => [String(v.discussionId), v.value]));
  return discussions.map(d => ({
    ...d,
    viewerVote: voteMap.get(String(d._id)) || 0,
  }));
}

exports.listDiscussions = async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const { page, limit, skip } = parsePageLimit(req.query);
    const sort = sortQuery(req.query.sort);

    const team = await getTeamBySlug(teamSlug);
    if (!team) {
      return res.status(404).json({ status: 'fail', message: 'Team not found' });
    }

    const query = {
      teamSlug: team.slug,
      isHidden: false,
    };

    const total = await TeamHubDiscussion.countDocuments(query);
    const discussionsRaw = await TeamHubDiscussion.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const discussions = await attachDiscussionViewerVotes(
      discussionsRaw,
      req.user ? req.user._id : null
    );

    return res.status(200).json({
      status: 'success',
      results: discussions.length,
      page,
      total,
      totalPages: Math.ceil(total / limit),
      data: {
        discussions,
      },
    });
  } catch (error) {
    console.error('listDiscussions error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to list discussions' });
  }
};

exports.createDiscussion = async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const { title, body } = req.body;

    const titleValidation = validateCharLimit(title, COMMUNITY_LIMITS.DISCUSSION_TITLE_MAX_CHARS, 'Title');
    if (!titleValidation.ok) return res.status(400).json({ status: 'fail', message: titleValidation.message });

    const bodyValidation = validateCharLimit(body, COMMUNITY_LIMITS.DISCUSSION_BODY_MAX_CHARS, 'Body');
    if (!bodyValidation.ok) return res.status(400).json({ status: 'fail', message: bodyValidation.message });

    const restriction = hasModerationRestriction(req.user);
    if (restriction.blocked) {
      return res.status(403).json({ status: 'fail', message: restriction.message, code: restriction.code });
    }

    const team = await getTeamBySlug(teamSlug);
    if (!team) {
      return res.status(404).json({ status: 'fail', message: 'Team not found' });
    }

    const discussion = await TeamHubDiscussion.create({
      teamId: team.id,
      teamSlug: team.slug,
      teamNameSnapshot: team.name || '',
      authorUserId: req.user._id,
      authorSnapshot: getAuthorSnapshot(req.user),
      title: titleValidation.content,
      body: bodyValidation.content,
      status: 'active',
      futureContext: {
        contextType: 'team',
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Discussion created successfully',
      data: { discussion },
    });
  } catch (error) {
    console.error('createDiscussion error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to create discussion' });
  }
};

exports.getDiscussion = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;
    const { page, limit, skip } = parsePageLimit(req.query);

    if (!mongoose.Types.ObjectId.isValid(discussionId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid discussion ID' });
    }

    const discussionRaw = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: String(teamSlug).toLowerCase(),
    }).lean();

    const [discussion] = await attachDiscussionViewerVotes(
      discussionRaw ? [discussionRaw] : [],
      req.user ? req.user._id : null
    );

    if (!discussion || discussion.isHidden) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    const topLevelQuery = {
      postId: discussion._id,
      parentCommentId: null,
      isHidden: false,
    };

    const totalTopLevel = await TeamHubComment.countDocuments(topLevelQuery);
    const comments = await TeamHubComment.find(topLevelQuery)
      .sort({ createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const topLevelIds = comments.map(c => c._id);
    const commentForestRaw = topLevelIds.length
      ? await TeamHubComment.find({
          postId: discussion._id,
          isHidden: false,
          $or: [
            { _id: { $in: topLevelIds } },
            { rootCommentId: { $in: topLevelIds } },
          ],
        }).sort({ createdAt: 1, _id: 1 }).lean()
      : [];

    const nodeMap = new Map(commentForestRaw.map(c => [String(c._id), { ...c, replies: [] }]));
    for (const node of nodeMap.values()) {
      if (!node.parentCommentId) continue;
      const parent = nodeMap.get(String(node.parentCommentId));
      if (parent) {
        parent.replies.push(node);
      }
    }

    const commentsWithRepliesRaw = topLevelIds
      .map(id => nodeMap.get(String(id)))
      .filter(Boolean);

    const commentsWithReplies = await attachViewerVotes(
      commentsWithRepliesRaw,
      req.user ? req.user._id : null
    );

    return res.status(200).json({
      status: 'success',
      data: {
        discussion,
        comments: commentsWithReplies,
        commentsPagination: {
          total: totalTopLevel,
          page,
          limit,
          totalPages: Math.ceil(totalTopLevel / limit),
        },
      },
    });
  } catch (error) {
    console.error('getDiscussion error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to load discussion' });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;
    const { body } = req.body;

    const bodyValidation = validateCharLimit(body, COMMUNITY_LIMITS.COMMENT_BODY_MAX_CHARS, 'Comment body');
    if (!bodyValidation.ok) return res.status(400).json({ status: 'fail', message: bodyValidation.message });

    const restriction = hasModerationRestriction(req.user);
    if (restriction.blocked) {
      return res.status(403).json({ status: 'fail', message: restriction.message, code: restriction.code });
    }

    const discussion = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: String(teamSlug).toLowerCase(),
      isDeleted: false,
      isHidden: false,
    });

    if (!discussion) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    if (discussion.status === 'locked') {
      return res.status(409).json({ status: 'fail', message: 'Discussion is locked' });
    }

    const comment = await TeamHubComment.create({
      postId: discussion._id,
      teamId: discussion.teamId,
      teamSlug: discussion.teamSlug,
      authorUserId: req.user._id,
      authorSnapshot: getAuthorSnapshot(req.user),
      body: bodyValidation.content,
      parentCommentId: null,
      rootCommentId: null,
      depth: 0,
    });

    await refreshDiscussionStats(discussion._id);

    return res.status(201).json({
      status: 'success',
      message: 'Comment created successfully',
      data: { comment },
    });
  } catch (error) {
    console.error('createComment error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to create comment' });
  }
};

exports.createReply = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;
    const { body, parentCommentId } = req.body;

    if (!parentCommentId) {
      return res.status(400).json({ status: 'fail', message: 'Reply body and parentCommentId are required' });
    }

    const bodyValidation = validateCharLimit(body, COMMUNITY_LIMITS.COMMENT_BODY_MAX_CHARS, 'Reply body');
    if (!bodyValidation.ok) return res.status(400).json({ status: 'fail', message: bodyValidation.message });

    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid parentCommentId' });
    }

    const restriction = hasModerationRestriction(req.user);
    if (restriction.blocked) {
      return res.status(403).json({ status: 'fail', message: restriction.message, code: restriction.code });
    }

    const discussion = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: String(teamSlug).toLowerCase(),
      isDeleted: false,
      isHidden: false,
    });

    if (!discussion) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    if (discussion.status === 'locked') {
      return res.status(409).json({ status: 'fail', message: 'Discussion is locked' });
    }

    const parentComment = await TeamHubComment.findOne({
      _id: parentCommentId,
      postId: discussion._id,
    });

    if (!parentComment) {
      return res.status(404).json({ status: 'fail', message: 'Parent comment not found' });
    }

    if (parentComment.isDeleted) {
      return res.status(409).json({ status: 'fail', message: 'Cannot reply to this comment' });
    }

    const reply = await TeamHubComment.create({
      postId: discussion._id,
      teamId: discussion.teamId,
      teamSlug: discussion.teamSlug,
      authorUserId: req.user._id,
      authorSnapshot: getAuthorSnapshot(req.user),
      body: bodyValidation.content,
      parentCommentId: parentComment._id,
      rootCommentId: parentComment.rootCommentId || parentComment._id,
      depth: (parentComment.depth || 0) + 1,
    });

    await refreshDiscussionStats(discussion._id);

    return res.status(201).json({
      status: 'success',
      message: 'Reply created successfully',
      data: { reply },
    });
  } catch (error) {
    console.error('createReply error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to create reply' });
  }
};

exports.updateDiscussion = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;
    const { title, body } = req.body;

    const discussion = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: String(teamSlug).toLowerCase(),
    });

    if (!discussion || discussion.isHidden) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    const isOwner = String(discussion.authorUserId) === String(req.user._id);
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'You can only edit your own discussion' });
    }

    if (discussion.isDeleted) {
      return res.status(409).json({ status: 'fail', message: 'Deleted discussions cannot be edited' });
    }

    if (typeof title === 'string' && title.trim()) {
      discussion.title = title.trim();
    }
    if (typeof body === 'string' && body.trim()) {
      discussion.body = body.trim();
    }

    discussion.editedAt = new Date();
    discussion.editCount += 1;

    await discussion.save();

    return res.status(200).json({
      status: 'success',
      message: 'Discussion updated successfully',
      data: { discussion },
    });
  } catch (error) {
    console.error('updateDiscussion error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update discussion' });
  }
};

exports.deleteDiscussion = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;

    const discussion = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: String(teamSlug).toLowerCase(),
    });

    if (!discussion || discussion.isHidden) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    const isOwner = String(discussion.authorUserId) === String(req.user._id);
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'You can only delete your own discussion' });
    }

    discussion.isDeleted = true;
    discussion.deletedAt = new Date();
    discussion.deletedByUserId = req.user._id;
    discussion.deletionReason = isOwner ? 'deleted_by_author' : 'deleted_by_moderator';
    discussion.status = isOwner ? 'removed_by_author' : 'removed_by_moderator';
    discussion.title = '[Deleted discussion]';
    discussion.body = 'This discussion has been deleted.';

    await discussion.save();

    return res.status(200).json({
      status: 'success',
      message: 'Discussion deleted successfully',
      data: { discussionId: discussion._id },
    });
  } catch (error) {
    console.error('deleteDiscussion error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to delete discussion' });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { teamSlug, commentId } = req.params;
    const { body } = req.body;

    const bodyValidation = validateCharLimit(body, COMMUNITY_LIMITS.COMMENT_BODY_MAX_CHARS, 'Comment body');
    if (!bodyValidation.ok) return res.status(400).json({ status: 'fail', message: bodyValidation.message });

    const comment = await TeamHubComment.findOne({
      _id: commentId,
      teamSlug: String(teamSlug).toLowerCase(),
    });

    if (!comment || comment.isHidden) {
      return res.status(404).json({ status: 'fail', message: 'Comment not found' });
    }

    const isOwner = String(comment.authorUserId) === String(req.user._id);
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'You can only edit your own comment' });
    }

    if (comment.isDeleted) {
      return res.status(409).json({ status: 'fail', message: 'Deleted comments cannot be edited' });
    }

    comment.body = bodyValidation.content;
    comment.editedAt = new Date();
    comment.editCount += 1;
    await comment.save();

    return res.status(200).json({
      status: 'success',
      message: 'Comment updated successfully',
      data: { comment },
    });
  } catch (error) {
    console.error('updateComment error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update comment' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { teamSlug, commentId } = req.params;

    const comment = await TeamHubComment.findOne({
      _id: commentId,
      teamSlug: String(teamSlug).toLowerCase(),
    });

    if (!comment || comment.isHidden) {
      return res.status(404).json({ status: 'fail', message: 'Comment not found' });
    }

    const isOwner = String(comment.authorUserId) === String(req.user._id);
    const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ status: 'fail', message: 'You can only delete your own comment' });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedByUserId = req.user._id;
    comment.deletionReason = isOwner ? 'deleted_by_author' : 'deleted_by_moderator';
    comment.status = isOwner ? 'removed_by_author' : 'removed_by_moderator';
    comment.body = 'This comment has been deleted.';
    await comment.save();

    await refreshDiscussionStats(comment.postId);

    return res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully',
      data: { commentId: comment._id },
    });
  } catch (error) {
    console.error('deleteComment error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to delete comment' });
  }
};

exports.reportContent = async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const { targetType, targetId, reasonCode, reasonText } = req.body;

    if (!targetType || !targetId || !reasonCode) {
      return res.status(400).json({ status: 'fail', message: 'targetType, targetId and reasonCode are required' });
    }

    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ status: 'fail', message: 'targetType must be post or comment' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid targetId' });
    }

    const team = await getTeamBySlug(teamSlug);
    if (!team) {
      return res.status(404).json({ status: 'fail', message: 'Team not found' });
    }

    let postId;
    let targetSubtype = 'discussion';
    let contentSnapshot = { title: '', body: '' };

    if (targetType === 'post') {
      const post = await TeamHubDiscussion.findOne({ _id: targetId, teamSlug: team.slug });
      if (!post) return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
      postId = post._id;
      contentSnapshot = { title: post.title || '', body: post.body || '' };
      await TeamHubDiscussion.findByIdAndUpdate(post._id, { $inc: { 'stats.reportCount': 1 } });
    } else {
      const comment = await TeamHubComment.findOne({ _id: targetId, teamSlug: team.slug });
      if (!comment) return res.status(404).json({ status: 'fail', message: 'Comment not found' });
      postId = comment.postId;
      targetSubtype = comment.depth > 0 ? 'reply' : 'top_level_comment';
      contentSnapshot = { title: '', body: comment.body || '' };
      await TeamHubComment.findByIdAndUpdate(comment._id, { $inc: { reportCount: 1 } });
      await TeamHubDiscussion.findByIdAndUpdate(comment.postId, { $inc: { 'stats.reportCount': 1 } });
    }

    const severe = ['hate_or_discrimination', 'threats_or_violence', 'sexual_content', 'harassment_abuse'];
    const priority = severe.includes(reasonCode) ? 'high' : 'low';

    const report = await TeamHubReport.findOneAndUpdate(
      {
        reporterUserId: req.user._id,
        targetType,
        targetId,
      },
      {
        $set: {
          postId,
          teamId: team.id,
          teamSlug: team.slug,
          reasonCode,
          reasonText: String(reasonText || '').trim(),
          status: 'open',
          priority,
          targetSubtype,
          contentSnapshot,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    return res.status(201).json({
      status: 'success',
      message: 'Report submitted successfully',
      data: { report },
    });
  } catch (error) {
    console.error('reportContent error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to submit report' });
  }
};

exports.voteComment = async (req, res) => {
  try {
    const { teamSlug, commentId } = req.params;
    const normalizedTeamSlug = String(teamSlug || '').trim().toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid comment ID' });
    }

    const value = normalizeVoteValue(req.body?.value);
    if (value === null) {
      return res.status(400).json({ status: 'fail', message: 'Vote value must be 1, -1, or 0' });
    }

    const comment = await TeamHubComment.findOne({
      _id: commentId,
      teamSlug: normalizedTeamSlug,
      isHidden: false,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({ status: 'fail', message: 'Comment not found' });
    }

    const existingVote = await TeamHubCommentVote.findOne({
      commentId: comment._id,
      voterUserId: req.user._id,
    });

    const previous = existingVote ? existingVote.value : 0;
    let next = value;

    // Clicking the same vote again removes the vote.
    if (existingVote && value === previous) {
      next = 0;
    }

    if (next === 0) {
      if (existingVote) {
        await TeamHubCommentVote.deleteOne({ _id: existingVote._id });
      }
    } else if (existingVote) {
      existingVote.value = next;
      await existingVote.save();
    } else {
      await TeamHubCommentVote.create({
        commentId: comment._id,
        postId: comment.postId,
        teamSlug: comment.teamSlug,
        voterUserId: req.user._id,
        value: next,
      });
    }

    const upvoteDelta = (next === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
    const downvoteDelta = (next === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
    const voteScoreDelta = next - previous;

    const updatedComment = await TeamHubComment.findByIdAndUpdate(
      comment._id,
      {
        $inc: {
          upvoteCount: upvoteDelta,
          downvoteCount: downvoteDelta,
          voteScore: voteScoreDelta,
        },
      },
      { new: true }
    ).lean();

    return res.status(200).json({
      status: 'success',
      message: 'Vote updated',
      data: {
        commentId: comment._id,
        viewerVote: next,
        upvoteCount: updatedComment?.upvoteCount || 0,
        downvoteCount: updatedComment?.downvoteCount || 0,
        voteScore: updatedComment?.voteScore || 0,
      },
    });
  } catch (error) {
    console.error('voteComment error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update vote' });
  }
};

exports.voteDiscussion = async (req, res) => {
  try {
    const { teamSlug, discussionId } = req.params;
    const normalizedTeamSlug = String(teamSlug || '').trim().toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(discussionId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid discussion ID' });
    }

    const value = normalizeVoteValue(req.body?.value);
    if (value === null) {
      return res.status(400).json({ status: 'fail', message: 'Vote value must be 1, -1, or 0' });
    }

    const discussion = await TeamHubDiscussion.findOne({
      _id: discussionId,
      teamSlug: normalizedTeamSlug,
      isHidden: false,
      isDeleted: false,
    });

    if (!discussion) {
      return res.status(404).json({ status: 'fail', message: 'Discussion not found' });
    }

    const existingVote = await TeamHubDiscussionVote.findOne({
      discussionId: discussion._id,
      voterUserId: req.user._id,
    });

    const previous = existingVote ? existingVote.value : 0;
    let next = value;

    if (existingVote && value === previous) {
      next = 0;
    }

    if (next === 0) {
      if (existingVote) {
        await TeamHubDiscussionVote.deleteOne({ _id: existingVote._id });
      }
    } else if (existingVote) {
      existingVote.value = next;
      await existingVote.save();
    } else {
      await TeamHubDiscussionVote.create({
        discussionId: discussion._id,
        teamSlug: discussion.teamSlug,
        voterUserId: req.user._id,
        value: next,
      });
    }

    const upvoteDelta = (next === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
    const downvoteDelta = (next === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
    const voteScoreDelta = next - previous;

    const updatedDiscussion = await TeamHubDiscussion.findByIdAndUpdate(
      discussion._id,
      {
        $inc: {
          upvoteCount: upvoteDelta,
          downvoteCount: downvoteDelta,
          voteScore: voteScoreDelta,
        },
      },
      { new: true }
    ).lean();

    return res.status(200).json({
      status: 'success',
      message: 'Vote updated',
      data: {
        discussionId: discussion._id,
        viewerVote: next,
        upvoteCount: updatedDiscussion?.upvoteCount || 0,
        downvoteCount: updatedDiscussion?.downvoteCount || 0,
        voteScore: updatedDiscussion?.voteScore || 0,
      },
    });
  } catch (error) {
    console.error('voteDiscussion error:', error);
    return res.status(500).json({ status: 'fail', message: 'Failed to update vote' });
  }
};

exports.adminListReports = async (req, res) => {
  try {
    const { page, limit, skip } = parsePageLimit(req.query);
    const query = {};

    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.reasonCode) query.reasonCode = req.query.reasonCode;
    if (req.query.teamSlug) query.teamSlug = String(req.query.teamSlug).toLowerCase();
    if (req.query.targetType) query.targetType = req.query.targetType;

    const total = await TeamHubReport.countDocuments(query);
    const reports = await TeamHubReport.find(query)
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('adminListReports error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load moderation queue' });
  }
};

exports.adminDismissReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { note = '' } = req.body;

    const report = await TeamHubReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          status: 'dismissed',
          resolutionCode: 'dismissed_no_violation',
          reviewedByUserId: req.user ? req.user._id : null,
          reviewedAt: new Date(),
          resolutionNote: String(note || '').trim(),
        },
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    return res.json({ success: true, report });
  } catch (error) {
    console.error('adminDismissReport error:', error);
    return res.status(500).json({ success: false, error: 'Failed to dismiss report' });
  }
};

async function findTarget(targetType, targetId) {
  if (targetType === 'post') {
    return TeamHubDiscussion.findById(targetId);
  }
  return TeamHubComment.findById(targetId);
}

exports.adminHideContent = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    const target = await findTarget(targetType, targetId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Target content not found' });
    }

    target.isHidden = true;
    await target.save();

    await TeamHubReport.updateMany(
      { targetType, targetId, status: { $in: ['open', 'in_review'] } },
      {
        $set: {
          status: 'action_taken',
          resolutionCode: 'hide',
          reviewedByUserId: req.user ? req.user._id : null,
          reviewedAt: new Date(),
        },
      }
    );

    return res.json({ success: true, message: 'Content hidden successfully' });
  } catch (error) {
    console.error('adminHideContent error:', error);
    return res.status(500).json({ success: false, error: 'Failed to hide content' });
  }
};

exports.adminDeleteContent = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    const target = await findTarget(targetType, targetId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Target content not found' });
    }

    target.isDeleted = true;
    target.deletedAt = new Date();
    target.deletedByUserId = req.user ? req.user._id : null;
    target.deletionReason = 'deleted_by_moderator';
    target.status = 'removed_by_moderator';

    if (targetType === 'post') {
      target.title = '[Deleted discussion]';
      target.body = 'This discussion has been deleted by moderation.';
    } else {
      target.body = 'This comment has been deleted by moderation.';
    }

    await target.save();

    await TeamHubReport.updateMany(
      { targetType, targetId, status: { $in: ['open', 'in_review'] } },
      {
        $set: {
          status: 'closed_content_deleted',
          resolutionCode: 'delete_soft',
          reviewedByUserId: req.user ? req.user._id : null,
          reviewedAt: new Date(),
        },
      }
    );

    if (targetType === 'comment') {
      await refreshDiscussionStats(target.postId);
    }

    return res.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('adminDeleteContent error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete content' });
  }
};

async function setUserModerationState(userId, updates) {
  const user = await User.findById(userId);
  if (!user) return null;

  if (!user.moderation) {
    user.moderation = {};
  }

  Object.assign(user.moderation, updates);
  await user.save({ validateBeforeSave: false });
  return user;
}

exports.adminRestrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { durationHours = 24 } = req.body;

    const restrictedUntil = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
    const user = await setUserModerationState(userId, {
      isRestricted: true,
      restrictedUntil,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id, restrictedUntil });
  } catch (error) {
    console.error('adminRestrictUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to restrict user' });
  }
};

exports.adminSuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { durationHours = 24 * 7 } = req.body;

    const suspendedUntil = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
    const user = await setUserModerationState(userId, {
      isSuspended: true,
      suspendedUntil,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id, suspendedUntil });
  } catch (error) {
    console.error('adminSuspendUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to suspend user' });
  }
};

exports.adminBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await setUserModerationState(userId, {
      isBanned: true,
      bannedAt: new Date(),
      isSuspended: false,
      suspendedUntil: null,
      isRestricted: false,
      restrictedUntil: null,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id, bannedAt: user.moderation?.bannedAt });
  } catch (error) {
    console.error('adminBanUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to ban user' });
  }
};

exports.adminUnrestrictUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await setUserModerationState(userId, {
      isRestricted: false,
      restrictedUntil: null,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error('adminUnrestrictUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to unrestrict user' });
  }
};

exports.adminUnsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await setUserModerationState(userId, {
      isSuspended: false,
      suspendedUntil: null,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error('adminUnsuspendUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to unsuspend user' });
  }
};

exports.adminUnbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await setUserModerationState(userId, {
      isBanned: false,
      bannedAt: null,
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error('adminUnbanUser error:', error);
    return res.status(500).json({ success: false, error: 'Failed to unban user' });
  }
};
