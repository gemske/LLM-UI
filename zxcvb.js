const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const cors = require('cors');
const multer = require('multer');
const https = require('https');

const app = express();
const PORT = 8081;
const HOST = '0.0.0.0';
const OLLAMA_URL = 'http://192.168.1.32:11434';

// In-memory user store (replace with real auth)
const users = {
  chris: 'alien',
  laura: 'aliens',
  rene: 'dabking'
};

// Directories
const CHAT_DIR = path.join(__dirname, 'chats');
if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR);
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer for uploads
defaultUpload = multer({ dest: UPLOAD_DIR });

// RSS parser
const parser = new Parser({
  customFields: {
    feed: ['title','description'],
    item: ['title','link','pubDate','content:encoded','dc:creator']
  }
});

// SSL (adjust paths)
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname,'ssl/server.key')),
  cert: fs.readFileSync(path.join(__dirname,'ssl/server.cert'))
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Endpoints

// 1) Verify login
app.post('/api/verify-login', (req, res) => {
  const { username, password } = req.body;
  res.json({ success: users[username] === password });
});

// 2) RSS Proxy
app.post('/proxy-rss', async (req, res) => {
  try {
    const feed = await parser.parseURL(req.body.url);
    res.json({ title: feed.title, items: feed.items });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch RSS' });
  }
});

// 3) Fetch Ollama models
app.get('/api/models', async (req, res) => {
  try {
    const { data } = await axios.get(`${OLLAMA_URL}/api/tags`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// 4) Chat proxy
app.post('/api/chat', async (req, res) => {
  try {
    const { data } = await axios.post(`${OLLAMA_URL}/api/chat`, {
      model: req.body.model,
      messages: req.body.messages,
      stream: false
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Chat failed' });
  }
});

// 5) Save chat
app.post('/api/save-chat', (req, res) => {
  let name = req.body.filename || `chat_${Date.now()}`;
  if (!name.endsWith('.json')) name += '.json';
  const file = path.join(CHAT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(req.body.messages, null, 2));
  res.json({ filename: name });
});

// 6) List chats
app.get('/api/list-chats', (req, res) => {
  const files = fs.readdirSync(CHAT_DIR).filter(f=>f.endsWith('.json'));
  res.json({ files });
});

// 7) Load chat
app.get('/api/load-chat/:file', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(CHAT_DIR, req.params.file));
    res.json({ messages: JSON.parse(data) });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

// 8) Audio upload (kept from original)
app.post('/upload', defaultUpload.single('audio'), async (req, res) => {
  // original audio processing...
});

// Serve static files and routes
app.use(express.static(__dirname));              // index.html login
app.use('/site', express.static(path.join(__dirname,'site')));  // chat UI
app.get('/', (req, res) => res.sendFile(path.join(__dirname,'index.html')));

// New: DuckDuckGo Instant Answer search endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing query parameter `q`' });

  try {
    const ddg = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q,
        format: 'json',
        no_redirect: 1,
        no_html: 1,
      }
    });

    // Return the raw JSON — client will format as needed
    res.json(ddg.data);
  } catch (err) {
    console.error('DuckDuckGo search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// HTTPS server
https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Server running at https://${HOST}:${PORT}`);
});
