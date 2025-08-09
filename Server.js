// Simple Express server + WebSocket chat backend
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();
const HISTORY_LIMIT = 50;
let history = []; // store last messages

function broadcast(msgObj, excludeWs = null) {
  const payload = JSON.stringify(msgObj);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log('New WS connection. Total clients:', clients.size);

  // Send history to new client
  ws.send(JSON.stringify({ type: 'history', data: history }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.warn('Invalid JSON', e);
      return;
    }

    if (msg.type === 'join') {
      const system = {
        type: 'system',
        text: `${msg.name || 'Someone'} joined the chat`,
        time: Date.now()
      };
      history.push(system);
      if (history.length > HISTORY_LIMIT) history.shift();
      broadcast(system);
    }

    if (msg.type === 'message') {
      const message = {
        type: 'message',
        name: msg.name || 'Anonymous',
        text: msg.text || '',
        time: Date.now()
      };
      history.push(message);
      if (history.length > HISTORY_LIMIT) history.shift();
      broadcast(message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WS closed. Total clients:', clients.size);
    // Optionally broadcast a system leave message (can't know name here)
  });

  ws.on('error', (err) => {
    console.error('WS error', err);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
