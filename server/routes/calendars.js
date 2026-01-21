const express = require('express');
const { google } = require('googleapis');
const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper to get user's OAuth config for a provider
function getUserOAuthConfig(userId, provider) {
  return db.prepare(
    'SELECT * FROM user_oauth_configs WHERE user_id = ? AND provider = ?'
  ).get(userId, provider);
}

// Helper to create Google OAuth client for a user
function createGoogleOAuth2Client(userId) {
  const config = getUserOAuthConfig(userId, 'google');
  if (!config) return null;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    `${appUrl}/api/calendars/google/callback`
  );
}

// Helper to create Microsoft MSAL client for a user
function createMsalClient(userId) {
  const config = getUserOAuthConfig(userId, 'outlook');
  if (!config) return null;

  return new msal.ConfidentialClientApplication({
    auth: {
      clientId: config.client_id,
      clientSecret: config.client_secret,
      authority: 'https://login.microsoftonline.com/common',
    },
  });
}

// ==================== OAUTH CONFIG MANAGEMENT ====================

// Get user's OAuth configurations
router.get('/oauth-configs', (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT id, provider, client_id, created_at, updated_at
      FROM user_oauth_configs
      WHERE user_id = ?
    `).all(req.user.id);

    // Mask client_id for display (show last 8 chars)
    const maskedConfigs = configs.map(config => ({
      ...config,
      client_id: config.client_id ? '...' + config.client_id.slice(-8) : null,
      is_configured: true,
    }));

    res.json({ configs: maskedConfigs });
  } catch (error) {
    console.error('Get OAuth configs error:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth configurations' });
  }
});

// Save/update OAuth configuration for a provider
router.post('/oauth-configs/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const { client_id, client_secret } = req.body;

    if (!['google', 'outlook'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'Client ID and Client Secret are required' });
    }

    const existing = getUserOAuthConfig(req.user.id, provider);

    if (existing) {
      db.prepare(`
        UPDATE user_oauth_configs
        SET client_id = ?, client_secret = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(client_id, client_secret, existing.id);
    } else {
      db.prepare(`
        INSERT INTO user_oauth_configs (user_id, provider, client_id, client_secret)
        VALUES (?, ?, ?, ?)
      `).run(req.user.id, provider, client_id, client_secret);
    }

    res.json({ message: `${provider} OAuth configuration saved` });
  } catch (error) {
    console.error('Save OAuth config error:', error);
    res.status(500).json({ error: 'Failed to save OAuth configuration' });
  }
});

// Delete OAuth configuration for a provider
router.delete('/oauth-configs/:provider', (req, res) => {
  try {
    const { provider } = req.params;

    if (!['google', 'outlook'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Also delete all connected accounts for this provider
    db.prepare('DELETE FROM calendar_accounts WHERE user_id = ? AND provider = ?')
      .run(req.user.id, provider);

    // Delete the OAuth config
    db.prepare('DELETE FROM user_oauth_configs WHERE user_id = ? AND provider = ?')
      .run(req.user.id, provider);

    // Delete synced events from this provider
    db.prepare(`
      DELETE FROM events
      WHERE user_id = ? AND source = ? AND calendar_account_id IS NOT NULL
    `).run(req.user.id, provider);

    res.json({ message: `${provider} OAuth configuration deleted` });
  } catch (error) {
    console.error('Delete OAuth config error:', error);
    res.status(500).json({ error: 'Failed to delete OAuth configuration' });
  }
});

// ==================== CALENDAR ACCOUNTS ====================

// Get all connected calendar accounts
router.get('/accounts', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, provider, email, enabled, last_synced_at, created_at
      FROM calendar_accounts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json({ accounts });
  } catch (error) {
    console.error('Get calendar accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar accounts' });
  }
});

// Delete a calendar account
router.delete('/accounts/:id', (req, res) => {
  try {
    const account = db.prepare(
      'SELECT * FROM calendar_accounts WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!account) {
      return res.status(404).json({ error: 'Calendar account not found' });
    }

    // Delete synced events from this account
    db.prepare('DELETE FROM events WHERE calendar_account_id = ?').run(account.id);

    // Delete the account
    db.prepare('DELETE FROM calendar_accounts WHERE id = ?').run(account.id);

    res.json({ message: 'Calendar account disconnected' });
  } catch (error) {
    console.error('Delete calendar account error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar account' });
  }
});

// Toggle calendar account enabled/disabled
router.patch('/accounts/:id/toggle', (req, res) => {
  try {
    const account = db.prepare(
      'SELECT * FROM calendar_accounts WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!account) {
      return res.status(404).json({ error: 'Calendar account not found' });
    }

    db.prepare('UPDATE calendar_accounts SET enabled = ? WHERE id = ?')
      .run(account.enabled ? 0 : 1, account.id);

    res.json({ enabled: !account.enabled });
  } catch (error) {
    console.error('Toggle calendar account error:', error);
    res.status(500).json({ error: 'Failed to toggle calendar account' });
  }
});

// ==================== GOOGLE CALENDAR ====================

// Get Google OAuth URL
router.get('/google/auth-url', (req, res) => {
  const oauthClient = createGoogleOAuth2Client(req.user.id);

  if (!oauthClient) {
    return res.status(400).json({
      error: 'Google Calendar not configured. Please add your Google OAuth credentials in the settings first.',
      needs_config: true
    });
  }

  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'consent',
    state: req.user.id.toString(),
  });

  res.json({ authUrl });
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = parseInt(state);

    const oauthClient = createGoogleOAuth2Client(userId);
    if (!oauthClient) {
      return res.redirect('/calendar?error=google_not_configured');
    }

    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Get primary calendar
    const calendar = google.calendar({ version: 'v3', auth: oauthClient });
    const { data: calendarList } = await calendar.calendarList.list();
    const primaryCalendar = calendarList.items.find(cal => cal.primary) || calendarList.items[0];

    // Store or update account
    const existing = db.prepare(
      'SELECT id FROM calendar_accounts WHERE user_id = ? AND provider = ? AND email = ?'
    ).get(userId, 'google', userInfo.email);

    if (existing) {
      db.prepare(`
        UPDATE calendar_accounts
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, calendar_id = ?
        WHERE id = ?
      `).run(
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        primaryCalendar?.id || 'primary',
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO calendar_accounts (user_id, provider, email, access_token, refresh_token, token_expires_at, calendar_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        'google',
        userInfo.email,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        primaryCalendar?.id || 'primary'
      );
    }

    // Redirect to settings page
    res.redirect('/calendar?connected=google');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect('/calendar?error=google_auth_failed');
  }
});

// Sync Google Calendar
router.post('/google/sync/:accountId', async (req, res) => {
  try {
    const account = db.prepare(
      'SELECT * FROM calendar_accounts WHERE id = ? AND user_id = ? AND provider = ?'
    ).get(req.params.accountId, req.user.id, 'google');

    if (!account) {
      return res.status(404).json({ error: 'Google Calendar account not found' });
    }

    const oauthClient = createGoogleOAuth2Client(req.user.id);
    if (!oauthClient) {
      return res.status(400).json({ error: 'Google OAuth not configured' });
    }

    // Refresh token if needed
    oauthClient.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      const { credentials } = await oauthClient.refreshAccessToken();
      db.prepare(`
        UPDATE calendar_accounts SET access_token = ?, token_expires_at = ? WHERE id = ?
      `).run(
        credentials.access_token,
        credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        account.id
      );
      oauthClient.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauthClient });

    // Get events from the last 30 days to next 90 days
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    const { data } = await calendar.events.list({
      calendarId: account.calendar_id || 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });

    let synced = 0;
    for (const event of data.items || []) {
      if (event.status === 'cancelled') continue;

      const startTime = event.start.dateTime || event.start.date;
      const endTime = event.end?.dateTime || event.end?.date || startTime;
      const allDay = !event.start.dateTime;

      const existing = db.prepare(
        'SELECT id FROM events WHERE external_id = ? AND calendar_account_id = ?'
      ).get(event.id, account.id);

      if (existing) {
        db.prepare(`
          UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?
          WHERE id = ?
        `).run(event.summary || 'Untitled', event.description || null, startTime, endTime, allDay ? 1 : 0, existing.id);
      } else {
        db.prepare(`
          INSERT INTO events (user_id, title, description, start_time, end_time, all_day, source, external_id, calendar_account_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user.id,
          event.summary || 'Untitled',
          event.description || null,
          startTime,
          endTime,
          allDay ? 1 : 0,
          'google',
          event.id,
          account.id
        );
      }
      synced++;
    }

    // Update last synced time
    db.prepare('UPDATE calendar_accounts SET last_synced_at = ? WHERE id = ?')
      .run(new Date().toISOString(), account.id);

    res.json({ message: `Synced ${synced} events from Google Calendar` });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    res.status(500).json({ error: 'Failed to sync Google Calendar' });
  }
});

// ==================== OUTLOOK CALENDAR ====================

// Get Microsoft OAuth URL
router.get('/outlook/auth-url', (req, res) => {
  const config = getUserOAuthConfig(req.user.id, 'outlook');

  if (!config) {
    return res.status(400).json({
      error: 'Outlook Calendar not configured. Please add your Microsoft OAuth credentials in the settings first.',
      needs_config: true
    });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/calendars/outlook/callback`;

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${config.client_id}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('offline_access User.Read Calendars.Read')}` +
    `&state=${req.user.id}` +
    `&prompt=consent`;

  res.json({ authUrl });
});

// Microsoft OAuth callback
router.get('/outlook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = parseInt(state);

    const msalClient = createMsalClient(userId);
    if (!msalClient) {
      return res.redirect('/calendar?error=outlook_not_configured');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/calendars/outlook/callback`;

    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: ['offline_access', 'User.Read', 'Calendars.Read'],
      redirectUri,
    });

    // Get user email
    const graphClient = Client.init({
      authProvider: (done) => done(null, tokenResponse.accessToken),
    });
    const user = await graphClient.api('/me').get();

    // Store or update account
    const existing = db.prepare(
      'SELECT id FROM calendar_accounts WHERE user_id = ? AND provider = ? AND email = ?'
    ).get(userId, 'outlook', user.mail || user.userPrincipalName);

    const expiresAt = tokenResponse.expiresOn ? tokenResponse.expiresOn.toISOString() : null;

    if (existing) {
      db.prepare(`
        UPDATE calendar_accounts
        SET access_token = ?, refresh_token = ?, token_expires_at = ?
        WHERE id = ?
      `).run(
        tokenResponse.accessToken,
        tokenResponse.refreshToken || null,
        expiresAt,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO calendar_accounts (user_id, provider, email, access_token, refresh_token, token_expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        'outlook',
        user.mail || user.userPrincipalName,
        tokenResponse.accessToken,
        tokenResponse.refreshToken || null,
        expiresAt
      );
    }

    res.redirect('/calendar?connected=outlook');
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    res.redirect('/calendar?error=outlook_auth_failed');
  }
});

// Sync Outlook Calendar
router.post('/outlook/sync/:accountId', async (req, res) => {
  try {
    const account = db.prepare(
      'SELECT * FROM calendar_accounts WHERE id = ? AND user_id = ? AND provider = ?'
    ).get(req.params.accountId, req.user.id, 'outlook');

    if (!account) {
      return res.status(404).json({ error: 'Outlook Calendar account not found' });
    }

    const msalClient = createMsalClient(req.user.id);
    if (!msalClient) {
      return res.status(400).json({ error: 'Outlook OAuth not configured' });
    }

    let accessToken = account.access_token;

    // Refresh token if needed
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date() && account.refresh_token) {
      try {
        const tokenResponse = await msalClient.acquireTokenByRefreshToken({
          refreshToken: account.refresh_token,
          scopes: ['offline_access', 'User.Read', 'Calendars.Read'],
        });

        accessToken = tokenResponse.accessToken;
        db.prepare(`
          UPDATE calendar_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?
        `).run(
          tokenResponse.accessToken,
          tokenResponse.refreshToken || account.refresh_token,
          tokenResponse.expiresOn ? tokenResponse.expiresOn.toISOString() : null,
          account.id
        );
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return res.status(401).json({ error: 'Please reconnect your Outlook account' });
      }
    }

    const graphClient = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    // Get events from the last 30 days to next 90 days
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    const response = await graphClient
      .api('/me/calendar/events')
      .query({
        $filter: `start/dateTime ge '${timeMin.toISOString()}' and start/dateTime le '${timeMax.toISOString()}'`,
        $top: 500,
        $orderby: 'start/dateTime',
      })
      .get();

    let synced = 0;
    for (const event of response.value || []) {
      if (event.isCancelled) continue;

      const startTime = event.start.dateTime + (event.start.timeZone === 'UTC' ? 'Z' : '');
      const endTime = event.end.dateTime + (event.end.timeZone === 'UTC' ? 'Z' : '');
      const allDay = event.isAllDay;

      const existing = db.prepare(
        'SELECT id FROM events WHERE external_id = ? AND calendar_account_id = ?'
      ).get(event.id, account.id);

      if (existing) {
        db.prepare(`
          UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?, all_day = ?
          WHERE id = ?
        `).run(event.subject || 'Untitled', event.bodyPreview || null, startTime, endTime, allDay ? 1 : 0, existing.id);
      } else {
        db.prepare(`
          INSERT INTO events (user_id, title, description, start_time, end_time, all_day, source, external_id, calendar_account_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user.id,
          event.subject || 'Untitled',
          event.bodyPreview || null,
          startTime,
          endTime,
          allDay ? 1 : 0,
          'outlook',
          event.id,
          account.id
        );
      }
      synced++;
    }

    // Update last synced time
    db.prepare('UPDATE calendar_accounts SET last_synced_at = ? WHERE id = ?')
      .run(new Date().toISOString(), account.id);

    res.json({ message: `Synced ${synced} events from Outlook Calendar` });
  } catch (error) {
    console.error('Outlook Calendar sync error:', error);
    res.status(500).json({ error: 'Failed to sync Outlook Calendar' });
  }
});

// Sync all enabled calendars
router.post('/sync-all', async (req, res) => {
  try {
    const accounts = db.prepare(
      'SELECT * FROM calendar_accounts WHERE user_id = ? AND enabled = 1'
    ).all(req.user.id);

    const results = [];
    for (const account of accounts) {
      try {
        if (account.provider === 'google') {
          const oauthClient = createGoogleOAuth2Client(req.user.id);
          if (!oauthClient) {
            results.push({ provider: 'google', email: account.email, error: 'OAuth not configured' });
            continue;
          }

          oauthClient.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          });

          const calendar = google.calendar({ version: 'v3', auth: oauthClient });
          const timeMin = new Date();
          timeMin.setDate(timeMin.getDate() - 30);
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + 90);

          const { data } = await calendar.events.list({
            calendarId: account.calendar_id || 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            maxResults: 500,
          });

          let synced = 0;
          for (const event of data.items || []) {
            if (event.status === 'cancelled') continue;
            const startTime = event.start.dateTime || event.start.date;
            const endTime = event.end?.dateTime || event.end?.date || startTime;
            const allDay = !event.start.dateTime;

            const existing = db.prepare(
              'SELECT id FROM events WHERE external_id = ? AND calendar_account_id = ?'
            ).get(event.id, account.id);

            if (existing) {
              db.prepare(`UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?, all_day = ? WHERE id = ?`)
                .run(event.summary || 'Untitled', event.description || null, startTime, endTime, allDay ? 1 : 0, existing.id);
            } else {
              db.prepare(`INSERT INTO events (user_id, title, description, start_time, end_time, all_day, source, external_id, calendar_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(req.user.id, event.summary || 'Untitled', event.description || null, startTime, endTime, allDay ? 1 : 0, 'google', event.id, account.id);
            }
            synced++;
          }
          db.prepare('UPDATE calendar_accounts SET last_synced_at = ? WHERE id = ?').run(new Date().toISOString(), account.id);
          results.push({ provider: 'google', email: account.email, synced });
        } else if (account.provider === 'outlook') {
          const msalClient = createMsalClient(req.user.id);
          if (!msalClient) {
            results.push({ provider: 'outlook', email: account.email, error: 'OAuth not configured' });
            continue;
          }

          const graphClient = Client.init({
            authProvider: (done) => done(null, account.access_token),
          });

          const timeMin = new Date();
          timeMin.setDate(timeMin.getDate() - 30);
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + 90);

          const response = await graphClient
            .api('/me/calendar/events')
            .query({
              $filter: `start/dateTime ge '${timeMin.toISOString()}' and start/dateTime le '${timeMax.toISOString()}'`,
              $top: 500,
            })
            .get();

          let synced = 0;
          for (const event of response.value || []) {
            if (event.isCancelled) continue;
            const startTime = event.start.dateTime + (event.start.timeZone === 'UTC' ? 'Z' : '');
            const endTime = event.end.dateTime + (event.end.timeZone === 'UTC' ? 'Z' : '');
            const allDay = event.isAllDay;

            const existing = db.prepare(
              'SELECT id FROM events WHERE external_id = ? AND calendar_account_id = ?'
            ).get(event.id, account.id);

            if (existing) {
              db.prepare(`UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ?, all_day = ? WHERE id = ?`)
                .run(event.subject || 'Untitled', event.bodyPreview || null, startTime, endTime, allDay ? 1 : 0, existing.id);
            } else {
              db.prepare(`INSERT INTO events (user_id, title, description, start_time, end_time, all_day, source, external_id, calendar_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(req.user.id, event.subject || 'Untitled', event.bodyPreview || null, startTime, endTime, allDay ? 1 : 0, 'outlook', event.id, account.id);
            }
            synced++;
          }
          db.prepare('UPDATE calendar_accounts SET last_synced_at = ? WHERE id = ?').run(new Date().toISOString(), account.id);
          results.push({ provider: 'outlook', email: account.email, synced });
        }
      } catch (err) {
        results.push({ provider: account.provider, email: account.email, error: err.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Sync all calendars error:', error);
    res.status(500).json({ error: 'Failed to sync calendars' });
  }
});

module.exports = router;
