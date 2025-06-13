// Serial communication constants (matching your C++ code)
const SERIAL_COMMANDS = {
  GET_INFO: 'GET_INFO',
  GET_STATUS: 'GET_STATUS',
  START_UPDATE: 'START_UPDATE',
  SEND_CHUNK: 'SEND_CHUNK',
  FINISH_UPDATE: 'FINISH_UPDATE',
  ABORT_UPDATE: 'ABORT_UPDATE',
  RESTART: 'RESTART'
};

const RESPONSE_PREFIXES = {
  OK: 'OK:',
  ERROR: 'ERROR:',
  PROGRESS: 'PROGRESS:'
};

const CHUNK_SIZE = 128; // Back to larger chunks with higher baud rate
const COMMAND_TIMEOUT = 15000; // Increased to 15 seconds - device is working but needs more time
const MAX_RETRIES = 3; // Retry failed chunks
const PROGRESS_UPDATE_INTERVAL = 50; // Update progress every 50 chunks (more frequent with fewer total chunks)

// Global state
let serialPort = null;
let reader = null;
let writer = null;
let isConnected = false;
let updateInProgress = false;
let deviceInfo = null;

// DOM elements
const elements = {
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  connectionStatus: document.getElementById('connectionStatus'),
  deviceInfo: document.getElementById('deviceInfo'),
  updateSection: document.getElementById('updateSection'),
  updateType: document.getElementById('updateType'),
  firmwareFile: document.getElementById('firmwareFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  showSerialUpdate: document.getElementById('showSerialUpdate'),
  serialUpdateSection: document.getElementById('serialUpdateSection'),
  abortBtn: document.getElementById('abortBtn'),
  progressContainer: document.getElementById('progressContainer'),
  uploadProgress: document.getElementById('uploadProgress'),
  progressText: document.getElementById('progressText'),
  updateStatus: document.getElementById('updateStatus'),
  compatibilityStatus: document.getElementById('compatibilityStatus'),
  serialSupport: document.getElementById('serialSupport'),
  firmwareVersion: document.getElementById('firmwareVersion'),
  chipModel: document.getElementById('chipModel'),
  currentMode: document.getElementById('currentMode'),
  freeHeap: document.getElementById('freeHeap')
};

// Utility functions
const utils = {
  showStatus(element, message, type = 'info') {
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
    element.style.display = 'none';
    element.classList.remove('status-success', 'status-warning', 'status-danger');
  },

  updateProgress(percent, message = '') {
    elements.uploadProgress.value = percent;
    elements.progressText.textContent = message || `${Math.round(percent)}%`;
  },

  resetProgress() {
    elements.uploadProgress.value = 0;
    elements.progressText.textContent = 'Ready to upload';
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  stringToBase64(str) {
    return btoa(str);
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
  // In the serial.connect() function, update the baud rate:
async connect() {
  try {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported');
    }

    // Request port
    serialPort = await navigator.serial.requestPort();
    
    // Open port with matching baud rate from ESP32 (921600)
    await serialPort.open({ 
      baudRate: 921600,  // Changed from 115200 to match ESP32_BAUD_RATE
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none'  // Add this for better reliability
    });

    // Set up reader and writer
    reader = serialPort.readable.getReader();
    writer = serialPort.writable.getWriter();

    isConnected = true;
    ui.updateConnectionState(true);

    // Start listening for responses
    serial.startListening();

    // Get device info
    const info = await serial.sendCommand(SERIAL_COMMANDS.GET_INFO);
    if (info && info.success) {
      deviceInfo = info;
      ui.updateDeviceInfo(info);
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

  async sendCommand(command, data = '') {
    if (!writer) {
      throw new Error('Not connected to device');
    }

    const commandString = data ? `${command}:${data}\n` : `${command}\n`;
    const encoder = new TextEncoder();
    
    console.log('Sending command:', command, 'data length:', data.length);
    
    try {
      // For large chunks, ensure we write it all at once
      const encodedData = encoder.encode(commandString);
      console.log('Encoded command length:', encodedData.length);
      
      await writer.write(encodedData);
      
      // Add a small delay to ensure the command is fully transmitted
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('Command sent successfully');
      
      // Wait for response with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('Command timed out after', COMMAND_TIMEOUT, 'ms');
          serial.pendingCommand = null;
          reject(new Error('Command timeout'));
        }, COMMAND_TIMEOUT);

        const handleResponse = (response) => {
          console.log('Command response received:', response);
          clearTimeout(timeout);
          resolve(response);
        };

        // Store the resolve function for the response handler
        serial.pendingCommand = handleResponse;
      });
    } catch (error) {
      console.error('Send command failed:', error);
      throw error;
    }
  },

  async startListening() {
    const decoder = new TextDecoder();
    let buffer = '';

    console.log('Starting to listen for serial data...');

    try {
      while (reader && isConnected) {
        const { value, done } = await reader.read();
        
        if (done) {
          console.log('Serial reader done');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('Raw serial chunk received:', JSON.stringify(chunk));
        
        buffer += chunk;
        
        // Process complete lines
        let lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            console.log('Processing line:', JSON.stringify(line.trim()));
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
    console.log('Raw received:', line);

    // Ignore ESP32 log messages (they start with timestamps like [471306])
    // BUT allow command responses that start with OK:, ERROR:, PROGRESS:
    if (line.match(/^\[\d+\]/) && !line.includes('OK:') && !line.includes('ERROR:') && !line.includes('PROGRESS:')) {
      console.log('Ignoring ESP32 log message');
      return;
    }

    // Look for command responses that might be embedded in log messages
    let actualResponse = line;
    
    // If line contains OK:, ERROR:, or PROGRESS:, extract that part
    const okMatch = line.match(/OK:(\{.*\})/);
    const errorMatch = line.match(/ERROR:(\{.*\})/);
    const progressMatch = line.match(/PROGRESS:(\{.*\})/);
    
    if (okMatch) {
      actualResponse = 'OK:' + okMatch[1];
      console.log('Extracted OK response:', actualResponse);
    } else if (errorMatch) {
      actualResponse = 'ERROR:' + errorMatch[1];
      console.log('Extracted ERROR response:', actualResponse);
    } else if (progressMatch) {
      actualResponse = 'PROGRESS:' + progressMatch[1];
      console.log('Extracted PROGRESS response:', actualResponse);
    } else if (!line.startsWith('OK:') && !line.startsWith('ERROR:') && !line.startsWith('PROGRESS:')) {
      console.log('Ignoring non-command response');
      return;
    }

    let response = null;
    let isProgress = false;

    // Parse response based on prefix
    if (actualResponse.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = actualResponse.substring(RESPONSE_PREFIXES.OK.length);
      console.log('OK JSON:', jsonStr);
      try {
        response = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse OK response:', e, 'Raw:', jsonStr);
        return;
      }
    } else if (actualResponse.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = actualResponse.substring(RESPONSE_PREFIXES.ERROR.length);
      console.log('ERROR JSON:', jsonStr);
      try {
        response = JSON.parse(jsonStr);
        response.success = false;
      } catch (e) {
        console.error('Failed to parse ERROR response:', e, 'Raw:', jsonStr);
        return;
      }
    } else if (actualResponse.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = actualResponse.substring(RESPONSE_PREFIXES.PROGRESS.length);
      console.log('PROGRESS JSON:', jsonStr);
      try {
        response = JSON.parse(jsonStr);
        isProgress = true;
      } catch (e) {
        console.error('Failed to parse PROGRESS response:', e, 'Raw:', jsonStr);
        return;
      }
    } else {
      // Log any unrecognized responses that aren't ESP32 logs
      console.log('Unrecognized response format:', actualResponse);
      return;
    }

    if (isProgress) {
      // Handle progress updates
      const percent = response.progress || 0;
      const message = response.message || `${percent}%`;
      
      console.log('Progress update received:', percent, message);
      utils.updateProgress(percent, message);
      
      // Force show progress container
      elements.progressContainer.style.display = 'block';
      
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
      
      // IMPORTANT: Also resolve pending commands for chunk responses
      if (serial.pendingCommand && response.state === 'RECEIVING') {
        console.log('Resolving pending command with progress response');
        const handler = serial.pendingCommand;
        serial.pendingCommand = null;
        handler(response); // Treat PROGRESS as successful chunk response
      }
    } else if (serial.pendingCommand) {
      // Handle command responses
      const handler = serial.pendingCommand;
      serial.pendingCommand = null;
      handler(response);
    }
  },

  pendingCommand: null
};

// Update functions
// Update functions
const updater = {
  async startUpdate() {
    const file = elements.firmwareFile.files[0];
    const updateType = elements.updateType.value;

    if (!file) {
      utils.showStatus(elements.updateStatus, 'Please select a firmware file', 'error');
      return;
    }

    if (!file.name.endsWith('.bin')) {
      utils.showStatus(elements.updateStatus, 'Please select a .bin file', 'error');
      return;
    }

    // Validate file type based on selection
    const expectedFilename = updateType === 'firmware' ? 'byte90.bin' : 'byte90animations.bin';
    if (!file.name.includes(updateType === 'firmware' ? 'byte90' : 'byte90animations')) {
      utils.showStatus(elements.updateStatus, `Please select the correct file (${expectedFilename})`, 'error');
      return;
    }

    try {
      updateInProgress = true;
      ui.updateUpdateState(true);
      utils.hideStatus(elements.updateStatus);
      utils.updateProgress(0, 'Initializing update...');

      // Start update
      const startResponse = await serial.sendCommandWithRetry(
        SERIAL_COMMANDS.START_UPDATE, 
        `${file.size},${updateType}`
      );

      if (!startResponse || !startResponse.success) {
        throw new Error(startResponse?.message || 'Failed to start update');
      }

      utils.updateProgress(5, 'Reading firmware file...');

      // Read file and send in chunks
      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      
      utils.updateProgress(10, 'Starting upload...');

      // Track timing for debugging
      const startTime = performance.now();
      let bytesTransferred = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        const base64Chunk = utils.arrayBufferToBase64(chunk);

        // Add progress indicator for large files
        if (i % 10 === 0) {
          const transferProgress = 10 + ((i / totalChunks) * 80); // 10-90% range
          const elapsed = (performance.now() - startTime) / 1000;
          const speed = bytesTransferred / elapsed;
          const speedText = speed > 1024 ? 
            `${(speed / 1024).toFixed(1)} KB/s` : 
            `${speed.toFixed(0)} B/s`;
          
          utils.updateProgress(
            transferProgress, 
            `Uploading: ${Math.round(transferProgress)}% (${speedText})`
          );
        }

        const chunkResponse = await serial.sendCommandWithRetry(
          SERIAL_COMMANDS.SEND_CHUNK, 
          base64Chunk
        );
        
        if (!chunkResponse || !chunkResponse.success) {
          throw new Error(chunkResponse?.message || `Failed to send chunk ${i + 1}`);
        }

        bytesTransferred = end;
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const avgSpeed = arrayBuffer.byteLength / totalTime;
      console.log(`Transfer completed: ${utils.formatBytes(arrayBuffer.byteLength)} in ${totalTime.toFixed(2)}s (${utils.formatBytes(avgSpeed)}/s)`);

      utils.updateProgress(95, 'Finalizing update...');

      // Finish update
      const finishResponse = await serial.sendCommandWithRetry(SERIAL_COMMANDS.FINISH_UPDATE);
      
      if (!finishResponse || !finishResponse.success) {
        throw new Error(finishResponse?.message || 'Failed to finish update');
      }

      utils.updateProgress(100, 'Update completed successfully!');
      utils.showStatus(elements.updateStatus, 'Update completed! Device will restart automatically.', 'success');

    } catch (error) {
      console.error('Update failed:', error);
      utils.showStatus(elements.updateStatus, `Update failed: ${error.message}`, 'error');
      updateInProgress = false;
      ui.updateUpdateState(false);
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
      elements.connectBtn.style.display = 'none';
      elements.disconnectBtn.style.display = 'inline-flex';
      elements.deviceInfo.style.display = 'block';
      elements.updateSection.style.display = 'block';
    } else {
      elements.connectBtn.style.display = 'inline-flex';
      elements.disconnectBtn.style.display = 'none';
      elements.deviceInfo.style.display = 'none';
      elements.updateSection.style.display = 'none';
      elements.uploadBtn.disabled = true;
      this.clearDeviceInfo();
    }
  },

  updateDeviceInfo(info) {
    if (info) {
      elements.firmwareVersion.textContent = info.firmware_version || '-';
      elements.chipModel.textContent = info.chip_model || '-';
      elements.currentMode.textContent = info.current_mode || '-';
      elements.freeHeap.textContent = info.free_heap ? utils.formatBytes(info.free_heap) : '-';
    }
  },

  clearDeviceInfo() {
    elements.firmwareVersion.textContent = '-';
    elements.chipModel.textContent = '-';
    elements.currentMode.textContent = '-';
    elements.freeHeap.textContent = '-';
  },

  updateUpdateState(inProgress) {
    if (inProgress) {
      elements.uploadBtn.style.display = 'none';
      elements.abortBtn.style.display = 'inline-flex';
      elements.firmwareFile.disabled = true;
      elements.updateType.disabled = true;
    } else {
      elements.uploadBtn.style.display = 'inline-flex';
      elements.abortBtn.style.display = 'none';
      elements.firmwareFile.disabled = false;
      elements.updateType.disabled = false;
    }
  },

  checkCompatibility() {
    if ('serial' in navigator) {
      elements.serialSupport.textContent = 'Supported';
      elements.serialSupport.className = 'status-badge supported';
    } else {
      elements.serialSupport.textContent = 'Not Supported';
      elements.serialSupport.className = 'status-badge not-supported';
      
      utils.showStatus(elements.connectionStatus, 
        'Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.', 
        'error');
    }
  }
};

// Event listeners
function initializeEventListeners() {
  elements.showSerialUpdate.addEventListener('click', () => {
    elements.serialUpdateSection.style.display = 'block';
    elements.showSerialUpdate.textContent = 'Hide Serial Update';
    elements.showSerialUpdate.onclick = () => {
      elements.serialUpdateSection.style.display = 'none';
      elements.showSerialUpdate.textContent = 'Use Serial Update';
      elements.showSerialUpdate.onclick = arguments.callee.bind(elements.showSerialUpdate);
    };
  });

  elements.connectBtn.addEventListener('click', serial.connect);
  elements.disconnectBtn.addEventListener('click', serial.disconnect);
  elements.uploadBtn.addEventListener('click', updater.startUpdate);
  elements.abortBtn.addEventListener('click', updater.abortUpdate);

  // Enable upload button when file is selected
  elements.firmwareFile.addEventListener('change', (e) => {
    elements.uploadBtn.disabled = !e.target.files[0] || !isConnected || updateInProgress;
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && updateInProgress) {
      console.warn('Page hidden during update - this may cause issues');
    }
  });

  // Handle page unload
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
  ui.checkCompatibility();
  initializeEventListeners();
  
  // Initial state
  ui.updateConnectionState(false);
  ui.updateUpdateState(false);
  utils.hideStatus(elements.connectionStatus);
  utils.hideStatus(elements.updateStatus);
  
  console.log('BYTE-90 Serial Updater initialized');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);