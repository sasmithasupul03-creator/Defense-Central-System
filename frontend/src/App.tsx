import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [serverStatus, setServerStatus] = useState('Connecting to Defense Central...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('POLICE'); // NEW: Select your rank
  const [isRegistering, setIsRegistering] = useState(false);
  const [token, setToken] = useState('');
  
  const [threats, setThreats] = useState<any[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState('NORMAL'); // NEW: Select threat level
  
  const [isLoading, setIsLoading] = useState(false); 

  useEffect(() => {
    axios.get('http://localhost:3000/api/status')
      .then(() => setServerStatus('Connected. Awaiting operator authentication.'))
      .catch(() => setServerStatus('Error: Backend server unreachable.'));
  }, []);

  useEffect(() => {
    if (token) {
      axios.get('http://localhost:3000/api/threats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setThreats(res.data))
      .catch(err => console.error("Access denied to intel", err));
    }
  }, [token]);

  // Submit New Threat
  const reportThreat = async () => {
    if (!newLocation || !newDesc) return alert("Please fill in Location and Description.");
    
    setIsLoading(true);
    try {
      await axios.post('http://localhost:3000/api/report-threat', { 
        location: newLocation, 
        description: newDesc, 
        severity: newSeverity // NEW: Sends the chosen severity
      });
      setNewLocation(''); setNewDesc('');
      const res = await axios.get('http://localhost:3000/api/threats', { headers: { Authorization: `Bearer ${token}` } });
      setThreats(res.data);
    } catch (err) {
      alert("Failed to report threat.");
    } finally {
      setIsLoading(false);
    }
  };

  const resolveThreat = async (id: string) => {
    setIsLoading(true);
    try {
      await axios.patch(`http://localhost:3000/api/threats/${id}`, { status: 'RESOLVED' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setThreats(threats.map(t => t._id === id ? { ...t, status: 'RESOLVED' } : t));
    } catch (err) {
      alert("Failed to update status.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThreat = async (id: string) => {
    setIsLoading(true);
    try {
      await axios.delete(`http://localhost:3000/api/threats/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setThreats(threats.filter(t => t._id !== id));
    } catch (err) {
      alert("Failed to delete threat.");
    } finally {
      setIsLoading(false);
    }
  };

  // Authentication Logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    try {
      // NEW: Sends the role you selected from the dropdown
      const response = await axios.post(`http://localhost:3000${endpoint}`, { username, password, role: role });
      if (isRegistering) {
        setServerStatus(`Operator [${role}] registered successfully. Please log in.`);
        setIsRegistering(false);
        setPassword('');
      } else {
        setToken(response.data.token);
        setServerStatus(`ACCESS GRANTED. Welcome, ${username} (${role}).`);
      }
    } catch (error: any) {
      setServerStatus(error.response?.data?.error || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (token) {
    return (
      <div style={{ textAlign: 'center', marginTop: '20px', color: '#4ade80', fontFamily: 'monospace' }}>
        <h1>Defense Central: Command Center</h1>
        <p>Current Clearance Level: <strong>{role}</strong></p>
        
        <div style={{ background: '#1e293b', padding: '20px', margin: '20px auto', width: '80%', border: '1px solid #3b82f6' }}>
            <h3>Report New Threat</h3>
            <input placeholder="Location" value={newLocation} onChange={e => setNewLocation(e.target.value)} style={{marginRight: '10px', padding: '5px'}} disabled={isLoading} />
            <input placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{marginRight: '10px', padding: '5px'}} disabled={isLoading} />
            
            {/* NEW: Severity Dropdown */}
            <select value={newSeverity} onChange={e => setNewSeverity(e.target.value)} style={{marginRight: '10px', padding: '5px'}} disabled={isLoading}>
              <option value="NORMAL">NORMAL (Police)</option>
              <option value="HIGH">HIGH (Military)</option>
              <option value="CRITICAL">CRITICAL (President)</option>
            </select>

            <button onClick={reportThreat} disabled={isLoading} style={{ cursor: isLoading ? 'not-allowed' : 'pointer', backgroundColor: isLoading ? '#64748b' : '#3b82f6', color: 'white', border: 'none', padding: '5px 10px' }}>
              {isLoading ? 'PROCESSING...' : 'SUBMIT INTEL'}
            </button>
        </div>

        <h3>Live Intel Feed</h3>
        <div style={{ width: '80%', margin: '0 auto', textAlign: 'left' }}>
          {threats.map((t: any) => (
            <div key={t._id} style={{ border: '1px solid #4ade80', padding: '15px', margin: '15px 0', backgroundColor: '#064e3b', opacity: isLoading ? 0.7 : 1 }}>
              <strong>LOCATION:</strong> {t.location} <br />
              <strong>DESCRIPTION:</strong> {t.description} <br />
              <strong>SEVERITY:</strong> <span style={{ color: t.severity === 'CRITICAL' ? '#ef4444' : '#fbbf24' }}>{t.severity}</span> <br />
              <strong>STATUS:</strong> {t.status} <br />
              
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                {t.status !== 'RESOLVED' && (
                  <button onClick={() => resolveThreat(t._id)} disabled={isLoading} style={{ padding: '8px 12px', backgroundColor: isLoading ? '#64748b' : '#3b82f6', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                    {isLoading ? 'WORKING...' : 'MARK AS RESOLVED'}
                  </button>
                )}
                <button onClick={() => deleteThreat(t._id)} disabled={isLoading} style={{ padding: '8px 12px', backgroundColor: isLoading ? '#64748b' : '#ef4444', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {isLoading ? 'DELETING...' : 'DELETE RECORD'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'monospace' }}>
      <h1>Defense Central Terminal</h1>
      <p style={{ color: serverStatus.includes('Error') ? '#f87171' : '#60a5fa' }}>Status: {serverStatus}</p>
      <form onSubmit={handleSubmit} style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <input type="text" placeholder="Operator Callsign" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px', width: '250px' }} required disabled={isLoading} />
        <input type="password" placeholder="Secure Passcode" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', width: '250px' }} required disabled={isLoading} />
        
        {/* NEW: Role Dropdown for Login */}
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '10px', width: '275px' }} disabled={isLoading}>
          <option value="POLICE">Civilian Police</option>
          <option value="MILITARY">Armed Forces</option>
          <option value="PRESIDENT">Presidential Command</option>
        </select>

        <button type="submit" disabled={isLoading} style={{ padding: '10px 20px', cursor: isLoading ? 'not-allowed' : 'pointer', backgroundColor: isLoading ? '#64748b' : '#3b82f6', color: 'white', border: 'none' }}>
          {isLoading ? 'AUTHENTICATING...' : (isRegistering ? 'INITIALIZE NEW OPERATOR' : 'AUTHENTICATE')}
        </button>
      </form>
      <button type="button" onClick={() => setIsRegistering(!isRegistering)} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}>
          {isRegistering ? 'Already have clearance? Log in.' : 'Need clearance? Register here.'}
        </button>
    </div>
  );
}

export default App;