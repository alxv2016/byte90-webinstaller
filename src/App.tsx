import React, { useState, useEffect, useCallback } from 'react';
import ConnectionCard from './components/connection-card';
import UpdateCard from './components/update-card';
import CompatibilityCard from './components/compatibility-card';
import { useSerial } from './hooks/useSerial';
import { useUpdater } from './hooks/useUpdater';

// Import types from centralized location
import type {
  DeviceInfo,
  StatusMessage,
  ProgressUpdate,
} from './data/webserial.interface';

// App component
const App: React.FC = () => {
  // State management with proper TypeScript typing
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [updateInProgress, setUpdateInProgress] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<StatusMessage>({
    message: '',
    type: '',
  });
  const [updateStatus, setUpdateStatus] = useState<StatusMessage>({
    message: '',
    type: '',
  });
  const [progress, setProgress] = useState<ProgressUpdate>({
    percent: 0,
    message: 'Ready to upload',
  });
  const [showProgress, setShowProgress] = useState<boolean>(false);

  // Initialize serial hook with proper callback typing
  const serial = useSerial({
    onConnectionChange: setIsConnected,
    onDeviceInfo: setDeviceInfo,
    onConnectionStatus: setConnectionStatus,
  });

  // Initialize updater hook
  const updater = useUpdater({
    serial,
    onUpdateStatus: setUpdateStatus,
    onProgress: setProgress,
    onShowProgress: setShowProgress,
    onUpdateInProgress: setUpdateInProgress,
  });

  // Wrapper functions to handle boolean return values from hooks
  const handleConnect = useCallback(async (): Promise<void> => {
    try {
      await serial.connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, [serial.connect]);

  const handleDisconnect = useCallback(async (): Promise<void> => {
    try {
      await serial.disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }, [serial.disconnect]);

  // Check browser compatibility
  const checkBrowserCompatibility = useCallback((): void => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      setConnectionStatus({
        message:
          'Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.',
        type: 'error',
      });
    }
  }, []);

  // Handle page visibility changes during updates
  const handleVisibilityChange = useCallback((): void => {
    if (document.hidden && updateInProgress) {
      console.warn('Page hidden during update - this may cause issues');

      // Optionally show a warning to the user
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('BYTE-90 Updater', {
          body: 'Update in progress - please keep this tab active',
          icon: '/favicon.ico',
        });
      }
    }
  }, [updateInProgress]);

  // Prevent accidental page closure during updates
  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent): string | void => {
      if (updateInProgress) {
        const message =
          'Firmware update is in progress. Leaving this page may interrupt the update.';
        event.preventDefault();
        event.returnValue = message; // For legacy browsers
        return message;
      }
    },
    [updateInProgress]
  );

  // Request notification permission on mount
  const requestNotificationPermission = useCallback(async (): Promise<void> => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.log('Notification permission request failed:', error);
      }
    }
  }, []);

  // Effect for browser compatibility and event listeners
  useEffect(() => {
    // Check browser compatibility on mount
    checkBrowserCompatibility();

    // Request notification permission
    requestNotificationPermission();

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    checkBrowserCompatibility,
    requestNotificationPermission,
    handleVisibilityChange,
    handleBeforeUnload,
  ]);

  // Effect to handle update progress warnings
  useEffect(() => {
    if (updateInProgress) {
      // Set page title to indicate update in progress
      const originalTitle = document.title;
      document.title = '🔄 BYTE-90 Update in Progress...';

      return () => {
        document.title = originalTitle;
      };
    }
  }, [updateInProgress]);

  return (
    <main role='main' aria-label='BYTE-90 Firmware Updater'>
      {/* Connection management section */}
      <ConnectionCard
        isConnected={isConnected}
        deviceInfo={deviceInfo}
        connectionStatus={connectionStatus}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Update section - only shown when connected */}
      {isConnected && (
        <UpdateCard
          updateInProgress={updateInProgress}
          updateStatus={updateStatus}
          progress={progress}
          showProgress={showProgress}
          onStartUpdate={updater.startUpdate}
          onAbortUpdate={updater.abortUpdate}
        />
      )}

      {/* Browser compatibility information */}
      <CompatibilityCard />

      {/* Hidden accessibility announcements */}
      <div
        className='sr-only'
        role='status'
        aria-live='polite'
        aria-atomic='true'
      >
        {updateInProgress &&
          'Firmware update in progress. Please do not close this window.'}
      </div>
    </main>
  );
};

export default App;
