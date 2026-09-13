import { useState } from 'react';
import apiClient from './services/api';

function App() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await apiClient.get('/health/mongo');
      setStatus({ success: true, message: response.data.message });
    } catch (error) {
      setStatus({
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">API Connection Test</h1>
        <button
          onClick={checkConnection}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Test API + MongoDB Connection'}
        </button>

        {status && (
          <p className={`mt-4 font-medium ${status.success ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;