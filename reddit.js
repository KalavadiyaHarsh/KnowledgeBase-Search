require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

const REDDIT_OAUTH_URL = 'https://www.reddit.com/api/v1/authorize';
const REDDIT_ACCESS_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const userAgent = process.env.REDDIT_USER_AGENT;
const redirectUri = 'http://localhost:8080/callback';

const scope = 'read'; // Permission scope, you can adjust this as per your needs.

// Step 1: Redirect to Reddit authorization
app.get('/auth', (req, res) => {
  const authUrl = `${REDDIT_OAUTH_URL}?client_id=${clientId}&response_type=code&state=xyz&redirect_uri=${redirectUri}&duration=permanent&scope=${scope}`;
  res.redirect(authUrl);
});

// Step 2: Handle Reddit OAuth callback and get refresh token
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  try {
    const response = await axios.post(REDDIT_ACCESS_TOKEN_URL, null, {
      params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      },
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const { refresh_token } = response.data;

    res.send(`Your Reddit Refresh Token: ${refresh_token}`);
    console.log('Refresh Token:', refresh_token);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get token' });
    console.error('Error fetching refresh token:', error.response?.data || error.message);
  }
});

app.listen(8080, () => {
  console.log('App listening on port 8080. Visit http://localhost:8080/auth to get your refresh token.');
});
