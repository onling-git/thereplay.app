// components/Admin/LeagueManagement.jsx
import React, { useState, useEffect } from 'react';
import { 
  getLeagues, 
  updateLeague, 
  bulkUpdateLeagues,
  getCountries,
  getLeagueStats,
  updateCountry,
  refreshCoverageCatalogue,
  getCoverageStatus
} from '../../api/adminApi';
import './LeagueManagement.css';

const LeagueManagement = ({ user }) => {
  const [leagues, setLeagues] = useState([]);
  const [countries, setCountries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('all'); // 'all', 'enabled', 'disabled'
  const [filterCountry, setFilterCountry] = useState('all');
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [coverage, setCoverage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [leaguesData, countriesData, statsData, coverageData] = await Promise.all([
        getLeagues(),
        getCountries(),
        getLeagueStats(),
        getCoverageStatus()
      ]);
      
      setLeagues(leaguesData || []);
      setCountries(countriesData || []);
      setStats(statsData);
      setCoverage(coverageData);
    } catch (err) {
      console.error('Failed to load league data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLeague = async (leagueId, currentStatus) => {
    try {
      setSaving(true);
      await updateLeague(leagueId, { enabled: !currentStatus });
      await loadData();
      showSuccess(`League ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      
      // Update stats
      const newStats = await getLeagueStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to toggle league:', err);
      setError(err.body?.error || 'Failed to update league. Reload before retrying.');
    } finally { setSaving(false); }
  };

  const handleSetting = async (leagueId, settings) => {
    setSaving(true);
    try {
      await updateLeague(leagueId, settings);
      await loadData();
      showSuccess('Coverage settings updated');
    } catch (err) {
      setError(err.body?.error || 'Failed to apply coverage settings. Reload before retrying.');
    } finally { setSaving(false); }
  };

  const handleCountry = async country => {
    setSaving(true);
    try {
      await updateCountry(country.id, { enabled: !country.enabled });
      await loadData();
      showSuccess('Country settings updated');
    } catch (err) {
      setError(err.body?.error || 'Failed to apply country settings. Reload before retrying.');
    } finally { setSaving(false); }
  };

  const handleCatalogueRefresh = async (bootstrap = false) => {
    setSaving(true);
    try {
      await refreshCoverageCatalogue(bootstrap);
      await loadData();
      showSuccess('Sportmonks catalogue and current league membership refreshed');
    } catch (err) {
      setError(err.body?.error || 'Catalogue refresh failed. Existing coverage has not been automatically expanded.');
    } finally { setSaving(false); }
  };

  const handlePriorityChange = async (leagueId, priority) => {
    try {
      await updateLeague(leagueId, { priority: Number(priority) });
      setLeagues(leagues.map(l => 
        l.id === leagueId ? { ...l, priority: Number(priority) } : l
      ));
      showSuccess('Priority updated successfully');
    } catch (err) {
      console.error('Failed to update priority:', err);
      setError('Failed to update priority. Please try again.');
    }
  };

  const handleBulkToggle = async (enable) => {
    if (selectedLeagues.length === 0) {
      setError('Please select at least one league');
      return;
    }

    try {
      setSaving(true);
      await bulkUpdateLeagues(selectedLeagues, { enabled: enable });
      await loadData();
      setSelectedLeagues([]);
      showSuccess(`${selectedLeagues.length} league(s) ${enable ? 'enabled' : 'disabled'}`);
      
      // Update stats
      const newStats = await getLeagueStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to bulk update:', err);
      setError(err.body?.error || 'Failed to bulk update. Reload before retrying.');
    } finally { setSaving(false); }
  };

  const handleSelectLeague = (leagueId) => {
    setSelectedLeagues(prev => 
      prev.includes(leagueId) 
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeagues.length === filteredLeagues.length) {
      setSelectedLeagues([]);
    } else {
      setSelectedLeagues(filteredLeagues.map(l => l.id));
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Filter leagues based on search and filters
  const filteredLeagues = leagues.filter(league => {
    const matchesSearch = (league.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (league.short_code || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEnabled = filterEnabled === 'all' || 
                          (filterEnabled === 'enabled' && league.enabled) ||
                          (filterEnabled === 'disabled' && !league.enabled);
    
    const matchesCountry = filterCountry === 'all' || 
                          league.country_id === Number(filterCountry);
    
    return matchesSearch && matchesEnabled && matchesCountry;
  });

  if (loading) {
    return (
      <div className="league-management">
        <div className="loading">Loading league data...</div>
      </div>
    );
  }

  return (
    <div className="league-management">
      <div className="league-header">
        <h2>League & Country Management</h2>
        <p className="subtitle">Control public clubs, competition coverage and AI reports independently of provider access.</p>
      </div>

      <section className="controls-section" aria-label="Coverage catalogue">
        <p>{coverage?.config?.initialized
          ? `${coverage.coverage?.teamIds?.length || 0} public clubs. New provider competitions require approval.`
          : 'Coverage is not initialized. Public coverage stays closed until the launch setup completes.'}</p>
        <button disabled={saving} onClick={() => handleCatalogueRefresh(false)}>Refresh from Sportmonks</button>
        {!coverage?.config?.initialized && (
          <button disabled={saving} onClick={() => handleCatalogueRefresh(true)}>Initialize five-league launch coverage</button>
        )}
        {saving && <p role="status">Applying coverage and refreshing current-season membership...</p>}
        <p>Last catalogue refresh: {coverage?.config?.last_catalog_refresh_at ? new Date(coverage.config.last_catalog_refresh_at).toLocaleString() : 'Not yet recorded'}</p>
        <p>Last membership sync: {coverage?.config?.last_membership_sync_at ? new Date(coverage.config.last_membership_sync_at).toLocaleString() : 'Not yet recorded'}</p>
      </section>

      <section className="controls-section" aria-label="Country coverage">
        <h3>Domestic country coverage</h3>
        <p>Country switches gate domestic leagues without resetting their settings. Cup and international competition coverage is selected separately below.</p>
        {countries.filter(country => country.leagues_total > 0).map(country => (
          <label key={country.id} style={{ display: 'inline-flex', gap: '0.5rem', margin: '0.5rem' }}>
            <input type="checkbox" checked={!!country.enabled} disabled={saving} onChange={() => handleCountry(country)} />
            {country.name}
          </label>
        ))}
      </section>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)} className="alert-close">×</button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          {successMessage}
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Leagues</h3>
            <div className="stat-value">{stats.leagues.enabled} / {stats.leagues.total}</div>
            <div className="stat-label">Enabled</div>
          </div>
          <div className="stat-card">
            <h3>Countries</h3>
            <div className="stat-value">{stats.countries.enabled} / {stats.countries.total}</div>
            <div className="stat-label">Enabled</div>
          </div>
        </div>
      )}

      <div className="controls-section">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search leagues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={filterEnabled} 
            onChange={(e) => setFilterEnabled(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Leagues</option>
            <option value="enabled">Enabled Only</option>
            <option value="disabled">Disabled Only</option>
          </select>

          <select 
            value={filterCountry} 
            onChange={(e) => setFilterCountry(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Countries</option>
            {countries.map(country => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>

          <button onClick={loadData} className="btn-refresh">
            Reload settings
          </button>
        </div>

        {selectedLeagues.length > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {selectedLeagues.length} league(s) selected
            </span>
            <button 
              onClick={() => handleBulkToggle(true)} 
              className="btn-bulk btn-enable"
              disabled={saving}
            >
              Enable Selected
            </button>
            <button 
              onClick={() => handleBulkToggle(false)} 
              className="btn-bulk btn-disable"
              disabled={saving}
            >
              Disable Selected
            </button>
            <button 
              onClick={() => setSelectedLeagues([])} 
              className="btn-bulk btn-clear"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      <div className="leagues-table-container">
        <table className="leagues-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedLeagues.length === filteredLeagues.length && filteredLeagues.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Logo</th>
              <th>League Name</th>
              <th>Country</th>
              <th>Type</th>
              <th>AI reports</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeagues.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-results">
                  No leagues found matching your criteria
                </td>
              </tr>
            ) : (
              filteredLeagues.map(league => (
                <tr key={league.id} className={league.enabled ? 'league-enabled' : 'league-disabled'}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedLeagues.includes(league.id)}
                      onChange={() => handleSelectLeague(league.id)}
                    />
                  </td>
                  <td>
                    {league.image_path ? (
                      <img 
                        src={league.image_path} 
                        alt={league.name}
                        className="league-logo"
                      />
                    ) : (
                      <div className="league-logo-placeholder">⚽</div>
                    )}
                  </td>
                  <td>
                    <div className="league-name">
                      {league.name}
                      {league.short_code && (
                        <span className="league-code">{league.short_code}</span>
                      )}
                    </div>
                    <div className="league-id">ID: {league.id}</div>
                  </td>
                  <td>
                    {league.country?.name || 'Unknown'}
                    {league.country?.iso2 && (
                      <span className="country-code"> ({league.country.iso2})</span>
                    )}
                  </td>
                  <td>
                    <select aria-label={`Coverage role for ${league.name}`} value={league.coverage_role || 'competition'} disabled={saving}
                      onChange={event => handleSetting(league.id, { coverage_role: event.target.value })}>
                      <option value="league">Domestic league (public clubs)</option>
                      <option value="competition">Competition (supported clubs only)</option>
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" aria-label={`AI reports for ${league.name}`} checked={!!league.reports_enabled}
                      disabled={saving} onChange={event => handleSetting(league.id, { reports_enabled: event.target.checked })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={league.priority || 0}
                      onChange={(e) => handlePriorityChange(league.id, e.target.value)}
                      className="priority-input"
                      min="0"
                      max="100"
                    />
                  </td>
                  <td>
                    <span className={`status-badge ${league.enabled ? 'status-enabled' : 'status-disabled'}`}>
                      {league.effective_status || (league.enabled ? 'Enabled' : 'Disabled')}
                    </span>
                    <div>{league.available ? 'Provider access available' : 'Provider access unconfirmed or unavailable'}</div>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleLeague(league.id, league.enabled)}
                      className={`btn-toggle ${league.enabled ? 'btn-disable' : 'btn-enable'}`}
                      disabled={saving || (!league.enabled && !league.available)}
                    >
                      {league.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="info-section">
        <h3>ℹ️ How It Works</h3>
        <ul>
          <li><strong>Domestic leagues</strong> define public clubs using current-season membership, including clubs based across borders.</li>
          <li><strong>Competitions</strong> cover matches involving those public clubs; other opponents remain opponent-only.</li>
          <li><strong>AI reports</strong> require both public club eligibility and an enabled competition with reports selected. Staging generation stays blocked.</li>
          <li><strong>Priority</strong> determines the order in which leagues are synced (higher priority = synced first)</li>
          <li><strong>Bulk actions</strong> allow you to enable/disable multiple leagues at once</li>
          <li>Changes take effect immediately for new sync operations</li>
          <li>Disabling coverage removes public access and routine collection without deleting stored records. No enabled competitions means no coverage.</li>
        </ul>
      </div>
    </div>
  );
};

export default LeagueManagement;
