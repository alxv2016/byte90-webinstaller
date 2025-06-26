// Central type definitions for BYTE-90 Firmware Updater

// Serial configuration types
export interface SerialConfig {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
  bufferSize?: number;
}

// Status and notification types
export type StatusType = 'info' | 'success' | 'warning' | 'error' | 'danger';
export type StatusTypeWithEmpty = StatusType | '';

// Device information interface
export interface DeviceInfo {
  success: boolean;
  current_mode: string;
  firmware_version?: string;
  mcu?: string;
  flash_available?: string;
  free_heap?: string;
  [key: string]: unknown;
}

// Status message interface (used for both connection and update status)
export interface StatusMessage {
  message: string;
  type: StatusTypeWithEmpty;
}

// Legacy alias for backward compatibility
export interface ConnectionStatus extends StatusMessage {}
export interface UpdateStatus extends StatusMessage {}

// Progress tracking interface
export interface ProgressUpdate {
  percent: number;
  message: string;
}

// Update types
export type UpdateType = 'firmware' | 'filesystem';

// Serial communication types
export interface SerialResponse {
  success: boolean;
  message?: string;
  completed?: boolean;
  update_active?: boolean;
  state?: string;
  [key: string]: unknown;
}

// Serial Commands interface (matching your actual hook implementation)
export interface SerialCommands {
  GET_INFO: string;
  GET_STATUS: string;
  START_UPDATE: string;
  SEND_CHUNK: string;
  FINISH_UPDATE: string;
  ABORT_UPDATE: string;
  RESTART: string;
  ROLLBACK: string;
  GET_PARTITION_INFO: string;
  GET_STORAGE_INFO: string;
  VALIDATE_FIRMWARE: string;
}

// Hook interfaces
export interface UseSerialProps {
  onConnectionChange: (connected: boolean) => void;
  onDeviceInfo: (info: DeviceInfo | null) => void;
  onConnectionStatus: (status: StatusMessage) => void;
}

export interface UseSerialReturn {
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
  SERIAL_COMMANDS: SerialCommands;
}

export interface UseUpdaterProps {
  serial: UseSerialReturn;
  onUpdateStatus: (status: StatusMessage) => void;
  onProgress: (progress: ProgressUpdate) => void;
  onShowProgress: (show: boolean) => void;
  onUpdateInProgress: (inProgress: boolean) => void;
}

export interface UseUpdaterReturn {
  startUpdate: (file: File, updateType: UpdateType) => Promise<void>;
  abortUpdate: () => Promise<void>;
}

// Browser compatibility types
export interface BrowserInfo {
  name: string;
  version?: string;
  supported: boolean;
}

// Component prop types
export interface ConnectionCardProps {
  isConnected: boolean;
  deviceInfo: DeviceInfo | null;
  connectionStatus: StatusMessage;
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
}

export interface UpdateCardProps {
  updateInProgress: boolean;
  updateStatus: StatusMessage;
  progress: ProgressUpdate;
  showProgress: boolean;
  onStartUpdate: (file: File, updateType: UpdateType) => void | Promise<void>;
  onAbortUpdate: () => void | Promise<void>;
}

export interface StatusNotificationProps {
  message: string;
  type: StatusType | '';
  className?: string;
  role?: 'alert' | 'status' | 'none';
  'aria-live'?: 'polite' | 'assertive' | 'off';
}

export interface CompatibilityCardProps {
  className?: string;
  showDetails?: boolean;
}
