const { io } = require('socket.io-client');

// ✅ Connect to your namespace `/chat`
const socket = io('http://localhost:3000/chat', {
  transports: ['websocket'], // force WebSocket
  extraHeaders: {
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXIxMjNAZXhhbXBsZS5jb20iLCJzdWIiOiJiODdhMDgyNi0zZmRiLTRmMzYtYmNlZS1iNGM5ZWIzNWY3NDgiLCJpYXQiOjE3NjQ2NjA4Nzd9.dbr85dZgi3XUsaV2q2P0zy8i1W8CMT9ONTjzfoWUvAQ`,
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  reconnectionDelayMax: 5000,
});

// ===== CONNECTION EVENTS =====
socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);

  // Example: auto-join a chat room
  const chatId = 'be19162d-2fa3-4c07-ad96-cf972a1bc6e5'; // replace with actual chat ID
  socket.emit('join', { chatId });
});

socket.on('member:joined', (data) => {
  console.log('Member joined:', data);
  // data: { chatId, userId, userEmail, timestamp, message }
});

socket.on('messages:all-read', (data) => {
  console.log('All messages read:', data);
  // data: { chatId, userId, userEmail, timestamp, message }
});

socket.on('chat:created', (data) => {
  console.log('chat:created:', data);
  // data: { chatId, userId, userEmail, timestamp, message }
});

socket.on('member:left', (data) => {
  console.log('Member left:', data);
  // data: { chatId, userId, userEmail, timestamp, message }
});

socket.on('user:online', (data) => {
  console.log('User online:', data);
  // data: { chatId, userId, userEmail, timestamp, message }
});

socket.on('user:offline', (data) => {
  console.log('User offline:', data);
  // data: { chatId, userId, timestamp, message }
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);

  // Handle different disconnect reasons
  if (reason === 'io server disconnect') {
    // Server disconnected the socket, reconnect manually
    console.log('Server disconnected. Attempting to reconnect...');
    socket.connect();
  } else if (reason === 'io client disconnect') {
    // Client disconnected manually, don't reconnect
    console.log('Client disconnected manually');
  } else {
    // Network error, will auto-reconnect
    console.log('Network error. Will attempt to reconnect...');
  }
});

socket.on('connect_error', (error) => {
  console.error('⚠️ Connection error:', error.message);
  console.error('Error details:', error);

  // Handle specific connection errors
  if (error.message.includes('Authentication')) {
    console.error('❌ Authentication failed. Please check your token.');
  } else if (error.message.includes('timeout')) {
    console.error('❌ Connection timeout. Check your network connection.');
  } else {
    console.error('❌ Connection failed:', error.message);
  }
});

socket.on('message:read-status-changed', (data) => {
  console.log('Read status changes:', data);
});

// ===== MESSAGING =====
// Send a message with error handling
function sendMessage(chatId, content) {
  // Check if socket is connected before sending
  if (!socket || !socket.connected) {
    console.error('❌ Cannot send message: Not connected to server');
    return false;
  }

  try {
    socket.emit('message:send', {
      chatId,
      content,
      type: 'TEXT',
    });
    console.log('📤 Message sent to server');
    return true;
  } catch (error) {
    console.error('❌ Failed to emit message:', error);
    return false;
  }
}

// sendMessage(
//   'c2e8b52a-d1b8-4d16-a7c9-4aa5bbf28575',
//   'Hello, this is a test message!'
// );

// Listen for new messages
socket.on('message:new', (message) => {
  console.log('📩 New message received:', message);
});

// Acknowledgement that server saved the message
socket.on('message:ack', (message) => {
  console.log('✅ Message acknowledged:', message);
});

// ===== TYPING INDICATORS =====
function setTyping(chatId, isTyping) {
  if (!socket || !socket.connected) {
    console.error('❌ Cannot set typing status: Not connected');
    return false;
  }

  try {
    socket.emit('message:typing', { chatId, typing: isTyping });
    return true;
  } catch (error) {
    console.error('❌ Failed to set typing status:', error);
    return false;
  }
}

socket.on('message:typing', (data) => {
  console.log('✍️ Typing status:', data);
});

// ===== READ RECEIPTS =====
function markMessageRead(chatId, messageId) {
  if (!socket || !socket.connected) {
    console.error('❌ Cannot mark message as read: Not connected');
    return false;
  }

  try {
    socket.emit('message:read', { chatId, messageId });
    return true;
  } catch (error) {
    console.error('❌ Failed to mark message as read:', error);
    return false;
  }
}

socket.on('message:read', (data) => {
  console.log('👁️ Message read:', data);
});

// ===== COMPREHENSIVE ERROR HANDLING =====
socket.on('error', (errorData) => {
  // errorData structure: { message: string, details?: string }
  console.error('❌ Server error received:', errorData);

  const { message, details } = errorData;

  // Log full error details
  console.error('Error message:', message);
  if (details) {
    console.error('Error details:', details);
  }

  // Handle specific error types
  if (message.includes('Not a member')) {
    console.error('⚠️ Permission error: You are not a member of this chat');
    // Show user-friendly message
    showUserError(
      'You are not authorized to perform this action in this chat.',
    );
  } else if (message.includes('Message must have content')) {
    console.error('⚠️ Validation error: Message content is required');
    showUserError('Please enter a message or attach an image.');
  } else if (message.includes('Too many images')) {
    console.error('⚠️ Validation error: Image limit exceeded');
    showUserError('Maximum 10 images allowed per message.');
  } else if (message.includes('Could not send message')) {
    console.error('⚠️ Message send failure');
    showUserError('Failed to send message. Please try again.');
  } else if (message.includes('Failed to send')) {
    console.error('⚠️ Transmission error:', message);
    showUserError(
      'Message delivery failed. Your message may not have been received.',
    );
  } else {
    // Generic error handling
    console.error('⚠️ Unknown error:', message);
    showUserError(message || 'An unexpected error occurred');
  }
});

// Helper function to show errors to user (implement based on your UI framework)
function showUserError(message) {
  // Example implementations:

  // For console/CLI:
  console.error('💬 User Error:', message);

  // For browser alert:
  // alert(`Error: ${message}`);

  // For React/Vue/Angular:
  // setError(message);
  // or
  // this.errorMessage = message;

  // For toast notification:
  // toast.error(message);
}

// ===== RECONNECTION HANDLING =====
socket.on('reconnect', (attemptNumber) => {
  console.log('✅ Reconnected after', attemptNumber, 'attempts');
  // Rejoin chat rooms if needed
  const chatId = 'be19162d-2fa3-4c07-ad96-cf972a1bc6e5';
  socket.emit('join', { chatId });
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Reconnection attempt', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Reconnection error:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('❌ Reconnection failed after all attempts');
  showUserError('Failed to reconnect to chat server. Please refresh the page.');
});

// ===== UTILITY FUNCTIONS =====

// Check connection status
function isConnected() {
  return socket && socket.connected;
}

// Get connection status
function getConnectionStatus() {
  if (!socket) return 'not_initialized';
  if (socket.connected) return 'connected';
  if (socket.disconnected) return 'disconnected';
  return 'connecting';
}

// Graceful disconnect
function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    console.log('Disconnected from server');
  }
}

// Export for use in other modules (if using modules)
// module.exports = {
//   socket,
//   sendMessage,
//   setTyping,
//   markMessageRead,
//   isConnected,
//   getConnectionStatus,
//   disconnect,
// };
