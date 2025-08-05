const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const PORT = 8081;
const OLLAMA_URL = 'http://192.168.1.32:11434';

// Set up multer for audio file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize rss-parser
const parser = new Parser({
    customFields: {
        feed: ['title', 'description'],
        item: ['title', 'link', 'pubDate', 'content:encoded', 'dc:creator']
    }
});

app.use(express.json());
app.use(cors());

// Serve static files
app.use('/site', express.static(path.join(__dirname, 'site')));
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// Serve the main voice app HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'speak.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/test', (req, res) => res.send('Test route working'));

// Proxy endpoint to fetch and parse RSS feed
app.post('/proxy-rss', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Invalid or missing URL' });
    try {
        const feed = await parser.parseURL(url);
        res.json({
            title: feed.title,
            description: feed.description,
            items: feed.items.map(item => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                content: item['content:encoded'] || item.content,
                creator: item['dc:creator'] || item.author
            }))
        });
    } catch (error) {
        console.error('RSS parse error:', error.message);
        res.status(500).json({ error: `Failed to parse RSS feed: ${error.message}` });
    }
});

// Get Ollama models
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get(`${OLLAMA_URL}/api/tags`);
        res.json(response.data);
    } catch (error) {
        console.error('Model fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    const { model, messages } = req.body;
    if (!model || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request: model and messages array are required' });

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model,
            messages,
            stream: false
        });
        res.json(response.data);
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

// Save chat history
app.post('/api/save-chat', async (req, res) => {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request: messages array is required' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chat_history_${timestamp}.txt`;
    const filePath = path.join(__dirname, filename);
    const chatContent = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');

    try {
        fs.writeFileSync(filePath, chatContent);
        res.json({ success: true, filename });
    } catch (error) {
        console.error('Save error:', error.message);
        res.status(500).json({ error: 'Failed to save chat history' });
    }
});

// Voice-to-LLM-to-Audio processing
app.post('/upload', upload.single('audio'), async (req, res) => {
    const inputPath = req.file.path;
    const whisperOut = 'output.txt';
    const barkOut = `audio/response_${Date.now()}.wav`;
    const model = req.body.model || 'charlie';

    try {
        // Step 1: Run Whisper
        await execPromise(`python3 whisper.py "${inputPath}" "${whisperOut}"`);

        const userMessage = fs.readFileSync(whisperOut, 'utf-8');

        // Step 2: LLM response
        const chatResponse = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model,
            messages: [{ role: 'user', content: userMessage }],
            stream: false
        });

        const botText = chatResponse.data.message.content;

        // Step 3: Run Bark
        await execPromise(`python3 bark.py "${botText}" "${barkOut}"`);

        res.json({ audioUrl: `/audio/${path.basename(barkOut)}`, transcript: userMessage, response: botText });
    } catch (err) {
        console.error('Voice pipeline error:', err.message);
        res.status(500).json({ error: 'Failed processing voice input' });
    } finally {
        fs.unlinkSync(inputPath);
    }
});

// Helper: promisified exec
function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

app.listen(PORT, '192.168.1.32', () => {
    console.log(`Server running at http://192.168.1.32:${PORT}`);
});
