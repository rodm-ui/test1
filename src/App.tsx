import { useEffect, useState } from 'react';

// Define the blueprint structure for our Database records
interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SystemLogItem {
  id: number;
  user_email: string;
  action: string;
  method: string;
  endpoint: string;
  status_code: number;
  created_at: string;
}

export default function App() {
  // CRITICAL: Arrays are completely empty ([]). No hardcoded mock profiles remain!
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Fetch Users List from Aiven Database
  const fetchDatabaseUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("User synchronizer lost connection:", err);
    }
  };

  // 2. Fetch Live System Logs from Aiven Database
  const fetchLiveLogs = async () => {
    try {
      const response = await fetch('/api/system-logs');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      setError('Real-time database sync connection dropped.');
    }
  };

  useEffect(() => {
    // Fire off both API retrievals immediately on load
    const loadInitialData = async () => {
      await Promise.all([fetchDatabaseUsers(), fetchLiveLogs()]);
      setLoading(false);
    };
    loadInitialData();

    // Polling Interval: Re-query logs from the database every 3 seconds for real-time tracking
    const livePolling = setInterval(fetchLiveLogs, 3000);
    return () => clearInterval(livePolling);
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#666' }}>Connecting to cloud database registry...</div>;
  }

  // Filter users lists dynamically from database state variables on-the-fly
  const admins = users.filter((u) => u.role === 'admin');
  const customers = users.filter((u) => u.role === 'customer');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ color: '#111827', margin: 0 }}>BlooMery Flower Shop Admin Dashboard</h1>
        <p style={{ color: '#6b7280', margin: '5px 0 0' }}>Live Operations & User Access Logs Management Portal</p>
      </header>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>⚠️ {error}</div>}

      {/* ================= SECTION A: USER MANAGEMENT ================= */}
      <section style={{ display: 'flex', gap: '30px', marginBottom: '50px' }}>
        {/* Admins Column */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#991b1b', marginTop: 0, borderBottom: '2px solid #fee2e2', paddingBottom: '8px' }}>Admins ({admins.length})</h3>
          {admins.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>No database records found.</p>
          ) : (
            admins.map((admin) => (
              <div key={admin.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <strong style={{ display: 'block', color: '#111827' }}>{admin.name}</strong>
                <span style={{ color: '#4b5563', fontSize: '13px' }}>{admin.email}</span>
              </div>
            ))
          )}
        </div>

        {/* Customers Column */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#166534', marginTop: 0, borderBottom: '2px solid #dcfce7', paddingBottom: '8px' }}>Customers ({customers.length})</h3>
          {customers.length === 0 ? (
            <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>No database records found.</p>
          ) : (
            customers.map((customer) => (
              <div key={customer.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <strong style={{ display: 'block', color: '#111827' }}>{customer.name}</strong>
                <span style={{ color: '#4b5563', fontSize: '13px' }}>{customer.email}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ================= SECTION B: LIVE SYSTEM LOGS ================= */}
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', fontFamily: 'monospace' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937', fontSize: '18px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>Real-Time Centralized System Operational Logs History</h3>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '10px', color: '#4b5563' }}>Timestamp</th>
              <th style={{ padding: '10px', color: '#4b5563' }}>User Identity Context</th>
              <th style={{ padding: '10px', color: '#4b5563' }}>Method</th>
              <th style={{ padding: '10px', color: '#4b5563' }}>Endpoint Route Location</th>
              <th style={{ padding: '10px', color: '#4b5563' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontStyle: 'italic' }}>
                  No dynamic records detected. The live database log timeline grid is empty.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px', color: '#6b7280' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px', color: '#2563eb', fontWeight: 'bold' }}>{log.user_email}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                      background: log.method === 'POST' ? '#dbeafe' : '#dcfce7',
                      color: log.method === 'POST' ? '#1e40af' : '#166534'
                    }}>{log.method}</span>
                  </td>
                  <td style={{ padding: '10px', color: '#374151' }}>{log.endpoint}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: log.status_code >= 400 ? '#dc2626' : '#166534' }}>{log.status_code}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
