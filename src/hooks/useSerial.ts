import { useState, useRef, useCallback } from 'react';
import type {
  SerialConfig,
  DeviceInfo,
  SerialResponse,
  ConnectionStatus,
} from '../data/webserial.interface';

interface UseSerialProps {
  onConnectionChange: (connected: boolean) => void;
  onDeviceInfo: (info: DeviceInfo | null) => void;
  onConnectionStatus: (status: ConnectionStatus) => void;
}

interface UseSerialReturn {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  sendCommand: (
    command: string,
    data?: string,
    customTimeout?: number
  ) => Promise<SerialResponse>;
  sendCommandWithRetry: (
    command: string,
    data?: string,
    retries?: number
  ) => Promise<SerialResponse>;
  isConnected: boolean;
  SERIAL_COMMANDS: typeof SERIAL_COMMANDS;
}
// Serial command constants
const SERIAL_COMMANDS = {
  GET_INFO: 'GET_INFO',
  GET_STATUS: 'GET_STATUS',
  START_UPDATE: 'START_UPDATE',
  SEND_CHUNK: 'SEND_CHUNK',
  FINISH_UPDATE: 'FINISH_UPDATE',
  ABORT_UPDATE: 'ABORT_UPDATE',
  RESTART: 'RESTART',
  ROLLBACK: 'ROLLBACK',
  GET_PARTITION_INFO: 'GET_PARTITION_INFO',
  GET_STORAGE_INFO: 'GET_STORAGE_INFO',
  VALIDATE_FIRMWARE: 'VALIDATE_FIRMWARE',
} as const;

const RESPONSE_PREFIXES = {
  OK: 'OK:',
  ERROR: 'ERROR:',
  PROGRESS: 'PROGRESS:',
} as const;

const SERIAL_CONFIG: SerialConfig = {
  baudRate: 921600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
};

const COMMAND_TIMEOUT = 5000;
const CHUNK_TIMEOUT = 10000;
const MAX_RETRIES = 2;

// Extend the global Window interface for progress handler
declare global {
  interface Window {
    progressHandler?: (response: SerialResponse) => void;
  }
}

export const useSerial = ({
  onConnectionChange,
  onDeviceInfo,
  onConnectionStatus,
}: UseSerialProps): UseSerialReturn => {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const serialPortRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );
  const pendingCommandRef = useRef<((response: SerialResponse) => void) | null>(
    null
  );

  const updateConnectionStatus = useCallback(
    (message: string, type: ConnectionStatus['type'] = 'info') => {
      onConnectionStatus({ message, type });
    },
    [onConnectionStatus]
  );

  const sendCommand = useCallback(
    async (
      command: string,
      data = '',
      customTimeout = COMMAND_TIMEOUT
    ): Promise<SerialResponse> => {
      if (!writerRef.current) {
        throw new Error('Not connected to device');
      }

      return new Promise<SerialResponse>((resolve, reject) => {
        const commandString = data ? `${command}:${data}\n` : `${command}\n`;
        const encoder = new TextEncoder();

        const timeoutMs =
          command === SERIAL_COMMANDS.SEND_CHUNK
            ? CHUNK_TIMEOUT
            : customTimeout;

        const timeout = setTimeout(() => {
          console.error(`Command timeout (${timeoutMs}ms): ${command}`);
          pendingCommandRef.current = null;
          reject(new Error(`Command timeout: ${command}`));
        }, timeoutMs);

        pendingCommandRef.current = (response: SerialResponse) => {
          clearTimeout(timeout);
          if (response && response.success !== undefined) {
            resolve(response);
          } else {
            console.error(`Invalid response for ${command}:`, response);
            reject(new Error(`Invalid response for ${command}`));
          }
        };

        writerRef
          .current!.write(encoder.encode(commandString))
          .catch((error: Error) => {
            clearTimeout(timeout);
            pendingCommandRef.current = null;
            console.error('Write failed:', error);
            reject(error);
          });
      });
    },
    []
  );

  const sendCommandWithRetry = useCallback(
    async (
      command: string,
      data = '',
      retries = MAX_RETRIES
    ): Promise<SerialResponse> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const result = await sendCommand(command, data);
          return result;
        } catch (error) {
          console.warn(`Command ${command} attempt ${attempt} failed:`, error);
          if (attempt === retries) {
            throw error;
          }
          const retryDelay = command === SERIAL_COMMANDS.SEND_CHUNK ? 100 : 50;
          await new Promise<void>(resolve => setTimeout(resolve, retryDelay));
        }
      }
      // This should never be reached due to the throw above, but TypeScript requires it
      throw new Error('Max retries exceeded');
    },
    [sendCommand]
  );

  const handleResponse = useCallback((line: string): void => {
    let response: SerialResponse | null = null;
    let isProgress = false;

    if (line.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.OK.length);
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
      } catch (e) {
        console.error('Failed to parse OK response:', jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.ERROR.length);
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
        response.success = false;
      } catch (e) {
        console.error('Failed to parse ERROR response:', jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.PROGRESS.length);
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
        isProgress = true;
      } catch (e) {
        console.error('Failed to parse PROGRESS response:', jsonStr, e);
        return;
      }
    } else {
      return;
    }

    if (isProgress) {
      // Handle progress updates in the updater hook
      if (window.progressHandler) {
        window.progressHandler(response);
      }
    } else if (pendingCommandRef.current) {
      const handler = pendingCommandRef.current;
      pendingCommandRef.current = null;
      handler(response);
    }
  }, []);

  const startListening = useCallback(async (): Promise<void> => {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (readerRef.current && isConnected) {
        const { value, done } = await readerRef.current.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            handleResponse(line.trim());
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Serial reading error:', error);
      }
    }
  }, [isConnected, handleResponse]);

  const connect = useCallback(async (): Promise<boolean> => {
    try {
      updateConnectionStatus('', 'info');

      // Clean up any existing connection first
      if (isConnected || serialPortRef.current) {
        await disconnect();
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
      }

      if (!navigator.serial) {
        throw new Error('Web Serial API not supported');
      }

      const port = await navigator.serial.requestPort();
      await port.open(SERIAL_CONFIG);
      serialPortRef.current = port;

      if (port.readable === null || port.writable === null) {
        throw new Error('Port is not readable or writable');
      }
      readerRef.current = port.readable.getReader();
      writerRef.current = port.writable.getWriter();

      setIsConnected(true);
      onConnectionChange(true);

      // Start listening without awaiting to prevent blocking
      startListening().catch(error => {
        console.error('Error in startListening:', error);
      });

      try {
        updateConnectionStatus('Checking device mode...', 'info');

        const info = (await sendCommand(
          SERIAL_COMMANDS.GET_INFO,
          '',
          5000
        )) as DeviceInfo;

        if (info && info.success) {
          // Check if device is in Update Mode
          if (info.current_mode !== 'Update Mode') {
            console.log(`Device in wrong mode: ${info.current_mode}`);
            await disconnect();
            updateConnectionStatus(
              `Device is in ${info.current_mode}. Please switch to Update Mode and connect again.`,
              'warning'
            );
            return false;
          }

          onDeviceInfo(info);
          updateConnectionStatus(
            'Device connected successfully in Update Mode',
            'success'
          );
        } else {
          await disconnect();
          updateConnectionStatus(
            'Could not verify device mode. Please ensure device is in Update Mode and try again.',
            'error'
          );
          return false;
        }
      } catch (error) {
        await serialPortRef.current.close();
        console.warn('Failed to get device info:', error);
        await disconnect();
        updateConnectionStatus(
          'Unable to communicate with device. Please ensure device is in Update Mode and try again.',
          'error'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      await disconnect();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      updateConnectionStatus(`Connection failed: ${errorMessage}`, 'error');
      return false;
    }
  }, [
    isConnected,
    onConnectionChange,
    onDeviceInfo,
    updateConnectionStatus,
    sendCommand,
    startListening,
  ]);

  const disconnect = useCallback(async (): Promise<boolean> => {
    updateConnectionStatus('', 'info');

    if (!isConnected && !serialPortRef.current) {
      return true;
    }

    try {
      setIsConnected(false);

      if (pendingCommandRef.current) {
        pendingCommandRef.current = null;
      }

      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          console.warn('Reader cancel failed:', e);
        }

        try {
          readerRef.current.releaseLock();
        } catch (e) {
          console.warn('Reader release failed:', e);
        }
        readerRef.current = null;
      }

      if (writerRef.current) {
        try {
          await writerRef.current.close();
        } catch (e) {
          console.warn('Writer close failed:', e);
        }
        writerRef.current = null;
      }

      await new Promise<void>(resolve => setTimeout(resolve, 100));

      const currentPort = serialPortRef.current;

      if (currentPort) {
        try {
          await currentPort.close();
        } catch (e) {
          console.warn('Serial port close failed:', e);
        }
        serialPortRef.current = null;
      }

      onDeviceInfo(null);
      onConnectionChange(false);

      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force cleanup even if there were errors
      setIsConnected(false);
      readerRef.current = null;
      writerRef.current = null;
      serialPortRef.current = null;
      pendingCommandRef.current = null;
      onDeviceInfo(null);
      onConnectionChange(false);
      return false;
    }
  }, [isConnected, onConnectionChange, onDeviceInfo, updateConnectionStatus]);

  return {
    connect,
    disconnect,
    sendCommand,
    sendCommandWithRetry,
    isConnected,
    SERIAL_COMMANDS,
  };
};
