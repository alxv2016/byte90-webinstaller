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
  async connect() {
    try {
      if (!navigator.serial) {
        throw new Error('Web Serial API not supported');
      }

      utils.showStatus(elements.connectionStatus, 'Requesting serial port...', 'warning');

      // Request port
      serialPort = await navigator.serial.requestPort();
      
      utils.showStatus(elements.connectionStatus, 'Opening serial connection...', 'warning');
      
      // Open port with even higher baud rate
      await serialPort.open({ 
        baudRate: 921600, // Even faster - 2x the current speed
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
        flowControl: 'none'
      });

      console.log('Serial port opened successfully');
      utils.showStatus(elements.connectionStatus, 'Serial port opened, setting up communication...', 'warning');

      // Set up reader and writer
      reader = serialPort.readable.getReader();
      writer = serialPort.writable.getWriter();

      isConnected = true;
      ui.updateConnectionState(true);

      // Start listening for responses
      serial.startListening();

      // Wait a moment for device to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      utils.showStatus(elements.connectionStatus, 'Testing device communication...', 'warning');

      // First, try to abort any existing update to ensure clean state
      try {
        console.log('Sending abort command to ensure clean state...');
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (abortError) {
        console.log('Abort command failed (this is normal if no update was in progress):', abortError.message);
      }

      utils.showStatus(elements.connectionStatus, 'Getting device information...', 'warning');

      // Get device info with longer timeout for initial connection
      try {
        const info = await serial.sendCommand(SERIAL_COMMANDS.GET_INFO);
        if (info && info.success) {
          deviceInfo = info;
          ui.updateDeviceInfo(info);
          utils.showStatus(elements.connectionStatus, 'Device connected successfully', 'success');
        } else {
          console.error('Device info request failed:', info);
          utils.showStatus(elements.connectionStatus, 'Connected but device did not respond properly. Check if device is in UPDATE_MODE.', 'warning');
        }
      } catch (infoError) {
        console.error('Failed to get device info:', infoError);
        utils.showStatus(elements.connectionStatus, 'Connected but device not responding. Ensure device is in UPDATE_MODE and serial is initialized.', 'warning');
      }
      
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      if (error.message.includes('timeout')) {
        utils.showStatus(elements.connectionStatus, 'Connection timeout - ensure device is in UPDATE_MODE and not connected to other software', 'error');
      } else {
        utils.showStatus(elements.connectionStatus, `Connection failed: ${error.message}`, 'error');
      }
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
const updater = {
  startTime: null,

  calculateETA(currentChunk, totalChunks, currentTime) {
    if (!this.startTime) {
      this.startTime = currentTime;
      return '';
    }

    const elapsed = (currentTime - this.startTime) / 1000; // seconds
    const rate = currentChunk / elapsed; // chunks per second
    const remaining = totalChunks - currentChunk;
    const eta = remaining / rate; // seconds

    if (eta > 60) {
      return `ETA: ${Math.round(eta / 60)}m`;
    } else {
      return `ETA: ${Math.round(eta)}s`;
    }
  },
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
      // First, try to abort any existing update
      console.log('Sending abort command to ensure clean state...');
      try {
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for abort to complete
      } catch (abortError) {
        console.log('Abort command failed (this is normal if no update was in progress):', abortError.message);
      }

      updateInProgress = true;
      ui.updateUpdateState(true);
      utils.hideStatus(elements.updateStatus);
      utils.updateProgress(0, 'Initializing update...');

      // Start update
      const startResponse = await serial.sendCommand(
        SERIAL_COMMANDS.START_UPDATE, 
        `${file.size},${updateType}`
      );

      if (!startResponse || !startResponse.success) {
        throw new Error(startResponse?.message || 'Failed to start update');
      }

      utils.updateProgress(0, 'Uploading firmware...');
      // Force show the progress bar
      elements.progressContainer.style.display = 'block';

      // Read file and send in chunks with retry logic
      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      
      console.log(`Starting firmware upload: ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`);
      utils.showStatus(elements.updateStatus, `Preparing to send ${totalChunks.toLocaleString()} chunks...`, 'warning');
      
      let successfulChunks = 0;
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        const base64Chunk = utils.arrayBufferToBase64(chunk);

        let chunkSuccess = false;
        let retryCount = 0;

        // Retry logic for each chunk
        while (!chunkSuccess && retryCount < MAX_RETRIES) {
          try {
            if (retryCount > 0) {
              console.log(`Retrying chunk ${i + 1}/${totalChunks}, attempt ${retryCount + 1}`);
            }

            const chunkResponse = await serial.sendCommand(SERIAL_COMMANDS.SEND_CHUNK, base64Chunk);
            
            if (chunkResponse && chunkResponse.success) {
              chunkSuccess = true;
              successfulChunks++;
            } else {
              throw new Error(chunkResponse?.message || 'Chunk rejected by device');
            }
          } catch (chunkError) {
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
              throw new Error(`Chunk ${i + 1} failed after ${MAX_RETRIES} attempts: ${chunkError.message}`);
            }
            
            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Update progress less frequently to avoid spam
        if (i % PROGRESS_UPDATE_INTERVAL === 0 || i === totalChunks - 1) {
          const progress = ((i + 1) / totalChunks) * 90; // Reserve 10% for finalization
          const eta = updater.calculateETA(i + 1, totalChunks, Date.now());
          utils.updateProgress(progress, `${(i + 1).toLocaleString()}/${totalChunks.toLocaleString()} chunks (${Math.round(progress)}%) ${eta}`);
          
          // Force show progress bar
          elements.progressContainer.style.display = 'block';
          console.log(`Manual progress update: ${progress}% (${i + 1}/${totalChunks})`);
        }
        
        // No delay - send chunks as fast as possible with higher baud rate
        // await new Promise(resolve => setTimeout(resolve, 25));
      }
      
      console.log(`Successfully sent ${successfulChunks}/${totalChunks} chunks`);
      utils.updateProgress(95, 'Finalizing update...');

      utils.updateProgress(95, 'Finalizing update...');

      // Finish update
      const finishResponse = await serial.sendCommand(SERIAL_COMMANDS.FINISH_UPDATE);
      
      if (!finishResponse || !finishResponse.success) {
        throw new Error(finishResponse?.message || 'Failed to finish update');
      }

      utils.updateProgress(100, 'Update completed successfully!');
      utils.showStatus(elements.updateStatus, 'Update completed! Device will restart automatically.', 'success');

    } catch (error) {
      console.error('Update failed:', error);
      
      // Auto-abort on any error
      console.log('Attempting to abort failed update...');
      try {
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        console.log('Update aborted successfully');
      } catch (abortError) {
        console.error('Failed to abort update:', abortError.message);
      }
      
      utils.showStatus(elements.updateStatus, `Update failed: ${error.message}`, 'error');
      updateInProgress = false;
      ui.updateUpdateState(false);
    }
  },

  async abortUpdate() {
    try {
      console.log('Aborting update...');
      await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      updateInProgress = false;
      ui.updateUpdateState(false);
      utils.resetProgress();
      utils.showStatus(elements.updateStatus, 'Update aborted', 'warning');
      console.log('Update aborted successfully');
    } catch (error) {
      console.error('Failed to abort update:', error);
      // Force reset the UI state even if abort command fails
      updateInProgress = false;
      ui.updateUpdateState(false);
      utils.resetProgress();
      utils.showStatus(elements.updateStatus, 'Update aborted (forced)', 'warning');
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