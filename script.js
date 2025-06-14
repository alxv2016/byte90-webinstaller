// Serial communication constants (matching your C++ code)
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
  VALIDATE_FIRMWARE: 'VALIDATE_FIRMWARE'
};

const RESPONSE_PREFIXES = {
  OK: 'OK:',
  ERROR: 'ERROR:',
  PROGRESS: 'PROGRESS:'
};

// Optimized settings for speed and reliability
const CHUNK_SIZE = 256; // 256 bytes chunks for optimal performance
const COMMAND_TIMEOUT = 10000;
const CHUNK_TIMEOUT = 8000; // Longer timeout for larger chunks
const MAX_RETRIES = 2;

// Global state
let serialPort = null;
let reader = null;
let writer = null;
let isConnected = false;
let updateInProgress = false;
let deviceInfo = null;

// DOM elements
const elements = {};

// Utility function to safely get elements
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

// Initialize DOM elements safely
function initializeElements() {
  const elementIds = [
    'connectBtn', 'disconnectBtn', 'connectionStatus', 'deviceInfo',
    'updateSection', 'updateType', 'firmwareFile', 'uploadBtn', 'abortBtn',
    'progressContainer', 'uploadProgress', 'progressText', 'updateStatus',
    'compatibilityStatus', 'serialSupport', 'firmwareVersion', 'mcu',
    'availableSpace', 'freeHeap'
  ];

  elementIds.forEach(id => {
    elements[id] = safeGetElement(id);
  });

  const criticalElements = ['connectBtn', 'disconnectBtn', 'uploadBtn', 'abortBtn'];
  const missingCritical = criticalElements.filter(id => !elements[id]);
  
  if (missingCritical.length > 0) {
    console.error('Critical elements missing:', missingCritical);
    return false;
  }
  
  return true;
}

// Utility functions
const utils = {
  showStatus(element, message, type = 'info') {
    if (!element) return;
    
    element.textContent = message;
    element.classList.remove('status-success', 'status-warning', 'status-danger');
    
    const typeMap = {
      success: 'status-success',
      warning: 'status-warning',
      error: 'status-danger',
      danger: 'status-danger'
    };

    if (typeMap[type]) {
      element.classList.add(typeMap[type]);
    }

    element.style.display = 'block';
  },

  hideStatus(element) {
    if (!element) return;
    
    element.style.display = 'none';
    element.classList.remove('status-success', 'status-warning', 'status-danger');
  },

  updateProgress(percent, message = '') {
    if (elements.uploadProgress) {
      elements.uploadProgress.value = percent;
    }
    if (elements.progressText) {
      elements.progressText.textContent = message || `${Math.round(percent)}%`;
    }
    if (elements.progressContainer) {
      elements.progressContainer.style.display = 'block';
    }
  },

  resetProgress() {
    if (elements.uploadProgress) {
      elements.uploadProgress.value = 0;
    }
    if (elements.progressText) {
      elements.progressText.textContent = 'Ready to upload';
    }
    if (elements.progressContainer) {
      elements.progressContainer.style.display = 'none';
    }
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
};

// Serial communication functions
const serial = {
  pendingCommand: null,
  
  async connect() {
    try {
      if (!navigator.serial) {
        throw new Error('Web Serial API not supported');
      }

      serialPort = await navigator.serial.requestPort();
      
      await serialPort.open({ 
        baudRate: 230400,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });

      reader = serialPort.readable.getReader();
      writer = serialPort.writable.getWriter();

      isConnected = true;
      ui.updateConnectionState(true);

      serial.startListening();

      try {
        const info = await serial.sendCommand(SERIAL_COMMANDS.GET_INFO);
        if (info && info.success) {
          deviceInfo = info;
          ui.updateDeviceInfo(info);
        }
      } catch (error) {
        console.warn('Failed to get device info:', error);
      }

      utils.showStatus(elements.connectionStatus, 'Device connected successfully', 'success');
      
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      utils.showStatus(elements.connectionStatus, `Connection failed: ${error.message}`, 'error');
      return false;
    }
  },

  async disconnect() {
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
        reader = null;
      }

      if (writer) {
        await writer.close();
        writer = null;
      }

      if (serialPort) {
        await serialPort.close();
        serialPort = null;
      }

      isConnected = false;
      deviceInfo = null;
      ui.updateConnectionState(false);
      utils.showStatus(elements.connectionStatus, 'Device disconnected', 'warning');
      
      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  },

  async sendCommand(command, data = '', customTimeout = COMMAND_TIMEOUT) {
    if (!writer) {
      throw new Error('Not connected to device');
    }

    return new Promise((resolve, reject) => {
      const commandString = data ? `${command}:${data}\n` : `${command}\n`;
      const encoder = new TextEncoder();
      
      const timeoutMs = command === SERIAL_COMMANDS.SEND_CHUNK ? CHUNK_TIMEOUT : customTimeout;
      
      const timeout = setTimeout(() => {
        console.error(`Command timeout (${timeoutMs}ms): ${command}`);
        serial.pendingCommand = null;
        reject(new Error(`Command timeout: ${command}`));
      }, timeoutMs);

      serial.pendingCommand = (response) => {
        clearTimeout(timeout);
        if (response && response.success !== undefined) {
          resolve(response);
        } else {
          console.error(`Invalid response for ${command}:`, response);
          reject(new Error(`Invalid response for ${command}`));
        }
      };

      writer.write(encoder.encode(commandString)).catch(error => {
        clearTimeout(timeout);
        serial.pendingCommand = null;
        console.error('Write failed:', error);
        reject(error);
      });
    });
  },

  async sendCommandWithRetry(command, data = '', retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (command === SERIAL_COMMANDS.SEND_CHUNK) {
          console.log(`Sending chunk (attempt ${attempt})...`);
        } else {
          console.log(`Sending command: ${command} (attempt ${attempt})`);
        }
        
        const result = await this.sendCommand(command, data);
        
        if (command === SERIAL_COMMANDS.SEND_CHUNK) {
          console.log(`Chunk sent successfully`);
        } else {
          console.log(`Command ${command} succeeded:`, result);
        }
        
        return result;
      } catch (error) {
        console.warn(`Command ${command} attempt ${attempt} failed:`, error);
        if (attempt === retries) {
          throw error;
        }
        const retryDelay = command === SERIAL_COMMANDS.SEND_CHUNK ? 1000 : 200;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  },

  async startListening() {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (reader && isConnected) {
        const { value, done } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            serial.handleResponse(line.trim());
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Serial reading error:', error);
      }
    }
  },

  handleResponse(line) {
    console.log('Received:', line);

    let response = null;
    let isProgress = false;

    if (line.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.OK.length);
      try {
        response = JSON.parse(jsonStr);
        console.log('Parsed OK response:', response);
      } catch (e) {
        console.error('Failed to parse OK response:', jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.ERROR.length);
      try {
        response = JSON.parse(jsonStr);
        response.success = false;
        console.log('Parsed ERROR response:', response);
      } catch (e) {
        console.error('Failed to parse ERROR response:', jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.PROGRESS.length);
      try {
        response = JSON.parse(jsonStr);
        isProgress = true;
        console.log('Parsed PROGRESS response:', response);
      } catch (e) {
        console.error('Failed to parse PROGRESS response:', jsonStr, e);
        return;
      }
    } else {
      return;
    }

    if (isProgress) {
      const percent = response.progress || 0;
      const message = response.message || `${percent}%`;
      utils.updateProgress(percent, message);
      
      if (response.completed) {
        updateInProgress = false;
        if (response.success) {
          utils.showStatus(elements.updateStatus, 'Update completed successfully! Device will restart.', 'success');
          ui.updateUpdateState(false);
        } else {
          utils.showStatus(elements.updateStatus, response.message || 'Update failed', 'error');
          ui.updateUpdateState(false);
        }
      }
    } else if (serial.pendingCommand) {
      const handler = serial.pendingCommand;
      serial.pendingCommand = null;
      handler(response);
    } else {
      console.warn('Received response but no pending command:', response);
    }
  }
};

// Update functions
const updater = {
  async startUpdate() {
    const file = elements.firmwareFile?.files[0];
    const updateType = elements.updateType?.value || 'firmware';

    if (!file) {
      utils.showStatus(elements.updateStatus, 'Please select a firmware file', 'error');
      return;
    }

    if (!file.name.endsWith('.bin')) {
      utils.showStatus(elements.updateStatus, 'Please select a .bin file', 'error');
      return;
    }

    const expectedFilename = updateType === 'firmware' ? 'byte90.bin' : 'byte90animations.bin';
    if (!file.name.includes(updateType === 'firmware' ? 'byte90' : 'byte90animations')) {
      utils.showStatus(elements.updateStatus, `Please select the correct file (${expectedFilename})`, 'error');
      return;
    }

    try {
      updateInProgress = true;
      ui.updateUpdateState(true);
      utils.hideStatus(elements.updateStatus);
      utils.updateProgress(0, 'Checking device status...');

      try {
        console.log('Getting device status...');
        const statusResponse = await serial.sendCommand(SERIAL_COMMANDS.GET_STATUS);
        console.log('Device status:', statusResponse);
        
        if (statusResponse && statusResponse.update_active) {
          console.log('Device has active update, aborting...');
          await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn('Failed to get status:', error);
      }

      utils.updateProgress(1, 'Resetting device state...');

      try {
        console.log('Sending ABORT_UPDATE...');
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        console.log('Device state reset');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn('Abort command failed:', error);
      }

      utils.updateProgress(3, 'Starting new update...');

      console.log(`Starting update: ${file.size} bytes, type: ${updateType}`);
      
      const startResponse = await serial.sendCommandWithRetry(
        SERIAL_COMMANDS.START_UPDATE, 
        `${file.size},${updateType}`,
        2
      );

      console.log('Start update response:', startResponse);

      if (!startResponse || !startResponse.success) {
        throw new Error(startResponse?.message || 'START_UPDATE command failed');
      }

      if (startResponse.state !== 'RECEIVING') {
        throw new Error(`Expected RECEIVING state, got: ${startResponse.state}`);
      }

      console.log('Update started successfully, beginning file transfer...');
      utils.updateProgress(5, 'Reading firmware file...');
      
      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      
      console.log(`File read: ${arrayBuffer.byteLength} bytes in ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`);
      utils.updateProgress(10, 'Starting upload...');

      const startTime = performance.now();
      let bytesTransferred = 0;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        const base64Chunk = utils.arrayBufferToBase64(chunk);

        if (i % 20 === 0 || i === totalChunks - 1) {
          const transferProgress = 10 + ((i / totalChunks) * 80);
          const elapsed = (performance.now() - startTime) / 1000;
          const speed = bytesTransferred / elapsed || 0;
          const speedText = speed > 1024 ? 
            `${(speed / 1024).toFixed(1)} KB/s` : 
            `${speed.toFixed(0)} B/s`;
          
          utils.updateProgress(
            transferProgress, 
            `Uploading: ${Math.round(transferProgress)}% (${speedText})`
          );
          
          if (i % 50 === 0) {
            console.log(`Chunk ${i}/${totalChunks} (${transferProgress.toFixed(1)}%) - ${speedText}`);
          }
        }

        try {
          const chunkResponse = await serial.sendCommand(
            SERIAL_COMMANDS.SEND_CHUNK, 
            base64Chunk
          );
          
          if (!chunkResponse || !chunkResponse.success) {
            consecutiveErrors++;
            throw new Error(chunkResponse?.message || `Chunk ${i + 1} rejected by device`);
          }

          consecutiveErrors = 0;
          
        } catch (chunkError) {
          consecutiveErrors++;
          console.error(`Chunk ${i + 1} failed (${consecutiveErrors} consecutive errors):`, chunkError);
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Too many consecutive errors (${consecutiveErrors}). Last error: ${chunkError.message}`);
          }
          
          i--;
          continue;
        }

        bytesTransferred = end;
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const avgSpeed = arrayBuffer.byteLength / totalTime;
      console.log(`Transfer completed: ${utils.formatBytes(arrayBuffer.byteLength)} in ${totalTime.toFixed(2)}s (${utils.formatBytes(avgSpeed)}/s)`);

      utils.updateProgress(95, 'Finalizing update...');

      const finishResponse = await serial.sendCommandWithRetry(SERIAL_COMMANDS.FINISH_UPDATE);
      
      if (!finishResponse || !finishResponse.success) {
        throw new Error(finishResponse?.message || 'Failed to finish update');
      }

      utils.updateProgress(100, 'Update completed successfully!');
      utils.showStatus(elements.updateStatus, 'Update completed! Device will restart automatically.', 'success');
      updateInProgress = false;
      ui.updateUpdateState(false);

    } catch (error) {
      console.error('Update failed:', error);
      utils.showStatus(elements.updateStatus, `Update failed: ${error.message}`, 'error');
      updateInProgress = false;
      ui.updateUpdateState(false);
      
      try {
        console.log('Cleaning up after error...');
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      } catch (abortError) {
        console.warn('Failed to abort update after error:', abortError);
      }
    }
  },

  async abortUpdate() {
    try {
      await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      updateInProgress = false;
      ui.updateUpdateState(false);
      utils.resetProgress();
      utils.showStatus(elements.updateStatus, 'Update aborted', 'warning');
    } catch (error) {
      console.error('Failed to abort update:', error);
    }
  }
};

// UI management
const ui = {
  updateConnectionState(connected) {
    if (connected) {
      if (elements.connectBtn) elements.connectBtn.style.display = 'none';
      if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'inline-flex';
      if (elements.deviceInfo) elements.deviceInfo.style.display = 'block';
      if (elements.updateSection) elements.updateSection.style.display = 'block';
    } else {
      if (elements.connectBtn) elements.connectBtn.style.display = 'inline-flex';
      if (elements.disconnectBtn) elements.disconnectBtn.style.display = 'none';
      if (elements.deviceInfo) elements.deviceInfo.style.display = 'none';
      if (elements.updateSection) elements.updateSection.style.display = 'none';
      if (elements.uploadBtn) elements.uploadBtn.disabled = true;
      this.clearDeviceInfo();
    }
  },

  updateDeviceInfo(info) {
    if (info) {
      if (elements.firmwareVersion) elements.firmwareVersion.textContent = info.firmware_version || '-';
      if (elements.mcu) elements.mcu.textContent = info.mcu || '-';
      if (elements.availableSpace) elements.availableSpace.textContent = info.flash_available || '-';
      if (elements.freeHeap) elements.freeHeap.textContent = info.free_heap || '-';
    }
  },

  clearDeviceInfo() {
    if (elements.firmwareVersion) elements.firmwareVersion.textContent = '-';
    if (elements.mcu) elements.mcu.textContent = '-';
    if (elements.availableSpace) elements.availableSpace.textContent = '-';
    if (elements.freeHeap) elements.freeHeap.textContent = '-';
  },

  updateUpdateState(inProgress) {
    if (inProgress) {
      if (elements.uploadBtn) elements.uploadBtn.style.display = 'none';
      if (elements.abortBtn) elements.abortBtn.style.display = 'inline-flex';
      if (elements.firmwareFile) elements.firmwareFile.disabled = true;
      if (elements.updateType) elements.updateType.disabled = true;
    } else {
      if (elements.uploadBtn) elements.uploadBtn.style.display = 'inline-flex';
      if (elements.abortBtn) elements.abortBtn.style.display = 'none';
      if (elements.firmwareFile) elements.firmwareFile.disabled = false;
      if (elements.updateType) elements.updateType.disabled = false;
    }
  },

  checkCompatibility() {
    if ('serial' in navigator) {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = 'Supported';
        elements.serialSupport.className = 'status-badge supported';
      }
    } else {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = 'Not Supported';
        elements.serialSupport.className = 'status-badge not-supported';
      }
      
      utils.showStatus(elements.connectionStatus, 
        'Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.', 
        'error');
    }
  }
};

// Event listeners
function initializeEventListeners() {
  if (elements.connectBtn) {
    elements.connectBtn.addEventListener('click', serial.connect);
  }
  
  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener('click', serial.disconnect);
  }
  
  if (elements.uploadBtn) {
    elements.uploadBtn.addEventListener('click', updater.startUpdate);
  }
  
  if (elements.abortBtn) {
    elements.abortBtn.addEventListener('click', updater.abortUpdate);
  }

  if (elements.firmwareFile) {
    elements.firmwareFile.addEventListener('change', (e) => {
      if (elements.uploadBtn) {
        elements.uploadBtn.disabled = !e.target.files[0] || !isConnected || updateInProgress;
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && updateInProgress) {
      console.warn('Page hidden during update - this may cause issues');
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (updateInProgress) {
      e.preventDefault();
      e.returnValue = 'Firmware update in progress. Are you sure you want to leave?';
    }
  });
}

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (updateInProgress) {
    utils.showStatus(elements.updateStatus, 'An unexpected error occurred during update', 'error');
    updateInProgress = false;
    ui.updateUpdateState(false);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (updateInProgress) {
    utils.showStatus(elements.updateStatus, 'An unexpected error occurred during update', 'error');
    updateInProgress = false;
    ui.updateUpdateState(false);
  }
});

// Initialize application
function init() {
  console.log('Initializing BYTE-90 Serial Updater...');
  
  if (!initializeElements()) {
    console.error('Failed to initialize DOM elements');
    return;
  }
  
  ui.checkCompatibility();
  initializeEventListeners();
  
  ui.updateConnectionState(false);
  ui.updateUpdateState(false);
  utils.hideStatus(elements.connectionStatus);
  utils.hideStatus(elements.updateStatus);
  utils.resetProgress();
  
  console.log('BYTE-90 Serial Updater initialized successfully');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);