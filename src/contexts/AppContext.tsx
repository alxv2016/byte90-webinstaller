import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { useSerial } from '../hooks/useSerial';
import { useUpdater } from '../hooks/useUpdater';
import type {
  DeviceInfo,
  StatusMessage,
  ProgressUpdate,
  UpdateType,
  UseSerialReturn,
  Network,
  WiFiStatus,
} from '../data/webserial.interface';

// Context state interface
interface AppState {
  // Connection state
  isConnected: boolean;
  deviceInfo: DeviceInfo | null;
  connectionStatus: StatusMessage;

  // Update state
  updateInProgress: boolean;
  updateStatus: StatusMessage;
  progress: ProgressUpdate;
  showProgress: boolean;

  // Drawer state
  isWiFiDrawerOpen: boolean;
  isFirmwareDrawerOpen: boolean;
  isWiFiDrawerClosing: boolean;
  isFirmwareDrawerClosing: boolean;

  // WiFi Networks state
  isNetworksDrawerOpen: boolean;
  isNestedDrawerClosing: boolean;
  networks: Network[];
  isScanning: boolean;
  scanStatus: { message: string; type: string };
  selectedNetwork: string;
  isCurrentlyConnected: boolean;

  // WiFi Connection state
  password: string;
  isPasswordVisible: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connectedNetwork: string;
  isCheckingStatus: boolean;
}

// Context actions interface
interface AppActions {
  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // Update actions
  startUpdate: (file: File, updateType: UpdateType) => Promise<void>;
  abortUpdate: () => Promise<void>;

  // Drawer actions
  closeWiFiDrawer: () => void;
  closeFirmwareDrawer: () => void;
  handleWiFiDrawerChange: (open: boolean) => void;
  handleFirmwareDrawerChange: (open: boolean) => void;
  handleWiFiDrawerAnimationEnd: () => void;
  handleFirmwareDrawerAnimationEnd: () => void;

  // WiFi Networks actions
  openNetworksDrawer: () => void;
  closeNetworksDrawer: () => void;
  scanNetworks: () => Promise<void>;
  handleNetworkSelect: (ssid: string) => void;

  // WiFi Connection actions
  setPassword: (password: string) => void;
  togglePasswordVisibility: () => void;
  connectToNetwork: () => Promise<void>;
  disconnectFromNetwork: () => Promise<void>;
  checkWiFiStatus: () => Promise<void>;

  // Serial instance
  serial: UseSerialReturn;
}

// Combined context interface
interface AppContextType extends AppState, AppActions {}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider props interface
interface AppProviderProps {
  children: ReactNode;
}

// Provider component
export function AppProvider({ children }: AppProviderProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<StatusMessage>({
    message: '',
    type: '',
  });

  // Update state
  const [updateInProgress, setUpdateInProgress] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<StatusMessage>({
    message: '',
    type: '',
  });
  const [progress, setProgress] = useState<ProgressUpdate>({
    percent: 0,
    message: 'Ready to upload',
  });
  const [showProgress, setShowProgress] = useState<boolean>(false);

  // Drawer state
  const [isWiFiDrawerOpen, setIsWiFiDrawerOpen] = useState(false);
  const [isFirmwareDrawerOpen, setIsFirmwareDrawerOpen] = useState(false);
  const [isWiFiDrawerClosing, setIsWiFiDrawerClosing] = useState(false);
  const [isFirmwareDrawerClosing, setIsFirmwareDrawerClosing] = useState(false);

  // WiFi Networks state
  const [isNetworksDrawerOpen, setIsNetworksDrawerOpen] = useState(false);
  const [isNestedDrawerClosing, setIsNestedDrawerClosing] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<{
    message: string;
    type: string;
  }>({
    message: '',
    type: '',
  });
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [isCurrentlyConnected, setIsCurrentlyConnected] = useState(false);

  // WiFi Connection state
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectedNetwork, setConnectedNetwork] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Initialize serial hook
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

  // Connection actions
  const connect = useCallback(async (): Promise<void> => {
    try {
      await serial.connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, [serial.connect]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await serial.disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }, [serial.disconnect]);

  // Update actions
  const startUpdate = useCallback(
    async (file: File, updateType: UpdateType): Promise<void> => {
      await updater.startUpdate(file, updateType);
    },
    [updater.startUpdate]
  );

  const abortUpdate = useCallback(async (): Promise<void> => {
    await updater.abortUpdate();
  }, [updater.abortUpdate]);

  const closeWiFiDrawer = useCallback(() => {
    setIsWiFiDrawerOpen(false);
  }, []);

  const closeFirmwareDrawer = useCallback(() => {
    setIsFirmwareDrawerOpen(false);
  }, []);

  const handleWiFiDrawerChange = useCallback((open: boolean) => {
    console.log('WiFi Drawer Change:', open);
    setIsWiFiDrawerOpen(open);
    if (open) {
      setIsWiFiDrawerClosing(false);
    } else {
      console.log('WiFi Drawer closing - waiting for animation end');
      setIsWiFiDrawerClosing(true);
    }
  }, []);

  const handleFirmwareDrawerChange = useCallback((open: boolean) => {
    console.log('Firmware Drawer Change:', open);
    setIsFirmwareDrawerOpen(open);
    if (open) {
      setIsFirmwareDrawerClosing(false);
    } else {
      console.log('Firmware Drawer closing - waiting for animation end');
      setIsFirmwareDrawerClosing(true);
    }
  }, []);

  const handleWiFiDrawerAnimationEnd = useCallback(() => {
    console.log(
      'WiFi Drawer Animation End - isClosing:',
      isWiFiDrawerClosing,
      'isOpen:',
      isWiFiDrawerOpen
    );
    // Reset closing flag when animation ends
    if (isWiFiDrawerClosing && !isWiFiDrawerOpen) {
      console.log('WiFi Drawer animation completed');
      setIsWiFiDrawerClosing(false);
    }
  }, [isWiFiDrawerClosing, isWiFiDrawerOpen]);

  const handleFirmwareDrawerAnimationEnd = useCallback(() => {
    console.log(
      'Firmware Drawer Animation End - isClosing:',
      isFirmwareDrawerClosing,
      'isOpen:',
      isFirmwareDrawerOpen
    );
    // Reset closing flag when animation ends
    if (isFirmwareDrawerClosing && !isFirmwareDrawerOpen) {
      console.log('Firmware Drawer animation completed');
      setIsFirmwareDrawerClosing(false);
    }
  }, [isFirmwareDrawerClosing, isFirmwareDrawerOpen]);

  // WiFi Networks actions
  const openNetworksDrawer = useCallback(() => {
    console.log('Opening networks drawer');
    setIsNestedDrawerClosing(false);
    setIsNetworksDrawerOpen(true);
  }, []);

  const closeNetworksDrawer = useCallback(() => {
    if (!isNestedDrawerClosing) {
      setIsNestedDrawerClosing(true);
      setTimeout(() => {
        setIsNetworksDrawerOpen(false);
        setIsNestedDrawerClosing(false);
      }, 300);
    }
  }, [isNestedDrawerClosing]);

  const scanNetworks = useCallback(async (): Promise<void> => {
    if (!serial.isConnected || isScanning) return;

    setIsScanning(true);
    setScanStatus({
      message: 'Scanning for networks...',
      type: 'info',
    });

    try {
      const response = await serial.sendCommand('WIFI_SCAN');
      const parsedResponse = response as unknown as any;

      if (parsedResponse.success && parsedResponse.networks) {
        const sortedNetworks = [...parsedResponse.networks].sort(
          (a, b) => b.rssi - a.rssi
        );
        setNetworks(sortedNetworks);
        setScanStatus({
          message: `Found ${sortedNetworks.length} networks`,
          type: 'success',
        });
      } else {
        setScanStatus({
          message: parsedResponse.message || 'No networks found',
          type: 'warning',
        });
      }
    } catch (error) {
      setScanStatus({
        message: 'Failed to scan networks. Check device connection.',
        type: 'error',
      });
    } finally {
      setIsScanning(false);
    }
  }, [serial, isScanning]);

  const handleNetworkSelect = useCallback(
    (ssid: string) => {
      setSelectedNetwork(ssid);
      closeNetworksDrawer();
    },
    [closeNetworksDrawer]
  );

  // WiFi Connection actions
  const setPasswordAction = useCallback((newPassword: string) => {
    setPassword(newPassword);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible(!isPasswordVisible);
  }, [isPasswordVisible]);

  const connectToNetwork = useCallback(async (): Promise<void> => {
    if (!selectedNetwork.trim()) {
      setScanStatus({
        message: 'Please select a network first',
        type: 'error',
      });
      return;
    }

    if (!password.trim()) {
      setScanStatus({
        message: 'Please enter a password',
        type: 'error',
      });
      return;
    }

    setIsConnecting(true);
    setScanStatus({
      message: `Attempting to connect to ${selectedNetwork}...`,
      type: 'info',
    });

    try {
      const connectData = `${selectedNetwork},${password}`;
      console.log(`Attempting to connect to network: ${selectedNetwork}`);

      const response = await serial.sendCommand('WIFI_CONNECT', connectData);
      console.log('WiFi Connect Response:', response);

      let isSuccess = false;
      let message = '';

      if (response && typeof response === 'object' && 'success' in response) {
        isSuccess = response.success === true;
        message = response.message || '';
      } else {
        isSuccess = false;
        message = `Unexpected response format: ${JSON.stringify(response)}`;
      }

      if (isSuccess) {
        console.log(`Successfully connected to ${selectedNetwork}`);
        setConnectedNetwork(selectedNetwork);
        setIsCurrentlyConnected(true);
        setScanStatus({
          message: `Successfully connected to ${selectedNetwork}`,
          type: 'success',
        });
        setPassword('');
      } else {
        console.log(`Failed to connect to ${selectedNetwork}: ${message}`);
        setScanStatus({
          message: `Failed to connect: ${message}`,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('WiFi connection error:', error);
      setScanStatus({
        message: 'Connection failed. Please try again.',
        type: 'error',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [selectedNetwork, password, serial]);

  const disconnectFromNetwork = useCallback(async (): Promise<void> => {
    setIsDisconnecting(true);
    setScanStatus({
      message: 'Disconnecting from network...',
      type: 'info',
    });

    try {
      const response = await serial.sendCommand('WIFI_DISCONNECT');
      console.log('WiFi Disconnect Response:', response);

      let isSuccess = false;
      let message = '';

      if (response && typeof response === 'object' && 'success' in response) {
        isSuccess = response.success === true;
        message = response.message || '';
      } else {
        isSuccess = false;
        message = `Unexpected response format: ${JSON.stringify(response)}`;
      }

      if (isSuccess) {
        console.log('Successfully disconnected from WiFi');
        setConnectedNetwork('');
        setIsCurrentlyConnected(false);
        setSelectedNetwork('');
        setScanStatus({
          message: 'Successfully disconnected from WiFi',
          type: 'success',
        });
      } else {
        console.log(`Failed to disconnect: ${message}`);
        setScanStatus({
          message: `Failed to disconnect: ${message}`,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('WiFi disconnect error:', error);
      setScanStatus({
        message: 'Disconnect failed. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDisconnecting(false);
    }
  }, [serial]);

  const checkWiFiStatus = useCallback(async (): Promise<void> => {
    setIsCheckingStatus(true);
    setScanStatus({
      message: 'Checking WiFi status...',
      type: 'info',
    });

    try {
      const response = await serial.sendCommand('WIFI_STATUS');
      console.log('WiFi Status Response:', response);

      if (response && typeof response === 'object' && 'success' in response) {
        const wifiStatus = response as unknown as any;
        if (wifiStatus.success) {
          if (wifiStatus.connected) {
            setConnectedNetwork(wifiStatus.ssid || '');
            setIsCurrentlyConnected(true);
            setScanStatus({
              message: `Connected to: ${wifiStatus.ssid}`,
              type: 'success',
            });
          } else {
            setConnectedNetwork('');
            setIsCurrentlyConnected(false);
            setScanStatus({
              message: 'Not connected to any network',
              type: 'info',
            });
          }
        } else {
          setScanStatus({
            message: wifiStatus.message || 'Failed to check WiFi status',
            type: 'error',
          });
        }
      } else {
        setScanStatus({
          message: 'Invalid response format',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('WiFi status check error:', error);
      setScanStatus({
        message: 'Failed to check WiFi status',
        type: 'error',
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [serial]);

  // Check browser compatibility
  const checkBrowserCompatibility = useCallback((): void => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      setConnectionStatus({
        message:
          'Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.',
        type: 'error',
      });
    }
  }, [setConnectionStatus]);

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
      document.title = 'BYTE-90 Update in Progress...';

      return () => {
        document.title = originalTitle;
      };
    }
  }, [updateInProgress]);

  // Context value
  const contextValue: AppContextType = {
    // State
    isConnected,
    deviceInfo,
    connectionStatus,
    updateInProgress,
    updateStatus,
    progress,
    showProgress,
    isWiFiDrawerOpen,
    isFirmwareDrawerOpen,
    isWiFiDrawerClosing,
    isFirmwareDrawerClosing,

    // WiFi Networks state
    isNetworksDrawerOpen,
    isNestedDrawerClosing,
    networks,
    isScanning,
    scanStatus,
    selectedNetwork,
    isCurrentlyConnected,

    // WiFi Connection state
    password,
    isPasswordVisible,
    isConnecting,
    isDisconnecting,
    connectedNetwork,
    isCheckingStatus,

    // Actions
    connect,
    disconnect,
    startUpdate,
    abortUpdate,
    closeWiFiDrawer,
    closeFirmwareDrawer,
    handleWiFiDrawerChange,
    handleFirmwareDrawerChange,
    handleWiFiDrawerAnimationEnd,
    handleFirmwareDrawerAnimationEnd,

    // WiFi Networks actions
    openNetworksDrawer,
    closeNetworksDrawer,
    scanNetworks,
    handleNetworkSelect,

    // WiFi Connection actions
    setPassword: setPasswordAction,
    togglePasswordVisibility,
    connectToNetwork,
    disconnectFromNetwork,
    checkWiFiStatus,

    serial,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}

// Custom hook to use the context
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
