import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001';

const FILTER_TYPES = [
  { value: 'urn:entity:artist', label: 'Artist' },
  { value: 'urn:entity:movie', label: 'Movie' },
  { value: 'urn:entity:tv_show', label: 'TV Show' },
  { value: 'urn:entity:book', label: 'Book' },
  { value: 'urn:entity:podcast', label: 'Podcast' },
  { value: 'urn:entity:brand', label: 'Brand' },
  { value: 'urn:entity:place', label: 'Place' },
  { value: 'urn:entity:destination', label: 'Destination' },
];

function InsightsPanel({ selectedEntity, onResponse }) {
  const [filterType, setFilterType] = useState('urn:entity:movie');
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = async () => {
    if (!selectedEntity) {
      setError('Please select an entity from the search panel first');
      return;
    }

    console.log('Fetching insights with:', {
      filterType,
      entityId: selectedEntity.id,
      entityName: selectedEntity.name,
      entityType: selectedEntity.type
    });

    setLoading(true);
    setError(null);
    setInsights([]);

    try {
      // Check if entity type matches filter type for better UX
      const selectedEntityType = selectedEntity.type?.replace('urn:entity:', '');
      const requestedFilterType = filterType.replace('urn:entity:', '');
      
      const url = new URL(`${API_BASE}/api/insights`);
      url.searchParams.append('filter.type', filterType);
      url.searchParams.append('signal.interests.entities', selectedEntity.id);
      
      // Add a limit to get reasonable results
      url.searchParams.append('limit', '20');

      console.log('Request URL:', url.toString());

      const response = await fetch(url.toString());
      const data = await response.json();

      console.log('Insights response:', data);

      if (!response.ok) {
        // Check if it's the invalid entity error
        if (data.errors && data.errors.some(e => e.path === 'signal.interests.entities')) {
          throw new Error(
            `Cannot get ${requestedFilterType} recommendations based on a ${selectedEntityType} entity.\n\n` +
            `Tip: Search for and select a ${requestedFilterType} instead, or change "Get Recommendations For" to match your selected entity type.`
          );
        }
        const errorMsg = data.error?.message || data.errors?.[0]?.message || data.error || `Error: ${response.status}`;
        throw new Error(errorMsg);
      }

      onResponse(data);
      
      if (data.results && data.results.entities) {
        setInsights(data.results.entities);
      } else {
        setInsights([]);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('Insights error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>💡 Insights & Recommendations</h2>

      {selectedEntity && (
        <div className="info" style={{ marginBottom: '15px' }}>
          <strong>Selected Entity:</strong> {selectedEntity.name}
          <br />
          <small>{selectedEntity.id}</small>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="filter-type">Get Recommendations For:</label>
        <select
          id="filter-type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {FILTER_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <button 
        className="btn" 
        onClick={fetchInsights}
        disabled={loading || !selectedEntity}
      >
        {loading ? 'Loading...' : 'Get Insights'}
      </button>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && <div className="loading">Fetching insights...</div>}

      {insights.length > 0 && (
        <div className="results">
          <h3 style={{ marginBottom: '10px', color: '#333' }}>
            Recommended {insights.length} {filterType.split(':').pop()}(s)
          </h3>
          {insights.map((entity, idx) => (
            <div key={entity.entity_id || idx} className="card">
              {entity.properties?.image?.url && (
                <img 
                  src={entity.properties.image.url} 
                  alt={entity.name}
                  className="card-image"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <h3>{entity.name}</h3>
              <p>Type: {entity.subtype || entity.type}</p>
              {entity.properties?.description && (
                <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  {entity.properties.description.substring(0, 150)}
                  {entity.properties.description.length > 150 ? '...' : ''}
                </p>
              )}
              {entity.popularity && (
                <p style={{ marginTop: '5px', color: '#667eea', fontWeight: '500' }}>
                  Popularity: {(entity.popularity * 100).toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && insights.length === 0 && !selectedEntity && (
        <div className="empty-state">
          <p>Select an entity from search to get insights</p>
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;
