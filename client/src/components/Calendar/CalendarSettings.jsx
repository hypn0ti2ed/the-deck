import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { calendarsAPI } from '../../services/api';

function CalendarSettings({ onClose, onSync }) {
  const [accounts, setAccounts] = useState([]);
  const [oauthConfigs, setOauthConfigs] = useState({ google: null, outlook: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({});
  const [activeTab, setActiveTab] = useState('calendars'); // 'calendars' or 'setup'
  const [showConfigForm, setShowConfigForm] = useState(null); // 'google' or 'outlook'
  const [configForm, setConfigForm] = useState({ client_id: '', client_secret: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsRes, configsRes] = await Promise.all([
        calendarsAPI.getAccounts(),
        calendarsAPI.getOAuthConfigs(),
      ]);
      setAccounts(accountsRes.data.accounts);

      // Convert configs array to object keyed by provider
      const configsObj = { google: null, outlook: null };
      configsRes.data.configs.forEach(c => {
        configsObj[c.provider] = c;
      });
      setOauthConfigs(configsObj);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveOAuthConfig = async (provider) => {
    if (!configForm.client_id || !configForm.client_secret) {
      alert('Please fill in both Client ID and Client Secret');
      return;
    }

    setSaving(true);
    try {
      await calendarsAPI.saveOAuthConfig(provider, configForm);
      await loadData();
      setShowConfigForm(null);
      setConfigForm({ client_id: '', client_secret: '' });
    } catch (error) {
      console.error('Failed to save OAuth config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const deleteOAuthConfig = async (provider) => {
    if (!confirm(`Are you sure you want to remove your ${provider} configuration? This will also disconnect all ${provider} calendars.`)) {
      return;
    }

    try {
      await calendarsAPI.deleteOAuthConfig(provider);
      await loadData();
      onSync();
    } catch (error) {
      console.error('Failed to delete OAuth config:', error);
    }
  };

  const connectGoogle = async () => {
    try {
      const res = await calendarsAPI.getGoogleAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (error) {
      if (error.response?.data?.needs_config) {
        setActiveTab('setup');
        setShowConfigForm('google');
      } else {
        console.error('Failed to get Google auth URL:', error);
        alert(error.response?.data?.error || 'Failed to connect to Google');
      }
    }
  };

  const connectOutlook = async () => {
    try {
      const res = await calendarsAPI.getOutlookAuthUrl();
      window.location.href = res.data.authUrl;
    } catch (error) {
      if (error.response?.data?.needs_config) {
        setActiveTab('setup');
        setShowConfigForm('outlook');
      } else {
        console.error('Failed to get Outlook auth URL:', error);
        alert(error.response?.data?.error || 'Failed to connect to Outlook');
      }
    }
  };

  const syncAccount = async (account) => {
    setSyncing({ ...syncing, [account.id]: true });
    try {
      if (account.provider === 'google') {
        await calendarsAPI.syncGoogle(account.id);
      } else {
        await calendarsAPI.syncOutlook(account.id);
      }
      await loadData();
      onSync();
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Failed to sync calendar. You may need to reconnect your account.');
    } finally {
      setSyncing({ ...syncing, [account.id]: false });
    }
  };

  const disconnectAccount = async (id) => {
    if (!confirm('Are you sure you want to disconnect this calendar? All synced events will be removed.')) {
      return;
    }
    try {
      await calendarsAPI.deleteAccount(id);
      await loadData();
      onSync();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const toggleAccount = async (id) => {
    try {
      await calendarsAPI.toggleAccount(id);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle account:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Calendar Sync Settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('calendars')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'calendars'
                  ? 'text-deck-600 border-b-2 border-deck-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Connected Calendars
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'setup'
                  ? 'text-deck-600 border-b-2 border-deck-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              OAuth Setup
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-deck-500"></div>
            </div>
          ) : activeTab === 'calendars' ? (
            <>
              {/* Connect New Calendar */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Connect a Calendar</h3>
                <div className="flex gap-3">
                  <button
                    onClick={connectGoogle}
                    disabled={!oauthConfigs.google}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg transition-colors ${
                      oauthConfigs.google ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium">Google</span>
                  </button>
                  <button
                    onClick={connectOutlook}
                    disabled={!oauthConfigs.outlook}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg transition-colors ${
                      oauthConfigs.outlook ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#0078D4" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.5H6.5v-11h4.25v11zm7.25 0h-4.25v-11H18v11z"/>
                    </svg>
                    <span className="font-medium">Outlook</span>
                  </button>
                </div>
                {(!oauthConfigs.google || !oauthConfigs.outlook) && (
                  <p className="text-xs text-amber-600 mt-2">
                    Some providers need OAuth setup first.{' '}
                    <button
                      onClick={() => setActiveTab('setup')}
                      className="underline hover:no-underline"
                    >
                      Go to OAuth Setup
                    </button>
                  </p>
                )}
              </div>

              {/* Connected Accounts */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Connected Calendars</h3>
                {accounts.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center">
                    No calendars connected yet. Set up OAuth credentials in the "OAuth Setup" tab, then connect your calendars above.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {accounts.map((account) => (
                      <li key={account.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              account.provider === 'google' ? 'bg-red-100' : 'bg-blue-100'
                            }`}>
                              {account.provider === 'google' ? (
                                <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{account.email}</p>
                              <p className="text-xs text-gray-500 capitalize">{account.provider}</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={account.enabled}
                              onChange={() => toggleAccount(account.id)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-deck-500"></div>
                          </label>
                        </div>

                        {account.last_synced_at && (
                          <p className="text-xs text-gray-400 mt-2">
                            Last synced: {format(parseISO(account.last_synced_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => syncAccount(account)}
                            disabled={syncing[account.id]}
                            className="flex-1 px-3 py-1.5 text-sm bg-deck-50 text-deck-700 rounded hover:bg-deck-100 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {syncing[account.id] ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-deck-700"></div>
                                Syncing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Sync Now
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => disconnectAccount(account.id)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                          >
                            Disconnect
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            /* OAuth Setup Tab */
            <div className="space-y-6">
              <p className="text-sm text-gray-600 mb-4">
                To sync external calendars, you need to create OAuth apps and enter your credentials below.
                Each user can configure their own credentials.
              </p>

              {/* Google OAuth Config */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <h4 className="font-medium text-gray-900">Google Calendar</h4>
                  </div>
                  {oauthConfigs.google ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Configured</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Not configured</span>
                  )}
                </div>

                {oauthConfigs.google && !showConfigForm ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Client ID: {oauthConfigs.google.client_id}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowConfigForm('google');
                          setConfigForm({ client_id: '', client_secret: '' });
                        }}
                        className="text-sm text-deck-600 hover:underline"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => deleteOAuthConfig('google')}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : showConfigForm === 'google' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Client ID</label>
                      <input
                        type="text"
                        value={configForm.client_id}
                        onChange={(e) => setConfigForm({ ...configForm, client_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-deck-500 focus:border-deck-500"
                        placeholder="xxxxxxxx.apps.googleusercontent.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={configForm.client_secret}
                        onChange={(e) => setConfigForm({ ...configForm, client_secret: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-deck-500 focus:border-deck-500"
                        placeholder="GOCSPX-xxxxxxxxxx"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveOAuthConfig('google')}
                        disabled={saving}
                        className="px-4 py-2 bg-deck-600 text-white text-sm rounded-lg hover:bg-deck-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowConfigForm(null);
                          setConfigForm({ client_id: '', client_secret: '' });
                        }}
                        className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Create credentials at{' '}
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-deck-600 hover:underline"
                      >
                        Google Cloud Console
                      </a>
                      . Set redirect URI to: <code className="bg-gray-100 px-1 rounded">{window.location.origin}/api/calendars/google/callback</code>
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowConfigForm('google');
                      setConfigForm({ client_id: '', client_secret: '' });
                    }}
                    className="text-sm text-deck-600 hover:underline"
                  >
                    Add Google credentials
                  </button>
                )}
              </div>

              {/* Outlook OAuth Config */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#0078D4" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.5H6.5v-11h4.25v11zm7.25 0h-4.25v-11H18v11z"/>
                    </svg>
                    <h4 className="font-medium text-gray-900">Microsoft Outlook</h4>
                  </div>
                  {oauthConfigs.outlook ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Configured</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Not configured</span>
                  )}
                </div>

                {oauthConfigs.outlook && showConfigForm !== 'outlook' ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Client ID: {oauthConfigs.outlook.client_id}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowConfigForm('outlook');
                          setConfigForm({ client_id: '', client_secret: '' });
                        }}
                        className="text-sm text-deck-600 hover:underline"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => deleteOAuthConfig('outlook')}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : showConfigForm === 'outlook' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Application (Client) ID</label>
                      <input
                        type="text"
                        value={configForm.client_id}
                        onChange={(e) => setConfigForm({ ...configForm, client_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-deck-500 focus:border-deck-500"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={configForm.client_secret}
                        onChange={(e) => setConfigForm({ ...configForm, client_secret: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-deck-500 focus:border-deck-500"
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveOAuthConfig('outlook')}
                        disabled={saving}
                        className="px-4 py-2 bg-deck-600 text-white text-sm rounded-lg hover:bg-deck-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowConfigForm(null);
                          setConfigForm({ client_id: '', client_secret: '' });
                        }}
                        className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Register app at{' '}
                      <a
                        href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-deck-600 hover:underline"
                      >
                        Azure Portal
                      </a>
                      . Set redirect URI to: <code className="bg-gray-100 px-1 rounded">{window.location.origin}/api/calendars/outlook/callback</code>
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowConfigForm('outlook');
                      setConfigForm({ client_id: '', client_secret: '' });
                    }}
                    className="text-sm text-deck-600 hover:underline"
                  >
                    Add Outlook credentials
                  </button>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">How to set up OAuth apps</h4>
                <div className="text-xs text-blue-700 space-y-2">
                  <p><strong>Google Calendar:</strong></p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Go to Google Cloud Console and create a project</li>
                    <li>Enable the Google Calendar API</li>
                    <li>Create OAuth 2.0 credentials (Web application)</li>
                    <li>Add the redirect URI shown above</li>
                    <li>Copy the Client ID and Client Secret here</li>
                  </ol>
                  <p className="mt-3"><strong>Microsoft Outlook:</strong></p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Go to Azure Portal and register a new application</li>
                    <li>Add Web platform with the redirect URI shown above</li>
                    <li>Create a client secret under "Certificates & secrets"</li>
                    <li>Add API permissions: Calendars.Read and User.Read</li>
                    <li>Copy the Application ID and Client Secret here</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarSettings;
