/**
 * BYTE-90 Firmware Update Tool
 * Web Serial API based firmware updater for ESP32 devices
 * 
 * Features:
 * - Serial communication with ESP32 in Update Mode
 * - Base64 encoded firmware transfer with integrity checking
 * - Real-time progress reporting and error handling
 * - Automatic device mode validation
 * - Clean disconnect/reconnect functionality
 */

//==============================================================================
// CONSTANTS & CONFIGURATION
//==============================================================================

/** Serial command constants matching ESP32 implementation */
const SERIAL_COMMANDS = {
  GET_INFO: "GET_INFO",
  GET_STATUS: "GET_STATUS", 
  START_UPDATE: "START_UPDATE",
  SEND_CHUNK: "SEND_CHUNK",
  FINISH_UPDATE: "FINISH_UPDATE",
  ABORT_UPDATE: "ABORT_UPDATE",
  RESTART: "RESTART",
  ROLLBACK: "ROLLBACK",
  GET_PARTITION_INFO: "GET_PARTITION_INFO",
  GET_STORAGE_INFO: "GET_STORAGE_INFO",
  VALIDATE_FIRMWARE: "VALIDATE_FIRMWARE",
};

/** Response prefixes for protocol parsing */
const RESPONSE_PREFIXES = {
  OK: "OK:",
  ERROR: "ERROR:",
  PROGRESS: "PROGRESS:",
};

/** Transfer optimization settings */
const TRANSFER_CONFIG = {
  CHUNK_SIZE: 128,           // Bytes per chunk (optimized for reliability)
  COMMAND_TIMEOUT: 10000,    // General command timeout (ms)
  CHUNK_TIMEOUT: 10000,      // Chunk transfer timeout (ms)
  MAX_RETRIES: 2,            // Maximum retry attempts
  INTER_CHUNK_DELAY: 10,     // Delay between chunks (ms)
};

/** Serial port configuration */
const SERIAL_CONFIG = {
  baudRate: 230400,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
};

/** User interface messages - centralized for easy maintenance */
const UI_MESSAGES = {
  // Connection Messages
  CONNECTION: {
    CHECKING_MODE: "Checking device mode...",
    SUCCESS: "Device connected successfully in Update Mode",
    WRONG_MODE: (mode) => `Device is in ${mode}. Please switch to Update Mode and connect again.`,
    FAILED_VERIFY: "Could not verify device mode. Please ensure device is in Update Mode and try again.",
    UNABLE_COMMUNICATE: "Unable to communicate with device. Please ensure device is in Update Mode and try again.",
    DISCONNECTED: "Device disconnected",
    API_NOT_SUPPORTED: "Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.",
    UPDATE_SUCCESS_RESTART: "Update completed successfully. Device is restarting. You can reconnect when ready.",
    FAILED: (error) => `Connection failed: ${error}`,
  },

  // Update Process Messages
  UPDATE: {
    // File validation
    SELECT_FILE: "Please select a firmware file",
    SELECT_BIN: "Please select a .bin file",
    CORRECT_FILE: (filename) => `Please select the correct file (${filename})`,
    
    // Update progress
    CHECKING_STATUS: "Checking device status...",
    RESETTING_STATE: "Resetting device state...",
    STARTING_UPDATE: "Starting new update...",
    READING_FILE: "Reading firmware file...",
    STARTING_UPLOAD: "Starting upload...",
    UPLOADING: (percent, speed) => `Uploading: ${percent}% (${speed})`,
    FINALIZING: "Finalizing update...",
    
    // Completion
    SUCCESS: "Update completed successfully!",
    SUCCESS_RESTART: "Update completed! Device will restart automatically.",
    FAILED: (error) => `Update failed: ${error}`,
    ABORTED: "Update aborted",
    
    // Errors
    START_FAILED: "START_UPDATE command failed",
    WRONG_STATE: (state) => `Expected RECEIVING state, got: ${state}`,
    TOO_MANY_ERRORS: (count, error) => `Too many consecutive errors (${count}). Last error: ${error}`,
    FINISH_FAILED: "Failed to finish update",
    CHUNK_REJECTED: (chunkNum) => `Chunk ${chunkNum} rejected by device`,
    GLOBAL_ERROR: "An unexpected error occurred during update",
  },

  // Status Messages
  STATUS: {
    READY_UPLOAD: "Ready to upload",
    PAGE_HIDDEN_WARNING: "Page hidden during update - this may cause issues",
  },

  // Element Status
  ELEMENTS: {
    NOT_FOUND: (id) => `Element with id '${id}' not found`,
    CRITICAL_MISSING: "Critical elements missing:",
    INIT_FAILED: "Failed to initialize DOM elements",
  },

  // Serial Communication
  SERIAL: {
    NOT_CONNECTED: "Not connected to device",
    COMMAND_TIMEOUT: (timeout, command) => `Command timeout (${timeout}ms): ${command}`,
    INVALID_RESPONSE: (command) => `Invalid response for ${command}`,
    WRITE_FAILED: "Write failed:",
    READING_ERROR: "Serial reading error:",
    PARSE_ERROR_OK: "Failed to parse OK response:",
    PARSE_ERROR_ERROR: "Failed to parse ERROR response:",
    PARSE_ERROR_PROGRESS: "Failed to parse PROGRESS response:",
    READER_CANCEL_FAILED: "Reader cancel failed:",
    READER_RELEASE_FAILED: "Reader release failed:",
    WRITER_CLOSE_FAILED: "Writer close failed:",
    PORT_CLOSE_FAILED: "Serial port close failed:",
    DISCONNECT_FAILED: "Disconnect failed:",
    COMMAND_RETRY_FAILED: (command, attempt) => `Command ${command} attempt ${attempt} failed:`,
  },

  // Browser Compatibility
  COMPATIBILITY: {
    SUPPORTED: "Supported",
    NOT_SUPPORTED: "Not Supported",
  },

  // Device Info Errors
  DEVICE: {
    GET_INFO_FAILED: "Failed to get device info:",
    STATUS_FAILED: "Failed to get status:",
    ABORT_FAILED: "Abort command failed:",
    ABORT_AFTER_ERROR: "Failed to abort update after error:",
    DISCONNECT_AFTER_UPDATE: "Failed to disconnect after successful update:",
    WRONG_MODE_LOG: (mode) => `Device in wrong mode: ${mode}`,
    UPDATE_FAILED_LOG: "Update failed:",
    CHUNK_FAILED_LOG: (chunkNum, errorCount) => `Chunk ${chunkNum} failed (${errorCount} consecutive errors):`,
    TRANSFER_COMPLETE_LOG: (size, time, speed) => `Transfer completed: ${size} in ${time}s (${speed}/s)`,
    UPDATE_START_LOG: (size, type) => `Starting update: ${size} bytes, type: ${type}`,
    FILE_READ_LOG: (size, chunks, chunkSize) => `File read: ${size} bytes in ${chunks} chunks of ${chunkSize} bytes each`,
  },
};

//==============================================================================
// GLOBAL STATE
//==============================================================================

/** Application state variables */
let serialPort = null;
let reader = null;
let writer = null;
let isConnected = false;
let updateInProgress = false;
let deviceInfo = null;

/** DOM element cache for performance */
const elements = {};

//==============================================================================
// UTILITY FUNCTIONS
//==============================================================================

/**
 * Safely retrieve DOM element by ID with error logging
 * @param {string} id - Element ID to retrieve
 * @returns {HTMLElement|null} - Element or null if not found
 */
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(UI_MESSAGES.ELEMENTS.NOT_FOUND(id));
  }
  return element;
}

/**
 * Initialize and cache all required DOM elements
 * Validates that critical elements exist before proceeding
 * @returns {boolean} - True if initialization successful
 */
function initializeElements() {
  const elementIds = [
    "connectBtn", "disconnectBtn", "connectionStatus", "deviceInfo",
    "updateSection", "updateType", "firmwareFile", "uploadBtn", "abortBtn",
    "progressContainer", "uploadProgress", "progressText", "updateStatus",
    "compatibilityStatus", "serialSupport", "firmwareVersion", "mcu",
    "availableSpace", "freeHeap",
  ];

  // Cache all elements
  elementIds.forEach((id) => {
    elements[id] = safeGetElement(id);
  });

  // Validate critical elements exist
  const criticalElements = ["connectBtn", "disconnectBtn", "uploadBtn", "abortBtn"];
  const missingCritical = criticalElements.filter((id) => !elements[id]);

  if (missingCritical.length > 0) {
    console.error(UI_MESSAGES.ELEMENTS.CRITICAL_MISSING, missingCritical);
    return false;
  }

  return true;
}

/**
 * Utility functions for UI management and data processing
 */
const utils = {
  /**
   * Display status message with appropriate styling
   * @param {HTMLElement} element - Element to show status in
   * @param {string} message - Status message text
   * @param {string} type - Status type (info, success, warning, error)
   */
  showStatus(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("status-success", "status-warning", "status-danger");

    const typeMap = {
      success: "status-success",
      warning: "status-warning", 
      error: "status-danger",
      danger: "status-danger",
    };

    if (typeMap[type]) {
      element.classList.add(typeMap[type]);
    }

    element.style.display = "block";
  },

  /**
   * Hide status element and remove styling classes
   * @param {HTMLElement} element - Element to hide
   */
  hideStatus(element) {
    if (!element) return;

    element.style.display = "none";
    element.classList.remove("status-success", "status-warning", "status-danger");
  },

  /**
   * Update progress bar and text display
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Progress message text
   */
  updateProgress(percent, message = "") {
    if (elements.uploadProgress) {
      elements.uploadProgress.value = percent;
    }
    if (elements.progressText) {
      elements.progressText.textContent = message || `${Math.round(percent)}%`;
    }
    if (elements.progressContainer) {
      elements.progressContainer.style.display = "block";
    }
  },

  /**
   * Reset progress bar to initial state and hide container
   */
  resetProgress() {
    if (elements.uploadProgress) {
      elements.uploadProgress.value = 0;
    }
    if (elements.progressText) {
      elements.progressText.textContent = UI_MESSAGES.STATUS.READY_UPLOAD;
    }
    if (elements.progressContainer) {
      elements.progressContainer.style.display = "none";
    }
  },

  /**
   * Convert bytes to human-readable format
   * @param {number} bytes - Number of bytes to format
   * @returns {string} - Formatted string (e.g., "1.5 MB")
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Convert ArrayBuffer to Base64 string for serial transmission
   * @param {ArrayBuffer} buffer - Binary data to encode
   * @returns {string} - Base64 encoded string
   */
  arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },
};

//==============================================================================
// SERIAL COMMUNICATION MODULE
//==============================================================================

/**
 * Serial communication handler for ESP32 device interaction
 * Manages connection lifecycle, command sending, and response parsing
 */
const serial = {
  /** Current pending command awaiting response */
  pendingCommand: null,

  /**
   * Establish connection to ESP32 device via Web Serial API
   * Validates device is in Update Mode before completing connection
   * @returns {Promise<boolean>} - True if connection successful
   */
  async connect() {
    try {
      // Reset UI state for fresh connection
      utils.resetProgress();
      utils.hideStatus(elements.updateStatus);
      utils.hideStatus(elements.connectionStatus);

      // Clean up any existing connection
      if (isConnected || serialPort) {
        await serial.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Check Web Serial API support
      if (!navigator.serial) {
        throw new Error(UI_MESSAGES.CONNECTION.API_NOT_SUPPORTED);
      }

      // Request port access from user
      serialPort = await navigator.serial.requestPort();

      // Open serial connection with optimized settings
      await serialPort.open(SERIAL_CONFIG);

      // Set up communication streams
      reader = serialPort.readable.getReader();
      writer = serialPort.writable.getWriter();

      isConnected = true;
      ui.updateConnectionState(true);

      // Start background message listener
      serial.startListening();

      // Validate device mode and retrieve device information
      await serial.validateDeviceMode();

      return true;
    } catch (error) {
      console.error(UI_MESSAGES.DEVICE.UPDATE_FAILED_LOG, error);
      await serial.disconnect();
      utils.showStatus(
        elements.connectionStatus,
        UI_MESSAGES.CONNECTION.FAILED(error.message),
        "error"
      );
      return false;
    }
  },

  /**
   * Validate device is in Update Mode and retrieve device information
   * Automatically disconnects if device is in wrong mode
   * @throws {Error} - If device validation fails
   */
  async validateDeviceMode() {
    try {
      utils.showStatus(elements.connectionStatus, UI_MESSAGES.CONNECTION.CHECKING_MODE, "info");

      const info = await serial.sendCommand(SERIAL_COMMANDS.GET_INFO, "", 5000);

      if (info && info.success) {
        deviceInfo = info;

        // Verify device is in Update Mode
        if (info.current_mode !== "Update Mode") {
          console.log(UI_MESSAGES.DEVICE.WRONG_MODE_LOG(info.current_mode));
          await serial.disconnect();
          utils.showStatus(
            elements.connectionStatus,
            UI_MESSAGES.CONNECTION.WRONG_MODE(info.current_mode),
            "warning"
          );
          throw new Error(`Wrong device mode: ${info.current_mode}`);
        }

        // Update UI with device information
        ui.updateDeviceInfo(info);
        utils.showStatus(
          elements.connectionStatus,
          UI_MESSAGES.CONNECTION.SUCCESS,
          "success"
        );
      } else {
        await serial.disconnect();
        utils.showStatus(
          elements.connectionStatus,
          UI_MESSAGES.CONNECTION.FAILED_VERIFY,
          "error"
        );
        throw new Error("Failed to get device info");
      }
    } catch (error) {
      console.warn(UI_MESSAGES.DEVICE.GET_INFO_FAILED, error);
      await serial.disconnect();
      utils.showStatus(
        elements.connectionStatus,
        UI_MESSAGES.CONNECTION.UNABLE_COMMUNICATE,
        "error"
      );
      throw error;
    }
  },

  /**
   * Gracefully disconnect from device and clean up resources
   * Resets UI state and clears all connection-related data
   * @returns {Promise<boolean>} - True if disconnect successful
   */
  async disconnect() {
    // Reset UI state immediately
    utils.resetProgress();
    utils.hideStatus(elements.updateStatus);
    utils.hideStatus(elements.connectionStatus);

    // Exit early if already disconnected
    if (!isConnected && !serialPort) {
      return true;
    }

    try {
      // Set disconnected state to stop listeners
      isConnected = false;

      // Clear any pending operations
      if (serial.pendingCommand) {
        serial.pendingCommand = null;
      }

      // Close reader stream
      if (reader) {
        try {
          await reader.cancel();
        } catch (e) {
          console.warn(UI_MESSAGES.SERIAL.READER_CANCEL_FAILED, e);
        }
        try {
          reader.releaseLock();
        } catch (e) {
          console.warn(UI_MESSAGES.SERIAL.READER_RELEASE_FAILED, e);
        }
        reader = null;
      }

      // Close writer stream
      if (writer) {
        try {
          await writer.close();
        } catch (e) {
          console.warn(UI_MESSAGES.SERIAL.WRITER_CLOSE_FAILED, e);
        }
        writer = null;
      }

      // Allow streams to close before closing port
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Close serial port
      if (serialPort) {
        try {
          await serialPort.close();
        } catch (e) {
          console.warn(UI_MESSAGES.SERIAL.PORT_CLOSE_FAILED, e);
        }
        serialPort = null;
      }

      // Clear application state
      deviceInfo = null;
      ui.updateConnectionState(false);

      // Clear file selection
      if (elements.firmwareFile) {
        elements.firmwareFile.value = "";
      }

      return true;
    } catch (error) {
      console.error(UI_MESSAGES.SERIAL.DISCONNECT_FAILED, error);
      
      // Force cleanup even if errors occurred
      isConnected = false;
      reader = null;
      writer = null;
      serialPort = null;
      serial.pendingCommand = null;
      deviceInfo = null;
      ui.updateConnectionState(false);
      return false;
    }
  },

  /**
   * Send command to device and wait for response
   * Handles timeout and response validation automatically
   * @param {string} command - Command to send
   * @param {string} data - Optional command data
   * @param {number} customTimeout - Custom timeout in milliseconds
   * @returns {Promise<Object>} - Parsed response object
   */
  async sendCommand(command, data = "", customTimeout = TRANSFER_CONFIG.COMMAND_TIMEOUT) {
    if (!writer) {
      throw new Error(UI_MESSAGES.SERIAL.NOT_CONNECTED);
    }

    return new Promise((resolve, reject) => {
      const commandString = data ? `${command}:${data}\n` : `${command}\n`;
      const encoder = new TextEncoder();

      // Use longer timeout for chunk transfers
      const timeoutMs = command === SERIAL_COMMANDS.SEND_CHUNK 
        ? TRANSFER_CONFIG.CHUNK_TIMEOUT 
        : customTimeout;

      // Set up response timeout
      const timeout = setTimeout(() => {
        console.error(UI_MESSAGES.SERIAL.COMMAND_TIMEOUT(timeoutMs, command));
        serial.pendingCommand = null;
        reject(new Error(`Command timeout: ${command}`));
      }, timeoutMs);

      // Register response handler
      serial.pendingCommand = (response) => {
        clearTimeout(timeout);
        if (response && response.success !== undefined) {
          resolve(response);
        } else {
          console.error(UI_MESSAGES.SERIAL.INVALID_RESPONSE(command), response);
          reject(new Error(`Invalid response for ${command}`));
        }
      };

      // Send command
      writer.write(encoder.encode(commandString)).catch((error) => {
        clearTimeout(timeout);
        serial.pendingCommand = null;
        console.error(UI_MESSAGES.SERIAL.WRITE_FAILED, error);
        reject(error);
      });
    });
  },

  /**
   * Send command with automatic retry on failure
   * Implements exponential backoff for reliability
   * @param {string} command - Command to send
   * @param {string} data - Optional command data
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Object>} - Parsed response object
   */
  async sendCommandWithRetry(command, data = "", retries = TRANSFER_CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.sendCommand(command, data);
        return result;
      } catch (error) {
        console.warn(UI_MESSAGES.SERIAL.COMMAND_RETRY_FAILED(command, attempt), error);
        if (attempt === retries) {
          throw error;
        }
        
        // Backoff delay before retry
        const retryDelay = command === SERIAL_COMMANDS.SEND_CHUNK ? 1000 : 200;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  },

  /**
   * Background listener for incoming serial data
   * Processes responses and handles line buffering
   */
  async startListening() {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (reader && isConnected) {
        const { value, done } = await reader.read();

        if (done) break;

        // Accumulate incoming data
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            serial.handleResponse(line.trim());
          }
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(UI_MESSAGES.SERIAL.READING_ERROR, error);
      }
    }
  },

  /**
   * Parse and handle incoming response from device
   * Routes responses to appropriate handlers based on type
   * @param {string} line - Raw response line from device
   */
  handleResponse(line) {
    let response = null;
    let isProgress = false;

    // Parse response based on prefix
    if (line.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.OK.length);
      try {
        response = JSON.parse(jsonStr);
      } catch (e) {
        console.error(UI_MESSAGES.SERIAL.PARSE_ERROR_OK, jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.ERROR.length);
      try {
        response = JSON.parse(jsonStr);
        response.success = false;
      } catch (e) {
        console.error(UI_MESSAGES.SERIAL.PARSE_ERROR_ERROR, jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.PROGRESS.length);
      try {
        response = JSON.parse(jsonStr);
        isProgress = true;
      } catch (e) {
        console.error(UI_MESSAGES.SERIAL.PARSE_ERROR_PROGRESS, jsonStr, e);
        return;
      }
    } else {
      return; // Ignore non-protocol lines (debug output, etc.)
    }

    // Handle response based on type
    if (isProgress) {
      serial.handleProgressResponse(response);
    } else if (serial.pendingCommand) {
      // Route to waiting command handler
      const handler = serial.pendingCommand;
      serial.pendingCommand = null;
      handler(response);
    }
  },

  /**
   * Handle progress update responses from device
   * Updates UI progress display and handles completion
   * @param {Object} response - Parsed progress response
   */
  handleProgressResponse(response) {
    const percent = response.progress || 0;
    const message = `${percent}%`;
    utils.updateProgress(percent, message);

    // Handle update completion
    if (response.completed) {
      updateInProgress = false;
      if (response.success) {
        utils.showStatus(
          elements.updateStatus,
          UI_MESSAGES.UPDATE.SUCCESS_RESTART,
          "success"
        );
        ui.updateUpdateState(false);
      } else {
        utils.showStatus(
          elements.updateStatus,
          response.message || UI_MESSAGES.UPDATE.FAILED("Unknown error"),
          "error"
        );
        ui.updateUpdateState(false);
      }
    }
  },
};

//==============================================================================
// FIRMWARE UPDATE MODULE
//==============================================================================

/**
 * Firmware update handler with chunked transfer and error recovery
 * Manages the complete update process from validation to completion
 */
const updater = {
  /**
   * Start firmware update process
   * Validates file, prepares device, and initiates chunked transfer
   */
  async startUpdate() {
    const file = elements.firmwareFile?.files[0];
    const updateType = elements.updateType?.value || "firmware";

    // Validate file selection
    if (!this.validateFileSelection(file, updateType)) {
      return;
    }

    try {
      // Initialize update state
      updateInProgress = true;
      ui.updateUpdateState(true);
      utils.hideStatus(elements.updateStatus);
      utils.updateProgress(0, UI_MESSAGES.UPDATE.CHECKING_STATUS);

      // Prepare device for update
      await this.prepareDeviceForUpdate();

      // Initialize update on device
      await this.initializeDeviceUpdate(file, updateType);

      // Transfer firmware data
      await this.transferFirmwareData(file);

      // Finalize update
      await this.finalizeUpdate();

      // Handle successful completion
      this.handleUpdateSuccess();

    } catch (error) {
      console.error("Update failed:", error);
      this.handleUpdateError(error);
    }
  },

  /**
   * Validate selected file meets requirements
   * @param {File} file - Selected firmware file
   * @param {string} updateType - Type of update (firmware/filesystem)
   * @returns {boolean} - True if file is valid
   */
  validateFileSelection(file, updateType) {
    if (!file) {
      utils.showStatus(elements.updateStatus, UI_MESSAGES.UPDATE.SELECT_FILE, "error");
      return false;
    }

    if (!file.name.endsWith(".bin")) {
      utils.showStatus(elements.updateStatus, UI_MESSAGES.UPDATE.SELECT_BIN, "error");
      return false;
    }

    const expectedFilename = updateType === "firmware" ? "byte90.bin" : "byte90animations.bin";
    const expectedPattern = updateType === "firmware" ? "byte90" : "byte90animations";
    
    if (!file.name.includes(expectedPattern)) {
      utils.showStatus(
        elements.updateStatus,
        UI_MESSAGES.UPDATE.CORRECT_FILE(expectedFilename),
        "error"
      );
      return false;
    }

    return true;
  },

  /**
   * Prepare device for firmware update
   * Checks status and aborts any existing update
   */
  async prepareDeviceForUpdate() {
    try {
      // Check current device status
      const statusResponse = await serial.sendCommand(SERIAL_COMMANDS.GET_STATUS);
      if (statusResponse && statusResponse.update_active) {
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.warn("Failed to get status:", error);
    }

    utils.updateProgress(1, "Resetting device state...");

    try {
      // Ensure clean state by sending abort command
      await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn("Abort command failed:", error);
    }
  },

  /**
   * Initialize update process on device
   * @param {File} file - Firmware file to upload
   * @param {string} updateType - Type of update
   */
  async initializeDeviceUpdate(file, updateType) {
    utils.updateProgress(3, "Starting new update...");

    console.log(`Starting update: ${file.size} bytes, type: ${updateType}`);

    const startResponse = await serial.sendCommandWithRetry(
      SERIAL_COMMANDS.START_UPDATE,
      `${file.size},${updateType}`,
      2
    );

    if (!startResponse || !startResponse.success) {
      throw new Error(startResponse?.message || "START_UPDATE command failed");
    }

    if (startResponse.state !== "RECEIVING") {
      throw new Error(`Expected RECEIVING state, got: ${startResponse.state}`);
    }
  },

  /**
   * Transfer firmware data in chunks with progress tracking
   * @param {File} file - Firmware file to transfer
   */
  async transferFirmwareData(file) {
    utils.updateProgress(5, "Reading firmware file...");

    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / TRANSFER_CONFIG.CHUNK_SIZE);

    console.log(
      `File read: ${arrayBuffer.byteLength} bytes in ${totalChunks} chunks of ${TRANSFER_CONFIG.CHUNK_SIZE} bytes each`
    );
    
    utils.updateProgress(10, "Starting upload...");

    // Transfer metrics
    const startTime = performance.now();
    let bytesTransferred = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    // Send firmware in chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * TRANSFER_CONFIG.CHUNK_SIZE;
      const end = Math.min(start + TRANSFER_CONFIG.CHUNK_SIZE, arrayBuffer.byteLength);
      const chunk = arrayBuffer.slice(start, end);
      const base64Chunk = utils.arrayBufferToBase64(chunk);

      // Update progress periodically
      if (i % 20 === 0 || i === totalChunks - 1) {
        const transferProgress = 10 + (i / totalChunks) * 80;
        const elapsed = (performance.now() - startTime) / 1000;
        const speed = bytesTransferred / elapsed || 0;
        const speedText = speed > 1024 
          ? `${(speed / 1024).toFixed(1)} KB/s`
          : `${speed.toFixed(0)} B/s`;

        utils.updateProgress(
          transferProgress,
          UI_MESSAGES.UPDATE.UPLOADING(Math.round(transferProgress), speedText)
        );
      }

      // Send chunk with error handling
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
        
        // Add delay between chunks for reliability
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, TRANSFER_CONFIG.INTER_CHUNK_DELAY));
        }
      } catch (chunkError) {
        consecutiveErrors++;
        console.error(
          `Chunk ${i + 1} failed (${consecutiveErrors} consecutive errors):`,
          chunkError
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Too many consecutive errors (${consecutiveErrors}). Last error: ${chunkError.message}`
          );
        }

        i--; // Retry this chunk
        continue;
      }

      bytesTransferred = end;
    }

    // Log transfer completion statistics
    const totalTime = (performance.now() - startTime) / 1000;
    const avgSpeed = arrayBuffer.byteLength / totalTime;
    console.log(
      `Transfer completed: ${utils.formatBytes(arrayBuffer.byteLength)} in ${totalTime.toFixed(2)}s (${utils.formatBytes(avgSpeed)}/s)`
    );
  },

  /**
   * Finalize update process on device
   * Sends completion command and validates success
   */
  async finalizeUpdate() {
    utils.updateProgress(95, "Finalizing update...");

    const finishResponse = await serial.sendCommandWithRetry(SERIAL_COMMANDS.FINISH_UPDATE);

    if (!finishResponse || !finishResponse.success) {
      throw new Error(finishResponse?.message || "Failed to finish update");
    }
  },

  /**
   * Handle successful update completion
   * Updates UI and schedules automatic disconnect
   */
  handleUpdateSuccess() {
    utils.updateProgress(100, "Update completed successfully!");
    utils.showStatus(
      elements.updateStatus,
      "Update completed! Device will restart automatically.",
      "success"
    );

    // Clear file selection and reset UI
    if (elements.firmwareFile) {
      elements.firmwareFile.value = "";
      if (elements.uploadBtn) {
        elements.uploadBtn.disabled = true;
      }
    }

    updateInProgress = false;
    ui.updateUpdateState(false);

    // Schedule automatic disconnect after device restart
    setTimeout(async () => {
      try {
        await serial.disconnect();
        utils.showStatus(
          elements.connectionStatus,
          "Update completed successfully. Device is restarting. You can reconnect when ready.",
          "success"
        );
      } catch (disconnectError) {
        console.warn("Failed to disconnect after successful update:", disconnectError);
      }
    }, 2000);
  },

  /**
   * Handle update error with cleanup
   * @param {Error} error - Error that occurred during update
   */
  handleUpdateError(error) {
    utils.showStatus(
      elements.updateStatus,
      `Update failed: ${error.message}`,
      "error"
    );
    
    updateInProgress = false;
    ui.updateUpdateState(false);

    // Attempt cleanup
    try {
      serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
    } catch (abortError) {
      console.warn("Failed to abort update after error:", abortError);
    }
  },

  /**
   * Abort ongoing update process
   * Sends abort command to device and resets UI state
   */
  async abortUpdate() {
    try {
      await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      updateInProgress = false;
      ui.updateUpdateState(false);
      utils.resetProgress();
      utils.showStatus(elements.updateStatus, "Update aborted", "warning");
    } catch (error) {
      console.error("Failed to abort update:", error);
    }
  },
};

//==============================================================================
// USER INTERFACE MODULE
//==============================================================================

/**
 * UI state management and display updates
 * Handles visual feedback and user interaction states
 */
const ui = {
  /**
   * Update UI based on connection state
   * Shows/hides relevant controls and information
   * @param {boolean} connected - Current connection state
   */
  updateConnectionState(connected) {
    if (connected) {
      // Show connected state controls
      if (elements.connectBtn) elements.connectBtn.style.display = "none";
      if (elements.disconnectBtn) elements.disconnectBtn.style.display = "inline-flex";
      if (elements.deviceInfo) elements.deviceInfo.style.display = "block";
      if (elements.updateSection) elements.updateSection.style.display = "block";
    } else {
      // Show disconnected state controls
      if (elements.connectBtn) elements.connectBtn.style.display = "inline-flex";
      if (elements.disconnectBtn) elements.disconnectBtn.style.display = "none";
      if (elements.deviceInfo) elements.deviceInfo.style.display = "none";
      if (elements.updateSection) elements.updateSection.style.display = "none";
      if (elements.uploadBtn) elements.uploadBtn.disabled = true;
      this.clearDeviceInfo();
    }
  },

  /**
   * Update device information display
   * Populates UI with device specifications and status
   * @param {Object} info - Device information from GET_INFO response
   */
  updateDeviceInfo(info) {
    if (info) {
      if (elements.firmwareVersion) {
        elements.firmwareVersion.textContent = info.firmware_version || "-";
      }
      if (elements.mcu) {
        elements.mcu.textContent = info.mcu || "-";
      }
      if (elements.availableSpace) {
        elements.availableSpace.textContent = info.flash_available || "-";
      }
      if (elements.freeHeap) {
        elements.freeHeap.textContent = info.free_heap || "-";
      }
    }
  },

  /**
   * Clear all device information fields
   * Resets display to placeholder values
   */
  clearDeviceInfo() {
    if (elements.firmwareVersion) elements.firmwareVersion.textContent = "-";
    if (elements.mcu) elements.mcu.textContent = "-";
    if (elements.availableSpace) elements.availableSpace.textContent = "-";
    if (elements.freeHeap) elements.freeHeap.textContent = "-";
  },

  /**
   * Update UI based on firmware update state
   * Switches between upload and abort controls
   * @param {boolean} inProgress - Whether update is currently in progress
   */
  updateUpdateState(inProgress) {
    if (inProgress) {
      // Show update in progress controls
      if (elements.uploadBtn) elements.uploadBtn.style.display = "none";
      if (elements.abortBtn) elements.abortBtn.style.display = "inline-flex";
      if (elements.firmwareFile) elements.firmwareFile.disabled = true;
      if (elements.updateType) elements.updateType.disabled = true;
    } else {
      // Show ready for update controls
      if (elements.uploadBtn) elements.uploadBtn.style.display = "inline-flex";
      if (elements.abortBtn) elements.abortBtn.style.display = "none";
      if (elements.firmwareFile) elements.firmwareFile.disabled = false;
      if (elements.updateType) elements.updateType.disabled = false;
    }
  },

  /**
   * Check and display Web Serial API compatibility
   * Shows support status and browser requirements
   */
  checkCompatibility() {
    if ("serial" in navigator) {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = UI_MESSAGES.COMPATIBILITY.SUPPORTED;
        elements.serialSupport.className = "status-badge supported";
      }
    } else {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = UI_MESSAGES.COMPATIBILITY.NOT_SUPPORTED;
        elements.serialSupport.className = "status-badge not-supported";
      }

      utils.showStatus(
        elements.connectionStatus,
        UI_MESSAGES.CONNECTION.API_NOT_SUPPORTED,
        "error"
      );
    }
  },
};

//==============================================================================
// EVENT HANDLING & INITIALIZATION
//==============================================================================

/**
 * Initialize all event listeners for user interactions
 * Sets up click handlers and state change monitoring
 */
function initializeEventListeners() {
  // Connection controls
  if (elements.connectBtn) {
    elements.connectBtn.addEventListener("click", () => serial.connect());
  }

  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener("click", () => serial.disconnect());
  }

  // Update controls
  if (elements.uploadBtn) {
    elements.uploadBtn.addEventListener("click", () => updater.startUpdate());
  }

  if (elements.abortBtn) {
    elements.abortBtn.addEventListener("click", () => updater.abortUpdate());
  }

  // File selection handling
  if (elements.firmwareFile) {
    elements.firmwareFile.addEventListener("change", (e) => {
      if (elements.uploadBtn) {
        elements.uploadBtn.disabled =
          !e.target.files[0] || !isConnected || updateInProgress;
      }
    });
  }

  // Page visibility monitoring
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && updateInProgress) {
      console.warn(UI_MESSAGES.STATUS.PAGE_HIDDEN_WARNING);
    }
  });

  // Prevent accidental page close during update
  window.addEventListener("beforeunload", (e) => {
    if (updateInProgress) {
      e.preventDefault();
      return "";
    }
  });
}

/**
 * Global error handlers for unhandled exceptions
 * Ensures update state is properly reset on errors
 */
function initializeErrorHandlers() {
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    if (updateInProgress) {
      utils.showStatus(
        elements.updateStatus,
        UI_MESSAGES.UPDATE.GLOBAL_ERROR,
        "error"
      );
      updateInProgress = false;
      ui.updateUpdateState(false);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    if (updateInProgress) {
      utils.showStatus(
        elements.updateStatus,
        UI_MESSAGES.UPDATE.GLOBAL_ERROR,
        "error"
      );
      updateInProgress = false;
      ui.updateUpdateState(false);
    }
  });
}

/**
 * Initialize the BYTE-90 Serial Updater application
 * Sets up DOM elements, event handlers, and initial UI state
 */
function init() {
  // Initialize DOM element cache
  if (!initializeElements()) {
    console.error(UI_MESSAGES.ELEMENTS.INIT_FAILED);
    return;
  }

  // Set up event handling
  ui.checkCompatibility();
  initializeEventListeners();
  initializeErrorHandlers();

  // Set initial UI state
  ui.updateConnectionState(false);
  ui.updateUpdateState(false);
  utils.hideStatus(elements.connectionStatus);
  utils.hideStatus(elements.updateStatus);
  utils.resetProgress();
}

//==============================================================================
// APPLICATION ENTRY POINT
//==============================================================================

// Start the application when DOM is ready
document.addEventListener("DOMContentLoaded", init);