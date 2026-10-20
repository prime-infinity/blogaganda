function RawJsonPanel({ data }) {
  return (
    <div className="raw-json-panel">
      <h2>📄 Raw JSON Response</h2>
      {data ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div className="empty-state" style={{ color: '#999' }}>
          <p>No data yet. Make a search or insights request to see the raw JSON response.</p>
        </div>
      )}
    </div>
  );
}

export default RawJsonPanel;
