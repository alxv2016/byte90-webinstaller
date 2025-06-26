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

export interface SerialResponse {
  success: boolean;
  message?: string;
  state?: string;
  completed?: boolean;
  [key: string]: unknown;
}

export interface ConnectionStatus {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
