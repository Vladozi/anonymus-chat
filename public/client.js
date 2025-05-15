// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    const usernameEntryDiv = document.getElementById('username-entry');
    const chatContainerDiv = document.getElementById('chat-container');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    
    const onlineCountSpan = document.getElementById('online-count');
    const onlineCountChatSpan = document.getElementById('online-count-chat');
    const yourUsernameDisplay = document.getElementById('your-username-display');
    const statusMessageP = document.getElementById('status-message');
    const chatMessagesDiv = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newPartnerButton = document.getElementById('new-partner-button');

    let socket;
    let myUsername = '';

    function updateOnlineCount(count) {
        onlineCountSpan.textContent = count;
        onlineCountChatSpan.textContent = count;
    }

    function addMessageToChat(text, sender, type = 'other') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        if (type === 'own') {
            messageDiv.classList.add('own');
            messageDiv.textContent = `${text}`;
        } else if (type === 'system') {
            messageDiv.classList.add('system');
            messageDiv.textContent = text;
        } else {
            messageDiv.classList.add('other');
            messageDiv.textContent = `${sender}: ${text}`;
        }
        chatMessagesDiv.appendChild(messageDiv);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
    }

    function connectWebSocket() {
        // Determine WebSocket protocol based on current page protocol
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connected');
            statusMessageP.textContent = 'Connected. Sending username...';
            const username = usernameInput.value.trim();
            socket.send(JSON.stringify({ type: 'join', username: username }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received:', data);

            switch (data.type) {
                case 'onlineCount':
                    updateOnlineCount(data.count);
                    break;
                case 'joined':
                    myUsername = data.yourUsername;
                    yourUsernameDisplay.textContent = myUsername;
                    usernameEntryDiv.style.display = 'none';
                    chatContainerDiv.style.display = 'flex';
                    statusMessageP.textContent = 'Waiting for a partner...';
                    break;
                case 'waiting':
                    statusMessageP.textContent = 'Waiting for a partner...';
                    messageInput.disabled = true;
                    sendButton.disabled = true;
                    newPartnerButton.disabled = true;
                    break;
                case 'matched':
                    statusMessageP.textContent = `You are now chatting with ${data.partnerUsername}!`;
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    newPartnerButton.disabled = false;
                    chatMessagesDiv.innerHTML = ''; // Clear previous chat messages
                    addMessageToChat(`You are now chatting with ${data.partnerUsername}. Say hi!`, null, 'system');
                    break;
                case 'message':
                    addMessageToChat(data.text, data.sender, 'other');
                    break;
                case 'partnerDisconnected':
                    statusMessageP.textContent = 'Your partner disconnected. Looking for a new one...';
                    addMessageToChat('Your partner disconnected. Waiting for a new match.', null, 'system');
                    messageInput.disabled = true;
                    sendButton.disabled = true;
                    // newPartnerButton.disabled = true; // Keep enabled or disable as per preference
                    break;
                case 'partnerLeft':
                    statusMessageP.textContent = 'Your partner left the chat. Looking for a new one...';
                    addMessageToChat('Your partner left. Waiting for a new match.', null, 'system');
                    messageInput.disabled = true;
                    sendButton.disabled = true;
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected');
            statusMessageP.textContent = 'Disconnected from server. Please refresh to rejoin.';
            addMessageToChat('Disconnected from server.', null, 'system');
            messageInput.disabled = true;
            sendButton.disabled = true;
            newPartnerButton.disabled = true;
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            statusMessageP.textContent = 'Connection error. Please refresh.';
            addMessageToChat('Connection error.', null, 'system');
            messageInput.disabled = true;
            sendButton.disabled = true;
            newPartnerButton.disabled = true;
        };
    }

    joinButton.addEventListener('click', () => {
        if (usernameInput.value.trim() === "") {
            // User can join without a username, server will assign a default
        }
        connectWebSocket();
    });

    sendButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'message', text: text }));
            addMessageToChat(text, myUsername, 'own');
            messageInput.value = '';
        }
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !sendButton.disabled) {
            sendButton.click();
        }
    });

    newPartnerButton.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'leaveChat' }));
            statusMessageP.textContent = 'Looking for a new partner...';
            addMessageToChat('You chose to find a new partner. Waiting...', null, 'system');
            messageInput.disabled = true;
            sendButton.disabled = true;
            // newPartnerButton.disabled = true; // Disable until matched again
        }
    });
    
    // Initial fetch of online count (or let server push it on connect)
    // For simplicity, we'll rely on the server pushing it after 'join'.
    // If you want it on the username screen before joining, you'd need a
    // separate WebSocket connection just for that, or an HTTP endpoint.
    // For now, we'll just show 0 initially.
    updateOnlineCount(0); 
});