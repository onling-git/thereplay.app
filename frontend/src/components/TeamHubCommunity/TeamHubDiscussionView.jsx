import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';
import {
  createComment,
  createReply,
  deleteComment,
  deleteDiscussion,
  getDiscussion,
  reportContent,
  updateComment,
  updateDiscussion,
  voteComment,
} from '../../api/community';
import './TeamHubCommunity.css';

const REPORT_REASONS = [
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
];

const TeamHubDiscussionView = ({ teamSlug, discussionId }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [discussion, setDiscussion] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editing, setEditing] = useState({ type: null, id: null, value: '' });
  const [reporting, setReporting] = useState({ open: false, targetType: 'post', targetId: null });
  const [reportReason, setReportReason] = useState('spam');
  const [reportText, setReportText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const loadDiscussion = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getDiscussion(teamSlug, discussionId, { page: 1, limit: 20 });
      setDiscussion(response?.data?.discussion || null);
      setComments(response?.data?.comments || []);
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to load discussion');
      setDiscussion(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [discussionId, teamSlug]);

  useEffect(() => {
    if (!teamSlug || !discussionId) return;
    loadDiscussion();
  }, [teamSlug, discussionId, loadDiscussion]);

  const ensureAuth = () => {
    if (isAuthenticated) return true;
    setShowAuthModal(true);
    return false;
  };

  const currentUserId = user?._id || user?.id;
  const canEditAuthor = (authorUserId) => currentUserId && String(currentUserId) === String(authorUserId);

  const onCreateComment = async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (!commentBody.trim()) return;

    try {
      setBusy(true);
      await createComment(teamSlug, discussionId, { body: commentBody.trim() });
      setCommentBody('');
      await loadDiscussion();
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to post comment');
    } finally {
      setBusy(false);
    }
  };

  const onCreateReply = async (parentCommentId) => {
    if (!ensureAuth()) return;
    const value = (replyDrafts[parentCommentId] || '').trim();
    if (!value) return;

    try {
      setBusy(true);
      await createReply(teamSlug, discussionId, { body: value, parentCommentId });
      setReplyDrafts((prev) => ({ ...prev, [parentCommentId]: '' }));
      await loadDiscussion();
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to post reply');
    } finally {
      setBusy(false);
    }
  };

  const startEditDiscussion = () => {
    setEditing({ type: 'discussion', id: discussion?._id, value: discussion?.body || '' });
  };

  const startEditComment = (comment) => {
    setEditing({ type: 'comment', id: comment._id, value: comment.body || '' });
  };

  const cancelEdit = () => {
    setEditing({ type: null, id: null, value: '' });
  };

  const saveEdit = async () => {
    if (!editing.value.trim()) return;

    try {
      setBusy(true);
      if (editing.type === 'discussion') {
        await updateDiscussion(teamSlug, editing.id, { body: editing.value.trim() });
      } else if (editing.type === 'comment') {
        await updateComment(teamSlug, editing.id, { body: editing.value.trim() });
      }
      cancelEdit();
      await loadDiscussion();
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to save edits');
    } finally {
      setBusy(false);
    }
  };

  const onDeleteDiscussion = async () => {
    if (!ensureAuth()) return;
    if (!window.confirm('Delete this discussion?')) return;

    try {
      setBusy(true);
      await deleteDiscussion(teamSlug, discussionId);
      navigate(`/${teamSlug}`);
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to delete discussion');
    } finally {
      setBusy(false);
    }
  };

  const onDeleteComment = async (commentId) => {
    if (!ensureAuth()) return;
    if (!window.confirm('Delete this comment?')) return;

    try {
      setBusy(true);
      await deleteComment(teamSlug, commentId);
      await loadDiscussion();
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to delete comment');
    } finally {
      setBusy(false);
    }
  };

  const onVoteComment = async (commentId, value) => {
    if (!ensureAuth()) return;

    try {
      setBusy(true);
      const response = await voteComment(teamSlug, commentId, value);
      const voteData = response?.data;
      if (!voteData) {
        await loadDiscussion();
        return;
      }

      const applyVotePatch = (item) => {
        if (String(item._id) !== String(commentId)) return item;
        return {
          ...item,
          viewerVote: voteData.viewerVote,
          upvoteCount: voteData.upvoteCount,
          downvoteCount: voteData.downvoteCount,
          voteScore: voteData.voteScore,
        };
      };

      setComments((prev) => prev.map((comment) => ({
        ...applyVotePatch(comment),
        replies: (comment.replies || []).map((reply) => applyVotePatch(reply)),
      })));
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to vote');
    } finally {
      setBusy(false);
    }
  };

  const openReport = (targetType, targetId) => {
    if (!ensureAuth()) return;
    setReporting({ open: true, targetType, targetId });
    setReportReason('spam');
    setReportText('');
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reporting.targetId) return;

    try {
      setBusy(true);
      await reportContent(teamSlug, {
        targetType: reporting.targetType,
        targetId: reporting.targetId,
        reasonCode: reportReason,
        reasonText: reportText,
      });
      setReporting({ open: false, targetType: 'post', targetId: null });
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to submit report');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="community-state">Loading discussion...</div>;
  if (error && !discussion) return <div className="community-state error">{error}</div>;
  if (!discussion) return <div className="community-state empty">Discussion not found.</div>;

  const discussionCanEdit = canEditAuthor(discussion.authorUserId);

  return (
    <section className="team-hub-community-section discussion-view">
      <div className="community-header-row">
        <div>
          <h2>Community Discussion</h2>
          <p>
            <Link to={`/${teamSlug}`}>Back to Team Hub</Link>
          </p>
        </div>
      </div>

      {error && <div className="community-state error">{error}</div>}

      <article className="community-discussion-card full">
        <h3>{discussion.title}</h3>
        {editing.type === 'discussion' && editing.id === discussion._id ? (
          <div className="inline-editor">
            <textarea
              value={editing.value}
              onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
              rows={5}
            />
            <div className="composer-actions">
              <button className="btn" type="button" onClick={saveEdit} disabled={busy}>Save</button>
              <button className="btn" type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className="discussion-snippet">{discussion.body}</p>
        )}
        <div className="discussion-meta">
          <span>{discussion.authorSnapshot?.displayName || 'User'}</span>
          <span>•</span>
          <span>{new Date(discussion.createdAt).toLocaleString()}</span>
          <span>•</span>
          <span>{discussion.stats?.commentCount || 0} comments</span>
        </div>
        <div className="discussion-actions">
          {discussionCanEdit && editing.type !== 'discussion' && (
            <>
              <button className="btn" type="button" onClick={startEditDiscussion}>Edit</button>
              <button className="btn" type="button" onClick={onDeleteDiscussion}>Delete</button>
            </>
          )}
          {!discussionCanEdit && (
            <button className="btn" type="button" onClick={() => openReport('post', discussion._id)}>Report</button>
          )}
        </div>
      </article>

      <form className="community-composer" onSubmit={onCreateComment}>
        <textarea
          placeholder={isAuthenticated ? 'Add a comment...' : 'Sign in to comment'}
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          disabled={!isAuthenticated || busy || discussion.status === 'locked'}
        />
        <div className="composer-actions">
          <button className="btn" type="submit" disabled={!isAuthenticated || busy || discussion.status === 'locked'}>
            {busy ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      <div className="community-list">
        {comments.length === 0 && <div className="community-state empty">No comments yet.</div>}
        {comments.map((comment) => {
          const commentCanEdit = canEditAuthor(comment.authorUserId);
          const isEditingComment = editing.type === 'comment' && editing.id === comment._id;
          return (
            <article key={comment._id} className="community-discussion-card comment-card">
              {isEditingComment ? (
                <div className="inline-editor">
                  <textarea
                    value={editing.value}
                    onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
                    rows={3}
                  />
                  <div className="composer-actions">
                    <button className="btn" type="button" onClick={saveEdit} disabled={busy}>Save</button>
                    <button className="btn" type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="discussion-snippet">{comment.body}</p>
              )}
              <div className="discussion-meta">
                <span>{comment.authorSnapshot?.displayName || 'User'}</span>
                <span>•</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <div className="comment-vote-row">
                <button
                  className={`btn vote-btn ${comment.viewerVote === 1 ? 'active' : ''}`}
                  type="button"
                  onClick={() => onVoteComment(comment._id, 1)}
                  disabled={busy}
                >
                  Upvote
                </button>
                <span className="vote-score">{comment.voteScore || 0}</span>
                <button
                  className={`btn vote-btn ${comment.viewerVote === -1 ? 'active' : ''}`}
                  type="button"
                  onClick={() => onVoteComment(comment._id, -1)}
                  disabled={busy}
                >
                  Downvote
                </button>
              </div>
              <div className="discussion-actions">
                {commentCanEdit && !isEditingComment && (
                  <>
                    <button className="btn" type="button" onClick={() => startEditComment(comment)}>Edit</button>
                    <button className="btn" type="button" onClick={() => onDeleteComment(comment._id)}>Delete</button>
                  </>
                )}
                {!commentCanEdit && (
                  <button className="btn" type="button" onClick={() => openReport('comment', comment._id)}>Report</button>
                )}
                <button className="btn" type="button" onClick={() => setReplyDrafts((prev) => ({ ...prev, [comment._id]: prev[comment._id] || '' }))}>Reply</button>
              </div>

              {Object.prototype.hasOwnProperty.call(replyDrafts, comment._id) && (
                <div className="reply-composer">
                  <textarea
                    value={replyDrafts[comment._id]}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [comment._id]: e.target.value }))}
                    rows={2}
                    placeholder="Write a reply..."
                  />
                  <div className="composer-actions">
                    <button className="btn" type="button" onClick={() => onCreateReply(comment._id)} disabled={busy}>Send Reply</button>
                  </div>
                </div>
              )}

              {(comment.replies || []).length > 0 && (
                <div className="reply-list">
                  {comment.replies.map((reply) => {
                    const replyCanEdit = canEditAuthor(reply.authorUserId);
                    const isEditingReply = editing.type === 'comment' && editing.id === reply._id;
                    return (
                      <div key={reply._id} className="reply-item">
                        {isEditingReply ? (
                          <div className="inline-editor">
                            <textarea
                              value={editing.value}
                              onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
                              rows={2}
                            />
                            <div className="composer-actions">
                              <button className="btn" type="button" onClick={saveEdit} disabled={busy}>Save</button>
                              <button className="btn" type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="discussion-snippet">{reply.body}</p>
                        )}
                        <div className="discussion-meta">
                          <span>{reply.authorSnapshot?.displayName || 'User'}</span>
                          <span>•</span>
                          <span>{new Date(reply.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="comment-vote-row">
                          <button
                            className={`btn vote-btn ${reply.viewerVote === 1 ? 'active' : ''}`}
                            type="button"
                            onClick={() => onVoteComment(reply._id, 1)}
                            disabled={busy}
                          >
                            Upvote
                          </button>
                          <span className="vote-score">{reply.voteScore || 0}</span>
                          <button
                            className={`btn vote-btn ${reply.viewerVote === -1 ? 'active' : ''}`}
                            type="button"
                            onClick={() => onVoteComment(reply._id, -1)}
                            disabled={busy}
                          >
                            Downvote
                          </button>
                        </div>
                        <div className="discussion-actions">
                          {replyCanEdit && !isEditingReply && (
                            <>
                              <button className="btn" type="button" onClick={() => startEditComment(reply)}>Edit</button>
                              <button className="btn" type="button" onClick={() => onDeleteComment(reply._id)}>Delete</button>
                            </>
                          )}
                          {!replyCanEdit && (
                            <button className="btn" type="button" onClick={() => openReport('comment', reply._id)}>Report</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {reporting.open && (
        <div className="community-report-overlay" onClick={() => setReporting({ open: false, targetType: 'post', targetId: null })}>
          <form className="community-report-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitReport}>
            <h3>Report Content</h3>
            <label htmlFor="reason">Reason</label>
            <select id="reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <label htmlFor="details">Details (optional)</label>
            <textarea
              id="details"
              rows={3}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
            />
            <div className="composer-actions">
              <button className="btn" type="submit" disabled={busy}>Submit Report</button>
              <button className="btn" type="button" onClick={() => setReporting({ open: false, targetType: 'post', targetId: null })}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </section>
  );
};

export default TeamHubDiscussionView;
