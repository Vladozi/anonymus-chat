// public/client.js
document.addEventListener('DOMContentLoaded', () => {
    const appDiv = document.getElementById('app');
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

    const emojiButton = document.getElementById('emoji-button');
    const emojiPickerDiv = document.getElementById('emoji-picker');

    let socket;
    let myUsername = '';
    let currentPartnerUsername = '';

    const emojis = [
        '😀', '😁', '😂', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘',
        '😗', '😙', '😚', '🙂', '🤗', '🤔', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
        '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓',
        '😔', '😕', '🙃', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦',
        '😧', '😨', '😩', '😬', '😰', '😱', '😳', '😵', '😡', '😠', '😷', '🤒', '🤕',
        '🤢', '🤧', '😇', '🥳', '🥺', '🥰', '🤩', '🥲', '💀', '👻', '👽', '🤖', '💩', 
        '👍', '👎', '👌', '👋', '🙏', '❤️', '💔', '🎉', '✨', '🔥', '💯', '👀', '🧠', '🤏'
    ];

    function populateEmojiPicker() {
        emojiPickerDiv.innerHTML = ''; // Clear existing emojis
        emojis.forEach(emoji => {
            const emojiSpan = document.createElement('span');
            emojiSpan.classList.add('emoji-item');
            emojiSpan.textContent = emoji;
            emojiSpan.setAttribute('role', 'button'); // Accessibility
            emojiSpan.setAttribute('aria-label', `Emoji ${emoji}`); // Accessibility
            emojiSpan.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent this click from bubbling to document
                messageInput.value += emoji;
                messageInput.focus();
                // Optional: Close picker after selection
                // emojiPickerDiv.classList.add('emoji-picker-hidden');
                // emojiButton.classList.remove('active');
            });
            emojiPickerDiv.appendChild(emojiSpan);
        });
    }


    function updateOnlineCount(count) {
        onlineCountSpan.textContent = count;
        onlineCountChatSpan.textContent = count;
    }

    function addMessageToChat(text, senderUsername, type = 'other') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        if (type === 'own') {
            messageDiv.classList.add('own');
            messageDiv.textContent = text;
        } else if (type === 'system') {
            messageDiv.classList.add('system');
            messageDiv.textContent = text;
        } else {
            messageDiv.classList.add('other');
            messageDiv.textContent = `${senderUsername} : ${text}`;
        }
        chatMessagesDiv.appendChild(messageDiv);

        requestAnimationFrame(() => {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
        });
     
    }
  
    function setChatActiveState(isActive) {
        if (isActive) {
            appDiv.classList.add('chat-active');
            usernameEntryDiv.style.display = 'none';
            chatContainerDiv.style.display = 'flex';
        } else {
            appDiv.classList.remove('chat-active');
            usernameEntryDiv.style.display = 'flex';
            chatContainerDiv.style.display = 'none';
            // Ensure emoji picker is hidden if reverting to username entry
            emojiPickerDiv.classList.add('emoji-picker-hidden');
            emojiButton.classList.remove('active');
        }
    }

    function updateChatControlsState(isChatting) {
        messageInput.disabled = !isChatting;
        sendButton.disabled = !isChatting;
        emojiButton.disabled = !isChatting;
        newPartnerButton.disabled = !isChatting; // Can only find new partner if currently matched or was matched

        if (!isChatting) {
            emojiPickerDiv.classList.add('emoji-picker-hidden');
            emojiButton.classList.remove('active');
        }
    }


    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connected');
            statusMessageP.textContent = 'Connected. Finalizing entry...';
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
                    setChatActiveState(true); 
                    statusMessageP.textContent = 'Waiting for a partner...';
                    updateChatControlsState(false); // Not chatting yet, just waiting
                    currentPartnerUsername = '';
                    break;
                case 'waiting':
                    statusMessageP.textContent = 'Waiting for a partner...';
                    updateChatControlsState(false); // Still waiting
                    currentPartnerUsername = '';
                    break;
                case 'matched':
                    currentPartnerUsername = data.partnerUsername;
                    statusMessageP.textContent = `You are now chatting with ${currentPartnerUsername}!`;
                    updateChatControlsState(true); // Now chatting
                    newPartnerButton.disabled = false; // Explicitly enable
                    messageInput.focus();
                    chatMessagesDiv.innerHTML = ''; 
                    addMessageToChat(`You're connected with ${data.partnerUsername}. Say hi!`, null, 'system');
                    break;
                case 'message':
                    addMessageToChat(data.text, data.sender, 'other');
                    break;
                case 'partnerDisconnected':
                    statusMessageP.textContent = `Your partner (${currentPartnerUsername || 'User'}) disconnected. Looking for a new one...`;
                    addMessageToChat(`${currentPartnerUsername || 'Your partner'} disconnected. Waiting for a new match.`, null, 'system');
                    updateChatControlsState(false); // No longer actively chatting with this partner
                    newPartnerButton.disabled = true; // Can't seek new if already looking by default
                    currentPartnerUsername = '';
                    break;
                case 'partnerLeft':
                    statusMessageP.textContent = `Your partner (${currentPartnerUsername || 'User'}) left. Looking for a new one...`;
                    addMessageToChat(`${currentPartnerUsername || 'Your partner'} left. Waiting for a new match.`, null, 'system');
                    updateChatControlsState(false); // No longer actively chatting
                    newPartnerButton.disabled = true;
                    currentPartnerUsername = '';
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected');
            statusMessageP.textContent = 'Disconnected. Please refresh to rejoin.';
            addMessageToChat('Disconnected from server.', null, 'system');
            updateChatControlsState(false);
            currentPartnerUsername = '';
            // Optional: setChatActiveState(false); // Revert to username screen
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            statusMessageP.textContent = 'Connection error. Please refresh.';
            addMessageToChat('Connection error.', null, 'system');
            updateChatControlsState(false);
            currentPartnerUsername = '';
        };
    }

    joinButton.addEventListener('click', () => {
        connectWebSocket();
    });

    sendButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'message', text: text }));
            addMessageToChat(text, myUsername, 'own');
            messageInput.value = '';
            messageInput.focus();
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
            updateChatControlsState(false); // Not actively chatting while searching
            newPartnerButton.disabled = true; // Disable while actively searching
            currentPartnerUsername = '';
        }
    });
  

    emojiButton.addEventListener('click', (event) => {
        event.stopPropagation(); // CRITICAL: Prevents this click from being caught by the document's listener
        emojiPickerDiv.classList.toggle('emoji-picker-hidden');
        emojiButton.classList.toggle('active');
        // Populate only if opening and picker is currently empty
        if (!emojiPickerDiv.classList.contains('emoji-picker-hidden') && emojiPickerDiv.children.length === 0) {
            populateEmojiPicker();
        }
    });
    
       // Click outside emoji picker to close it
       document.addEventListener('click', function(event) {
        // Only proceed if the picker is actually visible
        if (emojiPickerDiv.classList.contains('emoji-picker-hidden')) {
            return; 
        }

        const isClickInsidePicker = emojiPickerDiv.contains(event.target);
        const isClickOnEmojiButton = emojiButton.contains(event.target);

        if (!isClickInsidePicker && !isClickOnEmojiButton) {
            emojiPickerDiv.classList.add('emoji-picker-hidden');
            emojiButton.classList.remove('active');
        }
    });

    // Initial setup
    setChatActiveState(false); 
    updateOnlineCount(0); 
});