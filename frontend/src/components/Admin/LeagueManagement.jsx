// components/Admin/LeagueManagement.jsx
import React, { useState, useEffect } from 'react';
import { 
  getLeagues, 
  updateLeague, 
  bulkUpdateLeagues,
  getCountries,
  getLeagueStats
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [leaguesData, countriesData, statsData] = await Promise.all([
        getLeagues(),
        getCountries(),
        getLeagueStats()
      ]);
      
      setLeagues(leaguesData || []);
      setCountries(countriesData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load league data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLeague = async (leagueId, currentStatus) => {
    try {
      await updateLeague(leagueId, { enabled: !currentStatus });
      setLeagues(leagues.map(l => 
        l.id === leagueId ? { ...l, enabled: !currentStatus } : l
      ));
      showSuccess(`League ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      
      // Update stats
      const newStats = await getLeagueStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to toggle league:', err);
      setError('Failed to update league. Please try again.');
    }
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
      await bulkUpdateLeagues(selectedLeagues, { enabled: enable });
      setLeagues(leagues.map(l => 
        selectedLeagues.includes(l.id) ? { ...l, enabled: enable } : l
      ));
      setSelectedLeagues([]);
      showSuccess(`${selectedLeagues.length} league(s) ${enable ? 'enabled' : 'disabled'}`);
      
      // Update stats
      const newStats = await getLeagueStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to bulk update:', err);
      setError('Failed to bulk update. Please try again.');
    }
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
    const matchesSearch = league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         league.short_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
        <p className="subtitle">Control which leagues and countries are actively monitored</p>
      </div>

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
            Refresh
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
            >
              Enable Selected
            </button>
            <button 
              onClick={() => handleBulkToggle(false)} 
              className="btn-bulk btn-disable"
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
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeagues.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-results">
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
                    <span className={`badge badge-${league.is_cup ? 'cup' : 'league'}`}>
                      {league.is_cup ? 'Cup' : 'League'}
                    </span>
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
                      {league.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleLeague(league.id, league.enabled)}
                      className={`btn-toggle ${league.enabled ? 'btn-disable' : 'btn-enable'}`}
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
          <li><strong>Enabled leagues</strong> will be actively monitored for fixtures, standings, and match data</li>
          <li><strong>Priority</strong> determines the order in which leagues are synced (higher priority = synced first)</li>
          <li><strong>Bulk actions</strong> allow you to enable/disable multiple leagues at once</li>
          <li>Changes take effect immediately for new sync operations</li>
          <li>Disabling a league won't delete existing data, just stop future updates</li>
        </ul>
      </div>
    </div>
  );
};

export default LeagueManagement;
