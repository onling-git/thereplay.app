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
  const [knownFacts, setKnownFacts] = useState('');
  const [editorialHints, setEditorialHints] = useState('');
  const [loadingStory, setLoadingStory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Global prompt overrides (not per-team) - collapsed by default
  const [showPrompts, setShowPrompts] = useState(false);
  const [promptDefaults, setPromptDefaults] = useState({ research: '', writing: '' });
  const [researchPrompt, setResearchPrompt] = useState('');
  const [writingPrompt, setWritingPrompt] = useState('');
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [promptsError, setPromptsError] = useState('');
  const [promptsSuccess, setPromptsSuccess] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoadingPrompts(true);
      setPromptsError('');
      const data = await adminApi.getTeamStoryPrompts();
      setResearchPrompt(data.prompts.research_system_prompt || '');
      setWritingPrompt(data.prompts.writing_system_prompt || '');
      setPromptDefaults({
        research: data.prompts.research_default_prompt || '',
        writing: data.prompts.writing_default_prompt || ''
      });
    } catch (err) {
      console.error('Error fetching team story prompts:', err);
      setPromptsError('Failed to load prompt settings');
    } finally {
      setLoadingPrompts(false);
    }
  };

  const toggleShowPrompts = () => {
    const next = !showPrompts;
    setShowPrompts(next);
    if (next && !promptDefaults.research && !promptDefaults.writing) {
      loadPrompts();
    }
  };

  const savePrompts = async () => {
    try {
      setSavingPrompts(true);
      setPromptsError('');
      setPromptsSuccess('');
      await adminApi.updateTeamStoryPrompts({
        research_system_prompt: researchPrompt,
        writing_system_prompt: writingPrompt
      });
      setPromptsSuccess('Prompt settings saved. They apply to every team from now on.');
      setTimeout(() => setPromptsSuccess(''), 4000);
    } catch (err) {
      console.error('Error saving team story prompts:', err);
      const errorMessage = err.body?.error || err.message || 'Unknown error';
      setPromptsError('Failed to save prompt settings: ' + errorMessage);
    } finally {
      setSavingPrompts(false);
    }
  };

  const resetResearchPrompt = () => setResearchPrompt('');
  const resetWritingPrompt = () => setWritingPrompt('');

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
      setKnownFacts(data.team.story.known_facts || '');
      setEditorialHints(data.team.story.editorial_hints || '');
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
      const data = await adminApi.updateTeamStory(selectedTeam.id, { content, known_facts: knownFacts, status });
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

  const generateStory = async () => {
    if (!selectedTeam) return;
    try {
      setGenerating(true);
      setError('');
      setSuccessMessage('');
      const data = await adminApi.generateTeamStory(selectedTeam.id, { known_facts: knownFacts });
      setStory(data.team.story);
      setContent(data.team.story.content || '');
      setSuccessMessage('Draft generated - review and edit below before saving or publishing.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error generating team story:', err);
      const errorMessage = err.body?.error || err.message || 'Unknown error';
      setError('Failed to generate team story: ' + errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const researchStory = async (force) => {
    if (!selectedTeam) return;
    try {
      setResearching(true);
      setError('');
      setSuccessMessage('');
      const data = await adminApi.researchTeamStory(selectedTeam.id, { editorial_hints: editorialHints, force });
      setStory(data.team.story);
      setSuccessMessage('Research completed successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Error researching team story:', err);
      const errorMessage = err.body?.error || err.message || 'Unknown error';
      setError('Failed to research team story: ' + errorMessage);
    } finally {
      setResearching(false);
    }
  };

  const filteredTeams = teams.filter(team =>
    (team.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.slug || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasResearch = !!(story?.research && story.research.trim());
  let parsedResearch = null;
  if (hasResearch) {
    try {
      parsedResearch = JSON.parse(story.research);
    } catch (e) {
      parsedResearch = null;
    }
  }

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

      <div className="team-story-prompts-panel">
        <button className="prompts-toggle-btn" onClick={toggleShowPrompts}>
          {showPrompts ? 'Hide AI prompt settings' : 'Edit AI prompt settings'}
        </button>
        {showPrompts && (
          <div className="team-story-prompts-body">
            <p className="hint">
              These prompts apply to every team's research/generation, not just the one selected below.
              Leave a field blank to use the built-in default.
            </p>
            {promptsError && <div className="error-message">{promptsError}</div>}
            {promptsSuccess && <div className="success-message">{promptsSuccess}</div>}

            {loadingPrompts ? (
              <div className="loading">Loading prompt settings...</div>
            ) : (
              <>
                <div className="team-story-prompt-field">
                  <div className="team-story-prompt-field-header">
                    <label className="team-story-label" htmlFor="research-prompt">Research system prompt</label>
                    <button className="reset-prompt-btn" onClick={resetResearchPrompt} disabled={!researchPrompt}>
                      Reset to default
                    </button>
                  </div>
                  <textarea
                    id="research-prompt"
                    className="team-story-textarea"
                    value={researchPrompt}
                    onChange={(e) => setResearchPrompt(e.target.value)}
                    placeholder={promptDefaults.research}
                    rows={8}
                  />
                </div>

                <div className="team-story-prompt-field">
                  <div className="team-story-prompt-field-header">
                    <label className="team-story-label" htmlFor="writing-prompt">Writing system prompt</label>
                    <button className="reset-prompt-btn" onClick={resetWritingPrompt} disabled={!writingPrompt}>
                      Reset to default
                    </button>
                  </div>
                  <textarea
                    id="writing-prompt"
                    className="team-story-textarea"
                    value={writingPrompt}
                    onChange={(e) => setWritingPrompt(e.target.value)}
                    placeholder={promptDefaults.writing}
                    rows={8}
                  />
                </div>

                <button className="save-prompts-btn" disabled={savingPrompts} onClick={savePrompts}>
                  {savingPrompts ? 'Saving...' : 'Save Prompt Settings'}
                </button>
              </>
            )}
          </div>
        )}
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
                {story.generated_by === 'ai' && (
                  <span className="story-provenance">AI-generated{story.model ? ` (${story.model})` : ''}</span>
                )}
              </div>

              <p className="team-story-meta">
                {story.updated_at && (
                  <span>Last updated: {new Date(story.updated_at).toLocaleString()}</span>
                )}
                {story.published_at && (
                  <span> &middot; Published: {new Date(story.published_at).toLocaleString()}</span>
                )}
              </p>

              <div className="team-story-section-block">
                <h4 className="team-story-section-title">Research</h4>

                <label className="team-story-label" htmlFor="editorial-hints">
                  Editorial hints / research topics (optional)
                </label>
                <textarea
                  id="editorial-hints"
                  className="team-story-textarea team-story-facts"
                  value={editorialHints}
                  onChange={(e) => setEditorialHints(e.target.value)}
                  placeholder="e.g. St Mary's, The Dell, 1976 FA Cup, academy, Portsmouth rivalry"
                  rows={3}
                />
                <p className="hint">
                  These are optional starting points for research, not the final content - the research
                  stage will look beyond them.
                </p>

                {hasResearch ? (
                  <div className="team-story-research-summary">
                    <p className="team-story-research-status">
                      ✓ Research completed
                      {story.research_updated_at && ` on ${new Date(story.research_updated_at).toLocaleString()}`}
                      {story.research_model && ` using ${story.research_model}`}
                    </p>

                    {parsedResearch ? (
                      <>
                        {Array.isArray(parsedResearch.themes) && parsedResearch.themes.length > 0 && (
                          <div className="team-story-research-themes">
                            <strong>Key themes:</strong>
                            <ul>
                              {parsedResearch.themes.map((theme, idx) => (
                                <li key={idx}>{theme}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {Array.isArray(parsedResearch.sources) && parsedResearch.sources.length > 0 && (
                          <div className="team-story-research-sources">
                            <strong>Sources:</strong>
                            <ul>
                              {parsedResearch.sources.map((url, idx) => (
                                <li key={idx}>
                                  <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="hint">Research data could not be parsed for display, but is stored.</p>
                    )}

                    <button
                      className="research-btn re-research-btn"
                      disabled={researching}
                      onClick={() => researchStory(true)}
                    >
                      {researching ? 'Researching...' : 'Re-research Team'}
                    </button>
                  </div>
                ) : (
                  <button
                    className="research-btn"
                    disabled={researching}
                    onClick={() => researchStory(false)}
                  >
                    {researching ? 'Researching...' : 'Research Team'}
                  </button>
                )}
              </div>

              <div className="team-story-section-block">
                <h4 className="team-story-section-title">Team Story</h4>

                <label className="team-story-label" htmlFor="known-facts">
                  Known facts / source notes (optional)
                </label>
                <textarea
                  id="known-facts"
                  className="team-story-textarea team-story-facts"
                  value={knownFacts}
                  onChange={(e) => setKnownFacts(e.target.value)}
                  placeholder="Free text: important places, nicknames, supporter identity, rivalries, historical moments, achievements, academy identity, notable players, etc. The AI will only use facts written here."
                  rows={6}
                />

                <div className="team-story-generate-row">
                  <button
                    className="generate-btn"
                    disabled={generating || !hasResearch}
                    onClick={generateStory}
                    title={!hasResearch ? 'Research this team first' : undefined}
                  >
                    {generating ? 'Generating...' : 'Generate Team Story'}
                  </button>
                  <span className="hint">
                    {hasResearch
                      ? 'Generates a fresh draft below using the stored research above (and any known facts). Review and edit before saving.'
                      : 'Research this team first - the writing stage uses stored research and does not do its own research.'}
                  </span>
                </div>

                <label className="team-story-label" htmlFor="story-content">
                  Story content
                </label>
                <textarea
                  id="story-content"
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamStoryManagement;
