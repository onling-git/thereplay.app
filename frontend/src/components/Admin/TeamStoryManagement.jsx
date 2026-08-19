// components/Admin/TeamStoryManagement.jsx
import React, { useState, useEffect } from 'react';
import * as adminApi from '../../api/adminApi';
import './TeamStoryManagement.css';

const TeamStoryManagement = () => {
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [story, setStory] = useState(null);
  const [content, setContent] = useState('');
  const [loadingStory, setLoadingStory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      const data = await adminApi.getAllTeams();
      setTeams(data.teams || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  };

  const selectTeam = async (team) => {
    setSelectedTeam(team);
    setError('');
    setSuccessMessage('');
    setLoadingStory(true);
    try {
      const data = await adminApi.getTeamStory(team.id);
      setStory(data.team.story);
      setContent(data.team.story.content || '');
    } catch (err) {
      console.error('Error fetching team story:', err);
      setError('Failed to load team story');
    } finally {
      setLoadingStory(false);
    }
  };

  const saveStory = async (status) => {
    if (!selectedTeam) return;
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      const data = await adminApi.updateTeamStory(selectedTeam.id, { content, status });
      setStory(data.team.story);
      setSuccessMessage(
        status === 'published' ? 'Team story published successfully!' : 'Draft saved successfully!'
      );
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving team story:', err);
      const errorMessage = err.body?.error || err.message || 'Unknown error';
      setError('Failed to save team story: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const filteredTeams = teams.filter(team =>
    (team.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.slug || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingTeams) {
    return (
      <div className="team-story-management">
        <div className="loading">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="team-story-management">
      <div className="team-story-header">
        <h2>Team Story</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="team-story-layout">
        <div className="team-story-list">
          {filteredTeams.map(team => (
            <button
              key={team.id}
              className={`team-story-list-item ${selectedTeam?.id === team.id ? 'active' : ''}`}
              onClick={() => selectTeam(team)}
            >
              <span className="team-story-list-name">{team.name || 'Unnamed team'}</span>
              <span className="team-story-list-slug">{team.slug ? `/${team.slug}` : ''}</span>
            </button>
          ))}
        </div>

        <div className="team-story-editor">
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}

          {!selectedTeam && (
            <div className="team-story-empty">Select a team to view or edit its story.</div>
          )}

          {selectedTeam && loadingStory && (
            <div className="loading">Loading story...</div>
          )}

          {selectedTeam && !loadingStory && story && (
            <>
              <div className="team-story-editor-header">
                <h3>{selectedTeam.name}</h3>
                <span className={`status ${story.status === 'published' ? 'enabled' : 'disabled'}`}>
                  {story.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>

              <p className="team-story-meta">
                {story.updated_at && (
                  <span>Last updated: {new Date(story.updated_at).toLocaleString()}</span>
                )}
                {story.published_at && (
                  <span> &middot; Published: {new Date(story.published_at).toLocaleString()}</span>
                )}
              </p>

              <textarea
                className="team-story-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the evergreen editorial story for this club: its place, supporters, history, culture and what makes it distinctive..."
                rows={16}
              />

              <div className="team-story-actions">
                <button
                  className="save-btn"
                  disabled={saving}
                  onClick={() => saveStory('draft')}
                >
                  Save Draft
                </button>
                <button
                  className="publish-btn"
                  disabled={saving || !content.trim()}
                  onClick={() => saveStory('published')}
                >
                  Publish
                </button>
                {story.status === 'published' && (
                  <button
                    className="unpublish-btn"
                    disabled={saving}
                    onClick={() => saveStory('draft')}
                  >
                    Unpublish
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamStoryManagement;
