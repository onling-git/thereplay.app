import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../Auth/AuthModal';
import { createDiscussion, listTeamDiscussions } from '../../api/community';
import './TeamHubCommunity.css';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString();
}

const TeamHubCommunitySection = ({ teamSlug }) => {
  const { isAuthenticated } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const loadDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listTeamDiscussions(teamSlug, { page: 1, limit: 5, sort: 'active' });
      setDiscussions(response?.data?.discussions || []);
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to load community discussions');
      setDiscussions([]);
    } finally {
      setLoading(false);
    }
  }, [teamSlug]);

  useEffect(() => {
    if (!teamSlug) return;
    loadDiscussions();
  }, [teamSlug, loadDiscussions]);

  const onCreateClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    setShowComposer(v => !v);
  };

  const handleCreateDiscussion = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    try {
      setSaving(true);
      await createDiscussion(teamSlug, {
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      setShowComposer(false);
      await loadDiscussions();
    } catch (err) {
      setError(err?.body?.message || err.message || 'Failed to create discussion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="team-hub-community-section">
      <div className="community-header-row">
        <div>
          <h2>Community</h2>
          <p>Talk with other supporters in the {teamSlug} hub.</p>
        </div>
        <button className="btn" type="button" onClick={onCreateClick}>
          {showComposer ? 'Close' : 'New Post'}
        </button>
      </div>

      {showComposer && (
        <form className="community-composer" onSubmit={handleCreateDiscussion}>
          <input
            type="text"
            placeholder="Discussion title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={180}
            required
          />
          <textarea
            placeholder="Share your thoughts with the community"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            rows={4}
            required
          />
          <div className="composer-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Posting...' : 'Post Discussion'}
            </button>
          </div>
        </form>
      )}

      {loading && <div className="community-state">Loading discussions...</div>}
      {!loading && error && <div className="community-state error">{error}</div>}
      {!loading && !error && discussions.length === 0 && (
        <div className="community-state empty">
          No discussions yet. Be the first supporter to post.
        </div>
      )}

      {!loading && !error && discussions.length > 0 && (
        <div className="community-list">
          {discussions.map((discussion) => (
            <article key={discussion._id} className="community-discussion-card">
              <div className="discussion-main">
                <Link to={`/${teamSlug}/community/${discussion._id}`} className="discussion-title-link">
                  <h3>{discussion.title}</h3>
                </Link>
                <p className="discussion-snippet">{discussion.body}</p>
              </div>
              <div className="discussion-meta">
                <span>{discussion.authorSnapshot?.displayName || 'User'}</span>
                <span>•</span>
                <span>{formatTime(discussion.createdAt)}</span>
                <span>•</span>
                <span>{discussion.stats?.commentCount || 0} comments</span>
              </div>
            </article>
          ))}
          <div className="community-footer-link">
            <Link to={`/${teamSlug}/community/${discussions[0]?._id || ''}`}>Open latest discussion</Link>
          </div>
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

export default TeamHubCommunitySection;
