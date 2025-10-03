import { useState, useRef, useCallback } from 'react';
import type {
  SerialConfig,
  DeviceInfo,
  SerialResponse,
  StatusMessage,
  UseSerialProps,
  UseSerialReturn,
  SerialCommands,
} from '../data/webserial.interface';

// Serial command constants - must match ESP32 firmware definitions
const SERIAL_COMMANDS: SerialCommands = {
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
  WIFI_SCAN: 'WIFI_SCAN',
  WIFI_STATUS: 'WIFI_STATUS',
  WIFI_CONNECT: 'WIFI_CONNECT',
  WIFI_DISCONNECT: 'WIFI_DISCONNECT',
  WIFI_GET_SAVED: 'WIFI_GET_SAVED',
  WIFI_FORGET: 'WIFI_FORGET',
} as const;

// Response prefixes for parsing ESP32 responses
const RESPONSE_PREFIXES = {
  OK: 'OK:',
  ERROR: 'ERROR:',
  PROGRESS: 'PROGRESS:',
  NOTIFY: 'NOTIFY:',
} as const;

// Try with hardware flow control first, then without
const SERIAL_CONFIG_WITH_FLOW: SerialConfig = {
  baudRate: 921600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'hardware', // Try hardware flow control first
};

const SERIAL_CONFIG_NO_FLOW: SerialConfig = {
  baudRate: 921600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
};

const WIFI_SCAN_TIMEOUT = 30000;
const COMMAND_TIMEOUT = 10000;
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
  onNotification,
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
  const notificationHandlerRef = useRef<
    ((notification: { message: string; data?: any }) => void) | null
  >(null);

  // Set the notification handler ref
  notificationHandlerRef.current = onNotification || null;

  const updateConnectionStatus = useCallback(
    (message: string, type: StatusMessage['type'] = 'info') => {
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

        const timeoutMs =
          command === SERIAL_COMMANDS.SEND_CHUNK
            ? CHUNK_TIMEOUT
            : command.startsWith('WIFI_')
              ? WIFI_SCAN_TIMEOUT
              : customTimeout;

        // Log all WiFi commands
        if (command.startsWith('WIFI_')) {
          console.log(
            `[useSerial] Sending ${command} Command: ${commandString.trim()}`
          );
          console.log(`[useSerial] ${command} Timeout set to: ${timeoutMs}ms`);
        }

        const encoder = new TextEncoder();

        const timeout = setTimeout(() => {
          if (command.startsWith('WIFI_')) {
            console.log(
              `[useSerial] ⏰ ${command} TIMEOUT after ${timeoutMs}ms - no response received`
            );
          }
          pendingCommandRef.current = null;
          reject(new Error(`Command timeout: ${command}`));
        }, timeoutMs);

        pendingCommandRef.current = (response: SerialResponse) => {
          clearTimeout(timeout);

          // Log all WiFi responses
          if (command.startsWith('WIFI_')) {
            console.log(`[useSerial] ${command} Response Received:`, response);
            console.log(
              `[useSerial] ${command} Response Type:`,
              typeof response
            );
            console.log(
              `[useSerial] ${command} Response Success:`,
              response?.success
            );
          }

          if (response && response.success !== undefined) {
            if (command.startsWith('WIFI_')) {
              console.log(
                `[useSerial] ✅ ${command} Response valid - resolving`
              );
            }
            resolve(response);
          } else {
            if (command.startsWith('WIFI_')) {
              console.log(
                `[useSerial] ❌ ${command} Invalid response - rejecting:`,
                response
              );
            }
            reject(new Error(`Invalid response for ${command}`));
          }
        };

        if (!writerRef.current) {
          clearTimeout(timeout);
          pendingCommandRef.current = null;
          reject(new Error('Writer became unavailable'));
          return;
        }

        if (command.startsWith('WIFI_')) {
          console.log(`[useSerial] 📤 Writing ${command} to device...`);
        }

        writerRef.current
          .write(encoder.encode(commandString))
          .then(() => {
            if (command.startsWith('WIFI_')) {
              console.log(
                `[useSerial] ✅ ${command} successfully written to device`
              );
            }
          })
          .catch((error: Error) => {
            if (command.startsWith('WIFI_')) {
              console.log(`[useSerial] ❌ ${command} write failed:`, error);
            }
            clearTimeout(timeout);
            pendingCommandRef.current = null;
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

    // Log response parsing for WiFi-related responses
    if (
      line.includes('WIFI') ||
      line.includes('OK:') ||
      line.includes('ERROR:')
    ) {
      console.log(`[useSerial] 🔍 Parsing response: "${line}"`);
    }

    // The device should send responses like:
    // OK:{"success":true,"message":"BYTE-90 Serial Interface Ready"}
    // ERROR:{"success":false,"message":"Error message"}
    // PROGRESS:{"success":true,"completed":false,...}

    if (line.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.OK.length);
      if (line.includes('WIFI')) {
        console.log(`[useSerial] 🟢 Parsing OK response, JSON: "${jsonStr}"`);
      }
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ✅ OK response parsed successfully:`,
            response
          );
        }
      } catch (e) {
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ❌ Failed to parse OK JSON: "${jsonStr}", error:`,
            e
          );
        }
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.ERROR.length);
      if (line.includes('WIFI')) {
        console.log(
          `[useSerial] 🔴 Parsing ERROR response, JSON: "${jsonStr}"`
        );
      }
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
        response.success = false;
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ✅ ERROR response parsed successfully:`,
            response
          );
        }
      } catch (e) {
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ❌ Failed to parse ERROR JSON: "${jsonStr}", error:`,
            e
          );
        }
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.PROGRESS.length);
      if (line.includes('WIFI')) {
        console.log(
          `[useSerial] 🟡 Parsing PROGRESS response, JSON: "${jsonStr}"`
        );
      }
      try {
        response = JSON.parse(jsonStr) as SerialResponse;
        isProgress = true;
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ✅ PROGRESS response parsed successfully:`,
            response
          );
        }
      } catch (e) {
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ❌ Failed to parse PROGRESS JSON: "${jsonStr}", error:`,
            e
          );
        }
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.NOTIFY)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.NOTIFY.length);
      console.log(`[useSerial] 🔔 Parsing NOTIFY response, JSON: "${jsonStr}"`);
      try {
        const notificationData = JSON.parse(jsonStr);
        console.log(
          `[useSerial] ✅ NOTIFY response parsed successfully:`,
          notificationData
        );
        if (notificationHandlerRef.current) {
          notificationHandlerRef.current({
            message: notificationData.message || '',
            data: notificationData,
          });
        }
      } catch (e) {
        console.log(
          `[useSerial] ❌ Failed to parse NOTIFY JSON: "${jsonStr}", error:`,
          e
        );
      }
      return; // Don't process as a command response
    } else {
      // Device might send initialization message or other non-prefixed data
      // Try parsing as direct JSON (for initialization messages)
      if (line.includes('WIFI')) {
        console.log(`[useSerial] 🔵 Trying to parse as direct JSON: "${line}"`);
      }
      try {
        response = JSON.parse(line) as SerialResponse;
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ✅ Direct JSON parsed successfully:`,
            response
          );
        }
      } catch (e) {
        if (line.includes('WIFI')) {
          console.log(
            `[useSerial] ❌ Failed to parse direct JSON: "${line}", error:`,
            e
          );
        }
        return;
      }
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
    let shouldContinue = true;

    try {
      // CRITICAL: Store the reader reference locally and don't depend on React state
      const currentReader = readerRef.current;

      if (!currentReader) {
        return;
      }

      while (currentReader && shouldContinue) {
        try {
          const { value, done } = await currentReader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              // Log raw data for WiFi-related responses
              if (
                line.includes('WIFI') ||
                line.includes('OK:') ||
                line.includes('ERROR:')
              ) {
                console.log(
                  `[useSerial] 📥 Raw data received: "${line.trim()}"`
                );
              }
              handleResponse(line.trim());
            }
          }
        } catch (readError) {
          if ((readError as Error).name === 'AbortError') {
            break;
          } else {
            break;
          }
        }
      }
    } catch (error) {
      // Error handling without logging
    }
  }, [handleResponse]);

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

      // Request port without filters
      const port = await navigator.serial.requestPort();

      // Try connecting with hardware flow control first
      let connectionSuccess = false;
      let lastError = null;

      try {
        await port.open(SERIAL_CONFIG_WITH_FLOW);
        connectionSuccess = true;
      } catch (error) {
        lastError = error;

        try {
          await port.open(SERIAL_CONFIG_NO_FLOW);
          connectionSuccess = true;
        } catch (error2) {
          lastError = error2;
        }
      }

      if (!connectionSuccess) {
        throw lastError || new Error('Failed to open serial port');
      }

      serialPortRef.current = port;

      if (port.readable === null || port.writable === null) {
        throw new Error('Port is not readable or writable');
      }

      readerRef.current = port.readable.getReader();
      writerRef.current = port.writable.getWriter();

      setIsConnected(true);
      onConnectionChange(true);

      // CRITICAL FIX: Start listening in a separate microtask
      setTimeout(() => {
        startListening().catch(() => {
          // Error handling without logging
        });
      }, 0);

      try {
        updateConnectionStatus('Checking device...', 'info');

        // Wait for the device to send its initialization message
        await new Promise<void>(resolve => setTimeout(resolve, 2000));

        // Send GET_INFO with longer timeout
        const info = (await sendCommand(
          SERIAL_COMMANDS.GET_INFO,
          '',
          10000 // Use 10 second timeout like the working demo
        )) as DeviceInfo;

        if (info && info.success) {
          // Check if device is in Update Mode or Crash Mode
          if (
            info.current_mode !== 'Update Mode' &&
            info.current_mode !== 'Crash Mode'
          ) {
            await disconnect();
            updateConnectionStatus(
              'Device must be in Update Mode or Crash Mode. Current mode: ' +
                info.current_mode,
              'error'
            );
            return false;
          }

          onDeviceInfo(info);
          // Update status message based on mode
          if (info.current_mode === 'Crash Mode') {
            updateConnectionStatus(
              'Connected in crash recovery mode',
              'warning' // or 'error' to make it more visible
            );
          } else {
            updateConnectionStatus(
              'Connected in system configuration',
              'success'
            );
          }
        } else {
          await disconnect();
          updateConnectionStatus(
            'Could not verify device mode. Please ensure device is in Update Mode and try again.',
            'error'
          );
          return false;
        }
      } catch (error) {
        await disconnect();
        updateConnectionStatus(
          'Unable to communicate with device. Please ensure device is in Update Mode and try again.',
          'error'
        );
        return false;
      }

      return true;
    } catch (error) {
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
    // Remove disconnect from dependency array to avoid circular dependency
  ]);

  const disconnect = useCallback(async (): Promise<boolean> => {
    updateConnectionStatus('', 'info');

    if (!isConnected && !serialPortRef.current) {
      return true;
    }

    try {
      setIsConnected(false);

      // Clear any pending commands
      if (pendingCommandRef.current) {
        pendingCommandRef.current = null;
      }

      // Close reader with proper error handling - like working code
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          // Error handling without logging
        }

        try {
          readerRef.current.releaseLock();
        } catch (e) {
          // Error handling without logging
        }
        readerRef.current = null;
      }

      // Close writer with proper error handling
      if (writerRef.current) {
        try {
          await writerRef.current.close();
        } catch (e) {
          // Error handling without logging
        }
        writerRef.current = null;
      }

      // Wait before closing port - exactly like working code
      await new Promise<void>(resolve => setTimeout(resolve, 100));

      // Close the serial port
      const currentPort = serialPortRef.current;
      if (currentPort) {
        try {
          await currentPort.close();
        } catch (e) {
          // Error handling without logging
        }
        serialPortRef.current = null;
      }

      onDeviceInfo(null);
      onConnectionChange(false);

      return true;
    } catch (error) {
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
