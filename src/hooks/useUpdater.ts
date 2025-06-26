import { useCallback, useEffect } from 'react';
import type {
  SerialResponse,
  SerialCommands,
  UpdateStatus,
  ProgressUpdate,
} from '../data/webserial.interface';

interface SerialInterface {
  sendCommand: (command: string, data?: string) => Promise<SerialResponse>;
  sendCommandWithRetry: (
    command: string,
    data?: string,
    retries?: number
  ) => Promise<SerialResponse>;
  disconnect: () => Promise<void>;
  SERIAL_COMMANDS: SerialCommands;
}

interface UseUpdaterProps {
  serial: SerialInterface;
  onUpdateStatus: (status: UpdateStatus) => void;
  onProgress: (progress: ProgressUpdate) => void;
  onShowProgress: (show: boolean) => void;
  onUpdateInProgress: (inProgress: boolean) => void;
}

interface UseUpdaterReturn {
  startUpdate: (
    file: File,
    updateType: 'firmware' | 'filesystem'
  ) => Promise<void>;
  abortUpdate: () => Promise<void>;
}

// Constants
const CHUNK_SIZE = 1024;

// Utility functions
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const useUpdater = ({
  serial,
  onUpdateStatus,
  onProgress,
  onShowProgress,
  onUpdateInProgress,
}: UseUpdaterProps): UseUpdaterReturn => {
  const updateStatus = useCallback(
    (message: string, type: UpdateStatus['type'] = 'info') => {
      onUpdateStatus({ message, type });
    },
    [onUpdateStatus]
  );

  const updateProgress = useCallback(
    (percent: number, message = '') => {
      onProgress({
        percent,
        message: message || `${Math.round(percent)}%`,
      });
      onShowProgress(true);
    },
    [onProgress, onShowProgress]
  );

  const resetProgress = useCallback(() => {
    onProgress({ percent: 0, message: 'Ready to upload' });
    onShowProgress(false);
  }, [onProgress, onShowProgress]);

  // Set up global progress handler for serial responses
  useEffect(() => {
    window.progressHandler = (response: SerialResponse) => {
      if (response.completed) {
        onUpdateInProgress(false);
        if (response.success) {
          updateStatus(
            'Update completed successfully! Device will restart.',
            'success'
          );
        } else {
          updateStatus(response.message || 'Update failed', 'error');
        }
      }
    };

    return () => {
      window.progressHandler = undefined;
    };
  }, [onUpdateInProgress, updateStatus]);

  const startUpdate = useCallback(
    async (
      file: File,
      updateType: 'firmware' | 'filesystem'
    ): Promise<void> => {
      if (!file) {
        updateStatus('Please select a firmware file', 'error');
        return;
      }

      if (!file.name.endsWith('.bin')) {
        updateStatus('Please select a .bin file', 'error');
        return;
      }

      const expectedFilename =
        updateType === 'firmware' ? 'byte90.bin' : 'byte90animations.bin';
      const expectedString =
        updateType === 'firmware' ? 'byte90' : 'byte90animations';

      if (!file.name.includes(expectedString)) {
        updateStatus(
          `Please select the correct file (${expectedFilename})`,
          'error'
        );
        return;
      }

      try {
        onUpdateInProgress(true);
        onUpdateStatus({ message: '', type: '' });
        updateProgress(0, 'Checking device status...');

        try {
          const statusResponse = await serial.sendCommand(
            serial.SERIAL_COMMANDS.GET_STATUS
          );
          if (statusResponse && statusResponse.update_active) {
            await serial.sendCommand(serial.SERIAL_COMMANDS.ABORT_UPDATE);
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn('Failed to get status:', error);
        }

        updateProgress(1, 'Resetting device state...');

        try {
          await serial.sendCommand(serial.SERIAL_COMMANDS.ABORT_UPDATE);
          await new Promise<void>(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.warn('Abort command failed:', error);
        }

        updateProgress(3, 'Starting new update...');

        console.log(`Starting update: ${file.size} bytes, type: ${updateType}`);

        const startResponse = await serial.sendCommandWithRetry(
          serial.SERIAL_COMMANDS.START_UPDATE,
          `${file.size},${updateType}`,
          2
        );

        if (!startResponse || !startResponse.success) {
          throw new Error(
            startResponse?.message || 'START_UPDATE command failed'
          );
        }

        if (startResponse.state !== 'RECEIVING') {
          throw new Error(
            `Expected RECEIVING state, got: ${startResponse.state}`
          );
        }

        updateProgress(5, 'Reading firmware file...');

        const arrayBuffer = await file.arrayBuffer();
        const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

        console.log(
          `File read: ${arrayBuffer.byteLength} bytes in ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`
        );
        updateProgress(10, 'Starting upload...');

        const startTime = performance.now();
        let bytesTransferred = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
          const chunk = arrayBuffer.slice(start, end);
          const base64Chunk = arrayBufferToBase64(chunk);

          if (i % 50 === 0 || i === totalChunks - 1) {
            const transferProgress = 10 + (i / totalChunks) * 80;
            updateProgress(
              transferProgress,
              `Uploading: ${Math.round(transferProgress)}% Do not disconnect device.`
            );
          }

          try {
            const chunkResponse = await serial.sendCommand(
              serial.SERIAL_COMMANDS.SEND_CHUNK,
              base64Chunk
            );

            if (!chunkResponse || !chunkResponse.success) {
              consecutiveErrors++;
              throw new Error(
                chunkResponse?.message || `Chunk ${i + 1} rejected by device`
              );
            }

            consecutiveErrors = 0;
            if (i < totalChunks - 1) {
              await new Promise<void>(resolve => setTimeout(resolve, 1));
            }
          } catch (chunkError) {
            consecutiveErrors++;
            console.error(
              `Chunk ${i + 1} failed (${consecutiveErrors} consecutive errors):`,
              chunkError
            );

            if (consecutiveErrors >= maxConsecutiveErrors) {
              const errorMessage =
                chunkError instanceof Error
                  ? chunkError.message
                  : 'Unknown error';
              throw new Error(
                `Too many consecutive errors (${consecutiveErrors}). Last error: ${errorMessage}`
              );
            }

            i--;
            continue;
          }

          bytesTransferred = end;
        }

        const totalTime = (performance.now() - startTime) / 1000;
        const avgSpeed = arrayBuffer.byteLength / totalTime;
        console.log(
          `Transfer completed: ${formatBytes(
            arrayBuffer.byteLength
          )} in ${totalTime.toFixed(2)}s (${formatBytes(avgSpeed)}/s)`
        );

        updateProgress(95, 'Finalizing update...');

        const finishResponse = await serial.sendCommandWithRetry(
          serial.SERIAL_COMMANDS.FINISH_UPDATE
        );

        if (!finishResponse || !finishResponse.success) {
          throw new Error(finishResponse?.message || 'Failed to finish update');
        }

        updateProgress(100, 'Update completed successfully!');
        updateStatus(
          'Update completed! Device will restart automatically.',
          'success'
        );

        onUpdateInProgress(false);

        setTimeout(async () => {
          try {
            await serial.disconnect(); // This line is now valid
            updateStatus(
              'Update completed successfully. Device is restarting. You can reconnect when ready.',
              'success'
            );
          } catch (disconnectError) {
            console.warn(
              'Failed to disconnect after successful update:',
              disconnectError
            );
          }
        }, 2000);
      } catch (error) {
        console.error('Update failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        updateStatus(`Update failed: ${errorMessage}`, 'error');
        onUpdateInProgress(false);

        try {
          await serial.sendCommand(serial.SERIAL_COMMANDS.ABORT_UPDATE);
        } catch (abortError) {
          console.warn('Failed to abort update after error:', abortError);
        }
      }
    },
    [serial, onUpdateInProgress, updateStatus, updateProgress]
  );

  const abortUpdate = useCallback(async (): Promise<void> => {
    try {
      await serial.sendCommand(serial.SERIAL_COMMANDS.ABORT_UPDATE);
      onUpdateInProgress(false);
      resetProgress();
      updateStatus('Update aborted', 'warning');
    } catch (error) {
      console.error('Failed to abort update:', error);
    }
  }, [serial, onUpdateInProgress, resetProgress, updateStatus]);

  return {
    startUpdate,
    abortUpdate,
  };
};
