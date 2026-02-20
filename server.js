require('dotenv').config();

const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3456;
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'default-claude-bridge';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 2000;
const MAX_WAIT_MS = parseInt(process.env.MAX_WAIT_MS) || 300000; // 5 minutes

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Expose configuration to the frontend
app.get('/config', (req, res) => {
    res.json({ ntfyTopic: NTFY_TOPIC });
});

// Centralized commands mapping
const COMMANDS = {
    '#new': {
        script: 'scripts/new_chat.applescript',
        waitMs: 500,
        description: 'Open a new chat'
    }
    // Add future commands here
};

// Track if Claude is currently processing a message
let isProcessing = false;

function processMessage(message) {
    if (isProcessing) {
        return { success: false, reason: 'Claude is already processing a message' };
    }

    isProcessing = true;
    console.log('Received message:', message);

    let textToType = message.trim();
    let matchedCommand = null;

    // Check if message starts with any known command
    for (const [cmd, config] of Object.entries(COMMANDS)) {
        if (textToType.startsWith(cmd)) {
            matchedCommand = config;
            textToType = textToType.substring(cmd.length).trim();
            break;
        }
    }

    const typeMessage = () => {
        if (!textToType) {
            isProcessing = false;
            return;
        }

        // Call AppleScript to type the message
        exec(`osascript scripts/type_message.applescript "${textToType.replace(/"/g, '\\"')}"`, (error) => {
            if (error) {
                console.error('Error typing message:', error);
                isProcessing = false;
                return;
            }

            console.log('Message typed, waiting 2s for Claude to start generating...');

            // Wait 2 seconds for Claude to start generating before polling
            setTimeout(() => {
                const startTime = Date.now();
                let notified = false;

                const pollInterval = setInterval(() => {
                    if (Date.now() - startTime > MAX_WAIT_MS) {
                        console.log('Timeout waiting for Claude.');
                        clearInterval(pollInterval);
                        isProcessing = false;
                        return;
                    }

                    exec('osascript scripts/is_claude_done.applescript', (error, stdout) => {
                        if (!error && stdout.trim() === 'true' && !notified) {
                            notified = true;
                            clearInterval(pollInterval);
                            isProcessing = false;
                            console.log('Claude finished responding.');

                            // Send push notification via ntfy.sh
                            fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
                                method: 'POST',
                                body: 'Claude has responded ✅',
                                headers: {
                                    'Title': 'Claude Bridge'
                                }
                            }).catch(err => console.error('Error sending ntfy notification:', err));
                        }
                    });
                }, POLL_INTERVAL_MS);
            }, 2000);
        });
    };

    if (matchedCommand) {
        console.log(`Executing command: ${matchedCommand.description}...`);
        exec(`osascript ${matchedCommand.script}`, (error) => {
            if (error) {
                console.error(`Error executing command script:`, error);
                isProcessing = false;
                return;
            }
            
            if (textToType) {
                setTimeout(typeMessage, matchedCommand.waitMs || 500); // Wait a bit for UI to render
            } else {
                isProcessing = false;
            }
        });
    } else {
        typeMessage();
    }
    
    return { success: true };
}

// API endpoint to handle sending message
app.post('/send', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const result = processMessage(message);
    if (!result.success) {
        return res.status(429).json({ error: result.reason });
    }

    res.json({ status: 'ok' });
});

const NTFY_INPUT_TOPIC = process.env.NTFY_INPUT_TOPIC;

async function listenToNtfy() {
    if (!NTFY_INPUT_TOPIC) return;
    
    console.log(`Connecting to ntfy input topic: ${NTFY_INPUT_TOPIC}`);
    
    try {
        const response = await fetch(`https://ntfy.sh/${NTFY_INPUT_TOPIC}/sse`);
        
        if (!response.ok) {
            throw new Error(`Unexpected status ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line in the buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.event === 'message' && data.message) {
                            console.log('Received message from ntfy:', data.message);
                            processMessage(data.message);
                        }
                    } catch (e) {
                        console.error('Error parsing ntfy message:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error connecting to ntfy input topic:', error);
    }
    
    // Reconnect after 5 seconds
    console.log('Reconnecting to ntfy in 5 seconds...');
    setTimeout(listenToNtfy, 5000);
}

app.listen(PORT, () => {
    console.log(`Claude Bridge server is running on http://localhost:${PORT}`);
    listenToNtfy();
});
