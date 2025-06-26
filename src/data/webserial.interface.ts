// Type definitions
export interface SerialConfig {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
  bufferSize?: number;
}

export interface DeviceInfo {
  success: boolean;
  current_mode: string;
  firmware_version?: string;
  mcu?: string;
  flash_available?: string;
  free_heap?: string;
  [key: string]: unknown;
}

export interface ConnectionStatus {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface UpdateStatus {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | '';
}

export interface ProgressUpdate {
  percent: number;
  message: string;
}

export interface SerialResponse {
  success: boolean;
  message?: string;
  completed?: boolean;
  update_active?: boolean;
  state?: string;
  [key: string]: unknown;
}

export interface SerialCommands {
  GET_STATUS: string;
  ABORT_UPDATE: string;
  START_UPDATE: string;
  SEND_CHUNK: string;
  FINISH_UPDATE: string;
}
