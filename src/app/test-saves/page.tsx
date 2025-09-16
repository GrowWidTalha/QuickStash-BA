"use client"
import { useState } from 'react';

interface APIResponse {
  success: boolean;
  data: any;
  error: string | null;
}

interface Save {
  id: string;
  title?: string;
  url: string;
  excerpt?: string;
  favicon_url?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TestSavesPage() {
  const [url, setUrl] = useState('');
  const [saveId, setSaveId] = useState('');
  const [accessToken, setAccessToken] = useState('YOUR_ACCESS_TOKEN_HERE'); // Replace with a valid access token
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [allSaves, setAllSaves] = useState<Save[]>([]);
  const [loadingParse, setLoadingParse] = useState(false); // New loading state for parsing

  const callApi = async (functionName: string, params: any) => {
    setResponse(null);
    try {
      const res = await fetch('/api/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: process.env.NEXT_PUBLIC_API_KEY, // Ensure you have this set in .env.local
          function: functionName,
          params: { ...params, accessToken },
        }),
      });
      const data = await res.json();
      setResponse(data);
      if (functionName === 'getAllSaves' && data.success) {
        setAllSaves(data.data.saves);
      }
    } catch (error: any) {
      setResponse({ success: false, data: null, error: error.message });
    }
  };

  const handleAddSave = async () => {
    setLoadingParse(true);
    setResponse(null);
    try {
      // First, call the new parse-url API to get metadata
      // const parseRes = await fetch('/api/parse-url', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ url }),
      // });
      // const parseData = await parseRes.json();
      // console.log(parseData)

      // if (!parseData.success) {
      //   setResponse({ success: false, data: null, error: parseData.error || 'Failed to parse URL metadata' });
      //   setLoadingParse(false);
      //   return;
      // }

      // const { title, excerpt, favicon_url, featured_image_url, final_url, isFetchingAllowed } = parseData.data;

      // Then, call the addSave API with the retrieved metadata
      await callApi('addSave', { url: url });
    } catch (error: any) {
      setResponse({ success: false, data: null, error: error.message || 'Error during URL parsing' });
    } finally {
      setLoadingParse(false);
    }
  };

  const handleGetAllSaves = async () => {
    await callApi('getAllSaves', {});
  };

  const handleGetSaveById = async () => {
    await callApi('getSaveById', { id: saveId });
  };

  const handleToggleArchive = async () => {
    await callApi('toggleArchive', { id: saveId });
  };

  const handleDeleteSave = async () => {
    await callApi('deleteSave', { id: saveId });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Saves API Test Page</h1>

      <div className="mb-4">
        <label className="block text-sm font-bold mb-2">Access Token:</label>
        <input
          type="text"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Enter access token"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Add Save</h2>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL"
          />
          <button
            onClick={handleAddSave}
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loadingParse ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={loadingParse}
          >
            {loadingParse ? 'Parsing & Adding...' : 'Add Save'}
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Manage Saves by ID</h2>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2"
            value={saveId}
            onChange={(e) => setSaveId(e.target.value)}
            placeholder="Save ID"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleGetSaveById}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Get By ID
            </button>
            <button
              onClick={handleToggleArchive}
              className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Toggle Archive
            </button>
            <button
              onClick={handleDeleteSave}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Delete Save
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 rounded shadow mb-8">
        <h2 className="text-xl font-semibold mb-2">All Saves</h2>
        <button
          onClick={handleGetAllSaves}
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4"
        >
          Get All Saves
        </button>
        {allSaves.length > 0 ? (
          <ul className="list-disc pl-5">
            {allSaves.map((save) => (
              <li key={save.id} className="mb-2">
                <p className="font-semibold">ID: {save.id}</p>
                <p>Title: {save.title || 'N/A'}</p>
                <p>URL: <a href={save.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{save.url}</a></p>
                <p>Excerpt: {save.excerpt || 'N/A'}</p>
                <p>Favicon: {save.favicon_url || 'N/A'}</p>
                <p>Archived: {save.isArchived ? 'Yes' : 'No'}</p>
                <p>Created At: {new Date(save.createdAt).toLocaleString()}</p>
                <button
                  onClick={() => setSaveId(save.id)}
                  className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 py-1 px-2 rounded mt-1"
                >
                  Use ID
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No saves found. Click "Get All Saves" to fetch them.</p>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">API Response</h2>
        {response ? (
          <pre className="whitespace-pre-wrap break-all text-sm bg-gray-800 text-white p-2 rounded">
            {JSON.stringify(response, null, 2)}
          </pre>
        ) : (
          <p>No response yet.</p>
        )}
      </div>
    </div>
  );
}