'use client';
import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '@/lib/utils';
import { WsMessage, AgentResponse } from '@/types';

interface UseWebSocketOptions {
  onToken: (token: string, requestId?: string) => void;
  onStreamEnd: (response: AgentResponse, requestId?: string) => void;
  onStreamStart: (requestId?: string) => void;
  onError: (message: string) => void;
  onConnected: () => void;
}

export function useWebSocket(opts: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnects = 5;
  const isIntentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      opts.onConnected();
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'connected':
            break;
          case 'stream_start':
            opts.onStreamStart(msg.requestId);
            break;
          case 'token':
            opts.onToken(msg.token, msg.requestId);
            break;
          case 'stream_end':
            opts.onStreamEnd(msg.response, msg.requestId);
            break;
          case 'error':
            opts.onError(msg.message);
            break;
        }
      } catch {
        console.error('WS parse error');
      }
    };

    ws.onclose = () => {
      if (isIntentionalClose.current) return;
      const attempts = reconnectAttemptsRef.current;
      if (attempts < maxReconnects) {
        const delay = Math.min(1000 * 2 ** attempts, 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    connect();
    return () => {
      isIntentionalClose.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendChatMessage = useCallback(
    (sessionId: string, message: string, requestId?: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'chat', sessionId, message, requestId })
        );
        return true;
      }
      return false;
    },
    []
  );

  const isConnected = () => wsRef.current?.readyState === WebSocket.OPEN;

  return { sendChatMessage, isConnected, reconnect: connect };
}
