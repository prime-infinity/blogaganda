import { useState } from 'react';

const API_BASE = 'http://localhost:3001';

const ENTITY_TYPES = [
  { value: 'urn:entity:artist', label: 'Artist' },
  { value: 'urn:entity:movie', label: 'Movie' },
  { value: 'urn:entity:tv_show', label: 'TV Show' },
  { value: 'urn:entity:book', label: 'Book' },
  { value: 'urn:entity:podcast', label: 'Podcast' },
  { value: 'urn:entity:brand', label: 'Brand' },
  { value: 'urn:entity:place', label: 'Place' },
  { value: 'urn:entity:destination', label: 'Destination' },
  { value: 'urn:entity:actor', label: 'Actor' },
  { value: 'urn:entity:album', label: 'Album' },
  { value: 'urn:entity:author', label: 'Author' },
  { value: 'urn:entity:director', label: 'Director' },
  { value: 'urn:entity:person', label: 'Person' },
];

function SearchPanel({ onSelectEntity, onResponse }) {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('urn:entity:movie');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const url = new URL(`${API_BASE}/api/search`);
      url.searchParams.append('query', query);
      url.searchParams.append('types', entityType);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || data.error || `Error: ${response.status}`;
        throw new Error(errorMsg);
      }

      onResponse(data);
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntity = (entity) => {
    const entityId = entity.entity_id;
    const entityType = Array.isArray(entity.types) ? entity.types[0] : entity.types;
    
    console.log('Selected entity:', { entityId, name: entity.name, type: entityType });
    setSelectedId(entityId);
    onSelectEntity({
      id: entityId,
      name: entity.name,
      type: entityType
    });
  };

  return (
    <div className="panel">
      <h2>🔍 Search Entities</h2>
      
      <form onSubmit={handleSearch}>
        <div className="form-group">
          <label htmlFor="search-query">Search Query</label>
          <input
            id="search-query"
            type="text"
            placeholder="e.g., Inception, Taylor Swift"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="entity-type">Entity Type</label>
          <select
            id="entity-type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            {ENTITY_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && <div className="loading">Searching...</div>}

      {results.length > 0 && (
        <div className="results">
          <h3 style={{ marginBottom: '10px', color: '#333' }}>
            Results ({results.length})
          </h3>
          {results.map((entity, idx) => {
            const entityId = entity.entity_id;
            const entityType = Array.isArray(entity.types) ? entity.types[0] : entity.types;
            return (
              <div
                key={entityId || idx}
                className={`result-item ${selectedId === entityId ? 'selected' : ''}`}
                onClick={() => handleSelectEntity(entity)}
              >
                <h3>{entity.name}</h3>
                {entityType && <p><strong>Type:</strong> {entityType}</p>}
                {entity.disambiguation && (
                  <p style={{ fontSize: '0.85rem', color: '#666' }}>
                    ({entity.disambiguation})
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && results.length === 0 && query && (
        <div className="info">
          No results found. Try a different search term.
        </div>
      )}
    </div>
  );
}

export default SearchPanel;
