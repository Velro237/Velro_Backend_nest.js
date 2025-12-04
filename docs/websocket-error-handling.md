# WebSocket Error Handling - Frontend Guide

## Error Event Structure

When a WebSocket operation fails, the server emits an `error` event with the following structure:

```typescript
{
  message: string;      // Human-readable error message
  details?: string;    // Additional error details (optional)
}
```

## Frontend Implementation Examples

### 1. React with Socket.IO Client

```typescript
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

function ChatComponent() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000/chat', {
      auth: {
        token: 'your-jwt-token'
      }
    });

    // Listen for error events
    newSocket.on('error', (errorData: { message: string; details?: string }) => {
      console.error('WebSocket Error:', errorData);
      setError(errorData.message);

      // Show user-friendly error notification
      showNotification({
        type: 'error',
        title: 'Connection Error',
        message: errorData.message,
        details: errorData.details
      });
    });

    // Listen for connection errors
    newSocket.on('connect_error', (err) => {
      console.error('Connection Error:', err);
      setError('Failed to connect to chat server');
    });

    // Listen for disconnect
    newSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, reconnect manually
        newSocket.connect();
      }
      setError('Disconnected from chat server');
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.off('error');
      newSocket.off('connect_error');
      newSocket.off('disconnect');
      newSocket.close();
    };
  }, []);

  // Send message with error handling
  const sendMessage = (messageData: any) => {
    if (!socket || !socket.connected) {
      setError('Not connected to chat server');
      return;
    }

    try {
      socket.emit('message:send', messageData);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      {/* Chat UI */}
    </div>
  );
}
```

### 2. Vue.js with Socket.IO Client

```vue
<template>
  <div>
    <div v-if="error" class="error-banner">
      {{ error }}
    </div>
    <!-- Chat UI -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';

const socket = ref<Socket | null>(null);
const error = ref<string | null>(null);

const handleError = (errorData: { message: string; details?: string }) => {
  console.error('WebSocket Error:', errorData);
  error.value = errorData.message;

  // Show notification
  showNotification({
    type: 'error',
    message: errorData.message,
  });
};

onMounted(() => {
  const newSocket = io('http://localhost:3000/chat', {
    auth: {
      token: 'your-jwt-token',
    },
  });

  // Listen for error events
  newSocket.on('error', handleError);

  // Connection errors
  newSocket.on('connect_error', (err) => {
    error.value = 'Failed to connect to chat server';
  });

  socket.value = newSocket;
});

onUnmounted(() => {
  if (socket.value) {
    socket.value.off('error');
    socket.value.off('connect_error');
    socket.value.close();
  }
});
</script>
```

### 3. Angular with Socket.IO Client

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  private socket: Socket | null = null;
  public error$ = new Subject<{ message: string; details?: string }>();

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.socket = io('http://localhost:3000/chat', {
      auth: {
        token: 'your-jwt-token',
      },
    });

    // Listen for error events
    this.socket.on(
      'error',
      (errorData: { message: string; details?: string }) => {
        console.error('WebSocket Error:', errorData);
        this.error$.next(errorData);
      },
    );

    // Connection errors
    this.socket.on('connect_error', (err) => {
      this.error$.next({
        message: 'Failed to connect to chat server',
        details: err.message,
      });
    });
  }

  sendMessage(messageData: any): void {
    if (!this.socket || !this.socket.connected) {
      this.error$.next({ message: 'Not connected to chat server' });
      return;
    }

    try {
      this.socket.emit('message:send', messageData);
    } catch (err: any) {
      this.error$.next({
        message: 'Failed to send message',
        details: err.message,
      });
    }
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.off('error');
      this.socket.off('connect_error');
      this.socket.close();
    }
  }
}
```

### 4. Vanilla JavaScript / TypeScript

```typescript
import { io, Socket } from 'socket.io-client';

class ChatClient {
  private socket: Socket | null = null;
  private errorHandlers: Array<
    (error: { message: string; details?: string }) => void
  > = [];

  connect(token: string): void {
    this.socket = io('http://localhost:3000/chat', {
      auth: { token },
    });

    // Listen for error events
    this.socket.on(
      'error',
      (errorData: { message: string; details?: string }) => {
        console.error('WebSocket Error:', errorData);
        this.notifyErrorHandlers(errorData);
      },
    );

    // Connection errors
    this.socket.on('connect_error', (err) => {
      this.notifyErrorHandlers({
        message: 'Failed to connect to chat server',
        details: err.message,
      });
    });

    // Disconnect handling
    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect
        this.socket?.connect();
      }
    });
  }

  onError(
    handler: (error: { message: string; details?: string }) => void,
  ): void {
    this.errorHandlers.push(handler);
  }

  private notifyErrorHandlers(error: {
    message: string;
    details?: string;
  }): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  sendMessage(messageData: any): void {
    if (!this.socket || !this.socket.connected) {
      this.notifyErrorHandlers({ message: 'Not connected to chat server' });
      return;
    }

    try {
      this.socket.emit('message:send', messageData);
    } catch (err: any) {
      this.notifyErrorHandlers({
        message: 'Failed to send message',
        details: err.message,
      });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.off('error');
      this.socket.off('connect_error');
      this.socket.close();
    }
  }
}

// Usage
const chat = new ChatClient();
chat.onError((error) => {
  alert(`Error: ${error.message}`);
});
chat.connect('your-jwt-token');
```

## Error Event Types

The backend emits `error` events in these scenarios:

1. **Message Send Failures**

   ```typescript
   {
     message: 'Could not send message',
     details: 'Error details here'
   }
   ```

2. **Validation Errors**

   ```typescript
   {
     message: 'Message must have content or at least one image',
     details: 'Either content or images must be provided'
   }
   ```

3. **Permission Errors**

   ```typescript
   {
     message: 'Not a member of this chat';
   }
   ```

4. **Connection/Transmission Errors**
   ```typescript
   {
     message: 'Failed to send message:new',
     details: 'Socket not connected'
   }
   ```

## Best Practices

### 1. Always Listen for Error Events

```typescript
socket.on('error', (errorData) => {
  // Handle error
});
```

### 2. Handle Connection Errors Separately

```typescript
socket.on('connect_error', (err) => {
  // Handle connection failures
  console.error('Connection failed:', err);
  // Show reconnection UI
});
```

### 3. Implement Retry Logic

```typescript
let retryCount = 0;
const MAX_RETRIES = 3;

socket.on('error', (errorData) => {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(() => {
      socket.emit('message:send', messageData);
    }, 1000 * retryCount); // Exponential backoff
  } else {
    // Show permanent error
    showError('Failed to send message after multiple attempts');
  }
});
```

### 4. User-Friendly Error Messages

```typescript
const errorMessages: Record<string, string> = {
  'Could not send message': 'Unable to send your message. Please try again.',
  'Not a member of this chat':
    'You are not authorized to send messages in this chat.',
  'Message must have content': 'Please enter a message or attach an image.',
  'Failed to send message:new':
    'Message delivery failed. Your message may not have been received.',
};

socket.on('error', (errorData) => {
  const userMessage = errorMessages[errorData.message] || errorData.message;
  showNotification(userMessage, 'error');
});
```

### 5. Check Connection Status Before Sending

```typescript
const sendMessage = (data: any) => {
  if (!socket || !socket.connected) {
    showError('Not connected. Please wait...');
    return;
  }

  socket.emit('message:send', data);
};
```

## Complete Example: React Hook

```typescript
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ErrorData {
  message: string;
  details?: string;
}

export function useChatSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<ErrorData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/chat', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection status
    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Error handling
    newSocket.on('error', (errorData: ErrorData) => {
      console.error('Chat Error:', errorData);
      setError(errorData);
    });

    newSocket.on('connect_error', (err) => {
      setError({
        message: 'Connection failed',
        details: err.message,
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('error');
      newSocket.off('connect_error');
      newSocket.close();
    };
  }, [token]);

  const sendMessage = useCallback(
    (data: any) => {
      if (!socket || !isConnected) {
        setError({ message: 'Not connected to chat server' });
        return false;
      }

      try {
        socket.emit('message:send', data);
        return true;
      } catch (err: any) {
        setError({
          message: 'Failed to send message',
          details: err.message,
        });
        return false;
      }
    },
    [socket, isConnected],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    socket,
    error,
    isConnected,
    sendMessage,
    clearError,
  };
}
```

## Testing Error Handling

```typescript
// Test error handling
socket.on('error', (errorData) => {
  expect(errorData).toHaveProperty('message');
  expect(typeof errorData.message).toBe('string');

  // Log for debugging
  console.log('Error received:', errorData);
});
```
