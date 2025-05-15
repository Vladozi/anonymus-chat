// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public')); // Serve static files from 'public' directory

// In-memory store (NO DATABASE)
let users = new Map(); // Stores user data: { id, username, ws, partnerId }
let waitingUsers = []; // Array of user IDs waiting for a partner

console.log("Anonymous Chat Server Started...");
console.log("WebSocket server listening on the same port as HTTP.");

function broadcastOnlineCount() {
    const onlineCount = users.size;
    const message = JSON.stringify({ type: 'onlineCount', count: onlineCount });
    users.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(message);
        }
    });
}

function tryMatchUsers() {
    while (waitingUsers.length >= 2) {
        const userId1 = waitingUsers.shift();
        const userId2 = waitingUsers.shift();

        const user1 = users.get(userId1);
        const user2 = users.get(userId2);

        // Ensure both users are still connected and available
        if (user1 && user1.ws.readyState === WebSocket.OPEN && !user1.partnerId &&
            user2 && user2.ws.readyState === WebSocket.OPEN && !user2.partnerId) {
            
            user1.partnerId = userId2;
            user2.partnerId = userId1;

            user1.ws.send(JSON.stringify({ type: 'matched', partnerUsername: user2.username }));
            user2.ws.send(JSON.stringify({ type: 'matched', partnerUsername: user1.username }));

            console.log(`Matched ${user1.username} with ${user2.username}`);
        } else {
            // If one user disconnected or was already matched, put the other back if still valid
            if (user1 && user1.ws.readyState === WebSocket.OPEN && !user1.partnerId) waitingUsers.unshift(userId1);
            if (user2 && user2.ws.readyState === WebSocket.OPEN && !user2.partnerId) waitingUsers.unshift(userId2);
            // Re-sort to ensure fairness if one was re-added, though simple unshift is often fine for this scale
        }
    }
    // Notify any remaining waiting users
    waitingUsers.forEach(id => {
        const user = users.get(id);
        if (user && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({ type: 'waiting' }));
        }
    });
}


wss.on('connection', (ws) => {
    const userId = uuidv4();
    console.log(`Client connected: ${userId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                const username = data.username.trim().slice(0, 20) || `Anon-${userId.slice(0,4)}`;
                users.set(userId, { id: userId, username: username, ws: ws, partnerId: null });
                console.log(`User joined: ${username} (${userId})`);
                broadcastOnlineCount();

                ws.send(JSON.stringify({ type: 'joined', yourUsername: username }));
                
                waitingUsers.push(userId);
                tryMatchUsers();
            } else if (data.type === 'message') {
                const sender = users.get(userId);
                if (sender && sender.partnerId) {
                    const recipient = users.get(sender.partnerId);
                    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
                        recipient.ws.send(JSON.stringify({
                            type: 'message',
                            sender: sender.username,
                            text: data.text
                        }));
                    } else {
                        // Partner disconnected mid-chat
                        ws.send(JSON.stringify({ type: 'partnerDisconnected' }));
                        sender.partnerId = null;
                        if (!waitingUsers.includes(userId)) {
                            waitingUsers.push(userId);
                        }
                        tryMatchUsers(); // Try to find a new match for the sender
                    }
                }
            } else if (data.type === 'leaveChat') {
                // User wants to find a new partner
                const user = users.get(userId);
                if (user) {
                    console.log(`${user.username} is leaving their current chat.`);
                    const currentPartnerId = user.partnerId;
                    user.partnerId = null; // Clear current user's partner

                    if (currentPartnerId) {
                        const partner = users.get(currentPartnerId);
                        if (partner) {
                            partner.partnerId = null; // Clear partner's link too
                            partner.ws.send(JSON.stringify({ type: 'partnerLeft' }));
                            if (!waitingUsers.includes(currentPartnerId)) {
                                waitingUsers.push(currentPartnerId);
                            }
                        }
                    }
                    
                    if (!waitingUsers.includes(userId)) {
                        waitingUsers.push(userId);
                    }
                    tryMatchUsers();
                }
            }

        } catch (error) {
            console.error('Failed to process message or invalid JSON:', message, error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${userId}`);
        const user = users.get(userId);
        
        if (user) {
            // Remove from waiting list if present
            waitingUsers = waitingUsers.filter(id => id !== userId);
            
            // Notify partner if in a chat
            if (user.partnerId) {
                const partner = users.get(user.partnerId);
                if (partner) {
                    partner.partnerId = null; // Clear partner's link
                    partner.ws.send(JSON.stringify({ type: 'partnerDisconnected' }));
                    if (!waitingUsers.includes(partner.id)) { // Add partner back to waiting list
                        waitingUsers.push(partner.id);
                    }
                }
            }
            users.delete(userId); // Remove user from active users
            broadcastOnlineCount();
            tryMatchUsers(); // Attempt to match anyone newly waiting
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
        // Basic cleanup, similar to 'close' but less certain about state
        const user = users.get(userId);
        if (user) users.delete(userId);
        waitingUsers = waitingUsers.filter(id => id !== userId);
        broadcastOnlineCount();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});