/**
 * BYTE-90 Firmware Update Web Interface
 *
 * This application provides a web-based firmware update interface for BYTE-90 devices
 * using the Web Serial API. It handles device connection, mode verification, firmware
 * transfer with progress tracking, and automatic error recovery.
 */

//==============================================================================
// CONSTANTS AND CONFIGURATION
//==============================================================================

/**
 * Serial command constants - must match ESP32 firmware definitions
 */
const SERIAL_COMMANDS = {
  GET_INFO: "GET_INFO", // Request device information
  GET_STATUS: "GET_STATUS", // Request current device status
  START_UPDATE: "START_UPDATE", // Initialize firmware update process
  SEND_CHUNK: "SEND_CHUNK", // Send firmware data chunk
  FINISH_UPDATE: "FINISH_UPDATE", // Finalize firmware update
  ABORT_UPDATE: "ABORT_UPDATE", // Cancel ongoing update
  RESTART: "RESTART", // Restart device
  ROLLBACK: "ROLLBACK", // Rollback to previous firmware
  GET_PARTITION_INFO: "GET_PARTITION_INFO", // Get partition information
  GET_STORAGE_INFO: "GET_STORAGE_INFO", // Get storage information
  VALIDATE_FIRMWARE: "VALIDATE_FIRMWARE", // Validate firmware integrity
};

/**
 * Response prefixes for parsing ESP32 responses
 */
const RESPONSE_PREFIXES = {
  OK: "OK:", // Success response prefix
  ERROR: "ERROR:", // Error response prefix
  PROGRESS: "PROGRESS:", // Progress update prefix
};

const SERIAL_CONFIG = {
  baudRate: 921600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
};

/**
 * Transfer settings optimized for speed and reliability
 */
const CHUNK_SIZE = 1024; // Bytes per chunk - balanced for reliability
const COMMAND_TIMEOUT = 5000; // Default command timeout (5 seconds)
const CHUNK_TIMEOUT = 10000; // Chunk transfer timeout (10 seconds)
const MAX_RETRIES = 2; // Maximum retry attempts for failed operations

//==============================================================================
// GLOBAL STATE MANAGEMENT
//==============================================================================

/**
 * Web Serial API connection objects
 */
let serialPort = null; // SerialPort instance
let reader = null; // ReadableStreamDefaultReader
let writer = null; // WritableStreamDefaultWriter

/**
 * Application state variables
 */
let isConnected = false; // Connection status flag
let updateInProgress = false; // Update operation status
let deviceInfo = null; // Cached device information

/**
 * DOM element cache for performance
 */
const elements = {};

//==============================================================================
// DOM ELEMENT MANAGEMENT
//==============================================================================

/**
 * Safely retrieves a DOM element by ID with error handling
 * @param {string} id - Element ID to retrieve
 * @returns {Element|null} - DOM element or null if not found
 */
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

/**
 * Initializes DOM element cache and validates critical elements
 * @returns {boolean} - True if all critical elements are found
 */
function initializeElements() {
  const elementIds = [
    "connectBtn",
    "disconnectBtn",
    "connectionStatus",
    "deviceInfo",
    "updateSection",
    "updateType",
    "firmwareFile",
    "uploadBtn",
    "abortBtn",
    "progressContainer",
    "uploadProgress",
    "progressText",
    "updateStatus",
    "compatibilityStatus",
    "serialSupport",
    "firmwareVersion",
    "mcu",
    "availableSpace",
    "freeHeap",
  ];

  elementIds.forEach((id) => {
    elements[id] = safeGetElement(id);
  });

  const criticalElements = [
    "connectBtn",
    "disconnectBtn",
    "uploadBtn",
    "abortBtn",
  ];
  const missingCritical = criticalElements.filter((id) => !elements[id]);

  if (missingCritical.length > 0) {
    console.error("Critical elements missing:", missingCritical);
    return false;
  }

  return true;
}

//==============================================================================
// UTILITY FUNCTIONS
//==============================================================================

/**
 * Collection of utility functions for UI management and data processing
 */
const utils = {
  /**
   * Displays a status message with appropriate styling
   * @param {Element} element - Target DOM element for the message
   * @param {string} message - Message text to display
   * @param {string} type - Message type (info, success, warning, error)
   */
  showStatus(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove(
      "status-success",
      "status-warning",
      "status-danger"
    );

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
   * Hides a status message and removes styling classes
   * @param {Element} element - Target DOM element to hide
   */
  hideStatus(element) {
    if (!element) return;

    element.style.display = "none";
    element.classList.remove(
      "status-success",
      "status-warning",
      "status-danger"
    );
  },

  /**
   * Updates the progress bar and text display
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Optional progress message
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
   * Resets progress bar to initial state and hides it
   */
  resetProgress() {
    if (elements.uploadProgress) {
      elements.uploadProgress.value = 0;
    }
    if (elements.progressText) {
      elements.progressText.textContent = "Ready to upload";
    }
    if (elements.progressContainer) {
      elements.progressContainer.style.display = "none";
    }
  },

  /**
   * Converts bytes to human-readable format (KB, MB, GB)
   * @param {number} bytes - Number of bytes to format
   * @returns {string} - Formatted size string
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Converts ArrayBuffer to Base64 string for serial transmission
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
 * Handles all Web Serial API communication with the BYTE-90 device
 */
const serial = {
  pendingCommand: null, // Currently awaiting response

  /**
   * Establishes connection to the BYTE-90 device and verifies Update Mode
   * @returns {Promise<boolean>} - True if connection successful and in Update Mode
   */
  async connect() {
    try {
      utils.resetProgress();
      utils.hideStatus(elements.updateStatus);
      utils.hideStatus(elements.connectionStatus);

      // Clean up any existing connection first
      if (isConnected || serialPort) {
        await serial.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!navigator.serial) {
        throw new Error("Web Serial API not supported");
      }

      serialPort = await navigator.serial.requestPort();

      await serialPort.open(SERIAL_CONFIG);

      reader = serialPort.readable.getReader();
      writer = serialPort.writable.getWriter();

      isConnected = true;
      ui.updateConnectionState(true);

      serial.startListening();

      try {
        utils.showStatus(
          elements.connectionStatus,
          "Checking device mode...",
          "info"
        );

        const info = await serial.sendCommand(
          SERIAL_COMMANDS.GET_INFO,
          "",
          5000
        );

        if (info && info.success) {
          deviceInfo = info;

          // Check if device is in Update Mode
          if (info.current_mode !== "Update Mode") {
            console.log(`Device in wrong mode: ${info.current_mode}`);

            await serial.disconnect();

            utils.showStatus(
              elements.connectionStatus,
              `Device is in ${info.current_mode}. Please switch to Update Mode and connect again.`,
              "warning"
            );

            return false;
          }

          ui.updateDeviceInfo(info);
          utils.showStatus(
            elements.connectionStatus,
            "Device connected successfully in Update Mode",
            "success"
          );
        } else {
          await serial.disconnect();
          utils.showStatus(
            elements.connectionStatus,
            "Could not verify device mode. Please ensure device is in Update Mode and try again.",
            "error"
          );
          return false;
        }
      } catch (error) {
        console.warn("Failed to get device info:", error);
        await serial.disconnect();
        utils.showStatus(
          elements.connectionStatus,
          "Unable to communicate with device. Please ensure device is in Update Mode and try again.",
          "error"
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Connection failed:", error);
      await serial.disconnect();
      utils.showStatus(
        elements.connectionStatus,
        `Connection failed: ${error.message}`,
        "error"
      );
      return false;
    }
  },

  /**
   * Safely disconnects from the device and cleans up resources
   * @returns {Promise<boolean>} - True if disconnect successful
   */
  async disconnect() {
    utils.resetProgress();
    utils.hideStatus(elements.updateStatus);
    utils.hideStatus(elements.connectionStatus);

    if (!isConnected && !serialPort) {
      return true;
    }

    try {
      isConnected = false;

      if (serial.pendingCommand) {
        serial.pendingCommand = null;
      }

      if (reader) {
        try {
          await reader.cancel();
        } catch (e) {
          console.warn("Reader cancel failed:", e);
        }

        try {
          reader.releaseLock();
        } catch (e) {
          console.warn("Reader release failed:", e);
        }
        reader = null;
      }

      if (writer) {
        try {
          await writer.close();
        } catch (e) {
          console.warn("Writer close failed:", e);
        }
        writer = null;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (serialPort) {
        try {
          await serialPort.close();
        } catch (e) {
          console.warn("Serial port close failed:", e);
        }
        serialPort = null;
      }

      deviceInfo = null;
      ui.updateConnectionState(false);

      if (elements.firmwareFile) {
        elements.firmwareFile.value = "";
      }
      if (elements.updateType) {
        elements.updateType.value = "firmware"; // Reset to default firmware type
      }

      return true;
    } catch (error) {
      console.error("Disconnect failed:", error);
      // Force cleanup even if there were errors
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
   * Sends a command to the device and waits for response
   * @param {string} command - Command to send
   * @param {string} data - Optional command data
   * @param {number} customTimeout - Custom timeout in milliseconds
   * @returns {Promise<Object>} - Parsed JSON response from device
   */
  async sendCommand(command, data = "", customTimeout = COMMAND_TIMEOUT) {
    if (!writer) {
      throw new Error("Not connected to device");
    }

    return new Promise((resolve, reject) => {
      const commandString = data ? `${command}:${data}\n` : `${command}\n`;
      const encoder = new TextEncoder();

      const timeoutMs =
        command === SERIAL_COMMANDS.SEND_CHUNK ? CHUNK_TIMEOUT : customTimeout;

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

      writer.write(encoder.encode(commandString)).catch((error) => {
        clearTimeout(timeout);
        serial.pendingCommand = null;
        console.error("Write failed:", error);
        reject(error);
      });
    });
  },

  /**
   * Sends a command with automatic retry on failure
   * @param {string} command - Command to send
   * @param {string} data - Optional command data
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Object>} - Parsed JSON response from device
   */
  async sendCommandWithRetry(command, data = "", retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.sendCommand(command, data);
        return result;
      } catch (error) {
        console.warn(`Command ${command} attempt ${attempt} failed:`, error);
        if (attempt === retries) {
          throw error;
        }
        const retryDelay = command === SERIAL_COMMANDS.SEND_CHUNK ? 100 : 50;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  },

  /**
   * Starts listening for incoming serial data and processes responses
   */
  async startListening() {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (reader && isConnected) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            serial.handleResponse(line.trim());
          }
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Serial reading error:", error);
      }
    }
  },

  /**
   * Processes incoming responses from the device
   * @param {string} line - Raw response line from device
   */
  handleResponse(line) {
    let response = null;
    let isProgress = false;

    if (line.startsWith(RESPONSE_PREFIXES.OK)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.OK.length);
      try {
        response = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse OK response:", jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.ERROR)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.ERROR.length);
      try {
        response = JSON.parse(jsonStr);
        response.success = false;
      } catch (e) {
        console.error("Failed to parse ERROR response:", jsonStr, e);
        return;
      }
    } else if (line.startsWith(RESPONSE_PREFIXES.PROGRESS)) {
      const jsonStr = line.substring(RESPONSE_PREFIXES.PROGRESS.length);
      try {
        response = JSON.parse(jsonStr);
        isProgress = true;
      } catch (e) {
        console.error("Failed to parse PROGRESS response:", jsonStr, e);
        return;
      }
    } else {
      return;
    }

    if (isProgress) {
      if (response.completed) {
        updateInProgress = false;
        if (response.success) {
          utils.showStatus(
            elements.updateStatus,
            "Update completed successfully! Device will restart.",
            "success"
          );
          ui.updateUpdateState(false);
        } else {
          utils.showStatus(
            elements.updateStatus,
            response.message || "Update failed",
            "error"
          );
          ui.updateUpdateState(false);
        }
      }
    } else if (serial.pendingCommand) {
      const handler = serial.pendingCommand;
      serial.pendingCommand = null;
      handler(response);
    }
  },
};

//==============================================================================
// FIRMWARE UPDATE MODULE
//==============================================================================

/**
 * Handles firmware file validation, upload process, and progress tracking
 */
const updater = {
  /**
   * Initiates the firmware update process with comprehensive validation
   * @returns {Promise<void>} - Resolves when update completes or rejects on error
   */
  async startUpdate() {
    const file = elements.firmwareFile?.files[0];
    const updateType = elements.updateType?.value || "firmware";

    if (!file) {
      utils.showStatus(
        elements.updateStatus,
        "Please select a firmware file",
        "error"
      );
      return;
    }

    if (!file.name.endsWith(".bin")) {
      utils.showStatus(
        elements.updateStatus,
        "Please select a .bin file",
        "error"
      );
      return;
    }

    const expectedFilename =
      updateType === "firmware" ? "byte90.bin" : "byte90animations.bin";
    if (
      !file.name.includes(
        updateType === "firmware" ? "byte90" : "byte90animations"
      )
    ) {
      utils.showStatus(
        elements.updateStatus,
        `Please select the correct file (${expectedFilename})`,
        "error"
      );
      return;
    }

    try {
      updateInProgress = true;
      ui.updateUpdateState(true);
      utils.hideStatus(elements.updateStatus);
      utils.updateProgress(0, "Checking device status...");

      try {
        const statusResponse = await serial.sendCommand(
          SERIAL_COMMANDS.GET_STATUS
        );

        if (statusResponse && statusResponse.update_active) {
          await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn("Failed to get status:", error);
      }

      utils.updateProgress(1, "Resetting device state...");

      try {
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.warn("Abort command failed:", error);
      }

      utils.updateProgress(3, "Starting new update...");

      console.log(`Starting update: ${file.size} bytes, type: ${updateType}`);

      const startResponse = await serial.sendCommandWithRetry(
        SERIAL_COMMANDS.START_UPDATE,
        `${file.size},${updateType}`,
        2
      );

      if (!startResponse || !startResponse.success) {
        throw new Error(
          startResponse?.message || "START_UPDATE command failed"
        );
      }

      if (startResponse.state !== "RECEIVING") {
        throw new Error(
          `Expected RECEIVING state, got: ${startResponse.state}`
        );
      }

      utils.updateProgress(5, "Reading firmware file...");

      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

      console.log(
        `File read: ${arrayBuffer.byteLength} bytes in ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`
      );
      utils.updateProgress(10, "Starting upload...");

      const startTime = performance.now();
      let bytesTransferred = 0;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);
        const base64Chunk = utils.arrayBufferToBase64(chunk);

        if (i % 50 === 0 || i === totalChunks - 1) {
          const transferProgress = 10 + (i / totalChunks) * 80;

          utils.updateProgress(
            transferProgress,
            `Uploading: ${Math.round(
              transferProgress
            )}% Do not disconnect device.`
          );
        }

        try {
          const chunkResponse = await serial.sendCommand(
            SERIAL_COMMANDS.SEND_CHUNK,
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
            await new Promise((resolve) => setTimeout(resolve, 1));
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

          i--;
          continue;
        }

        bytesTransferred = end;
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const avgSpeed = arrayBuffer.byteLength / totalTime;
      console.log(
        `Transfer completed: ${utils.formatBytes(
          arrayBuffer.byteLength
        )} in ${totalTime.toFixed(2)}s (${utils.formatBytes(avgSpeed)}/s)`
      );

      utils.updateProgress(95, "Finalizing update...");

      const finishResponse = await serial.sendCommandWithRetry(
        SERIAL_COMMANDS.FINISH_UPDATE
      );

      if (!finishResponse || !finishResponse.success) {
        throw new Error(finishResponse?.message || "Failed to finish update");
      }

      utils.updateProgress(100, "Update completed successfully!");
      utils.showStatus(
        elements.updateStatus,
        "Update completed! Device will restart automatically.",
        "success"
      );

      if (elements.firmwareFile) {
        elements.firmwareFile.value = "";
        if (elements.uploadBtn) {
          elements.uploadBtn.disabled = true;
        }
      }

      updateInProgress = false;
      ui.updateUpdateState(false);

      setTimeout(async () => {
        try {
          await serial.disconnect();
          utils.showStatus(
            elements.connectionStatus,
            "Update completed successfully. Device is restarting. You can reconnect when ready.",
            "success"
          );
        } catch (disconnectError) {
          console.warn(
            "Failed to disconnect after successful update:",
            disconnectError
          );
        }
      }, 2000);
    } catch (error) {
      console.error("Update failed:", error);
      utils.showStatus(
        elements.updateStatus,
        `Update failed: ${error.message}`,
        "error"
      );
      updateInProgress = false;
      ui.updateUpdateState(false);

      try {
        await serial.sendCommand(SERIAL_COMMANDS.ABORT_UPDATE);
      } catch (abortError) {
        console.warn("Failed to abort update after error:", abortError);
      }
    }
  },

  /**
   * Cancels an ongoing firmware update operation
   * @returns {Promise<void>} - Resolves when abort completes
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
// USER INTERFACE MANAGEMENT
//==============================================================================

/**
 * Handles all UI state changes and element visibility management
 */
const ui = {
  /**
   * Updates UI elements based on connection state
   * @param {boolean} connected - True if device is connected
   */
  updateConnectionState(connected) {
    if (connected) {
      if (elements.connectBtn) elements.connectBtn.style.display = "none";
      if (elements.disconnectBtn)
        elements.disconnectBtn.style.display = "inline-flex";
      if (elements.deviceInfo) elements.deviceInfo.style.display = "block";
      if (elements.updateSection)
        elements.updateSection.style.display = "block";
    } else {
      if (elements.connectBtn)
        elements.connectBtn.style.display = "inline-flex";
      if (elements.disconnectBtn) elements.disconnectBtn.style.display = "none";
      if (elements.deviceInfo) elements.deviceInfo.style.display = "none";
      if (elements.updateSection) elements.updateSection.style.display = "none";
      if (elements.uploadBtn) elements.uploadBtn.disabled = true;
      this.clearDeviceInfo();
    }
  },

  /**
   * Populates device information fields with data from the device
   * @param {Object} info - Device information object from GET_INFO response
   */
  updateDeviceInfo(info) {
    if (info) {
      if (elements.firmwareVersion)
        elements.firmwareVersion.textContent = info.firmware_version || "-";
      if (elements.mcu) elements.mcu.textContent = info.mcu || "-";
      if (elements.availableSpace)
        elements.availableSpace.textContent = info.flash_available || "-";
      if (elements.freeHeap)
        elements.freeHeap.textContent = info.free_heap || "-";
    }
  },

  /**
   * Clears all device information fields
   */
  clearDeviceInfo() {
    if (elements.firmwareVersion) elements.firmwareVersion.textContent = "-";
    if (elements.mcu) elements.mcu.textContent = "-";
    if (elements.availableSpace) elements.availableSpace.textContent = "-";
    if (elements.freeHeap) elements.freeHeap.textContent = "-";
  },

  /**
   * Updates UI elements based on update operation state
   * @param {boolean} inProgress - True if update is in progress
   */
  updateUpdateState(inProgress) {
    if (inProgress) {
      if (elements.uploadBtn) elements.uploadBtn.style.display = "none";
      if (elements.abortBtn) elements.abortBtn.style.display = "inline-flex";
      if (elements.firmwareFile) elements.firmwareFile.disabled = true;
      if (elements.updateType) elements.updateType.disabled = true;
    } else {
      if (elements.uploadBtn) elements.uploadBtn.style.display = "inline-flex";
      if (elements.abortBtn) elements.abortBtn.style.display = "none";
      if (elements.firmwareFile) elements.firmwareFile.disabled = false;
      if (elements.updateType) elements.updateType.disabled = false;
    }
  },

  /**
   * Checks and displays Web Serial API compatibility status
   */
  checkCompatibility() {
    if ("serial" in navigator) {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = "Supported";
        elements.serialSupport.className = "status-badge supported";
      }
    } else {
      if (elements.serialSupport) {
        elements.serialSupport.textContent = "Not Supported";
        elements.serialSupport.className = "status-badge not-supported";
      }

      utils.showStatus(
        elements.connectionStatus,
        "Web Serial API is not supported in this browser. Please use Chrome 89+, Edge 89+, or Opera 75+.",
        "error"
      );
    }
  },
};

//==============================================================================
// EVENT LISTENERS AND HANDLERS
//==============================================================================

/**
 * Initializes all event listeners for user interface elements
 */
function initializeEventListeners() {
  // Connection control buttons
  if (elements.connectBtn) {
    elements.connectBtn.addEventListener("click", serial.connect);
  }

  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener("click", serial.disconnect);
  }

  // Update control buttons
  if (elements.uploadBtn) {
    elements.uploadBtn.addEventListener("click", updater.startUpdate);
  }

  if (elements.abortBtn) {
    elements.abortBtn.addEventListener("click", updater.abortUpdate);
  }

  // File selection handler with validation
  if (elements.firmwareFile) {
    elements.firmwareFile.addEventListener("change", (e) => {
      if (elements.uploadBtn) {
        elements.uploadBtn.disabled =
          !e.target.files[0] || !isConnected || updateInProgress;
      }
    });
  }

  // Page visibility change warning during updates
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && updateInProgress) {
      console.warn("Page hidden during update - this may cause issues");
    }
  });

  // Prevent accidental page closure during updates
  window.addEventListener("beforeunload", (e) => {
    if (updateInProgress) {
      e.preventDefault();
      return "";
    }
  });
}

//==============================================================================
// GLOBAL ERROR HANDLING
//==============================================================================

/**
 * Global error handler for uncaught JavaScript errors
 */
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
  if (updateInProgress) {
    utils.showStatus(
      elements.updateStatus,
      "An unexpected error occurred during update",
      "error"
    );
    updateInProgress = false;
    ui.updateUpdateState(false);
  }
});

/**
 * Global handler for unhandled Promise rejections
 */
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  if (updateInProgress) {
    utils.showStatus(
      elements.updateStatus,
      "An unexpected error occurred during update",
      "error"
    );
    updateInProgress = false;
    ui.updateUpdateState(false);
  }
});

//==============================================================================
// APPLICATION INITIALIZATION
//==============================================================================

/**
 * Initializes the application on page load
 */
function init() {
  if (!initializeElements()) {
    console.error("Failed to initialize DOM elements");
    return;
  }

  ui.checkCompatibility();
  initializeEventListeners();

  ui.updateConnectionState(false);
  ui.updateUpdateState(false);
  utils.hideStatus(elements.connectionStatus);
  utils.hideStatus(elements.updateStatus);
  utils.resetProgress();
}

/**
 * Start the application when DOM is ready
 */
document.addEventListener("DOMContentLoaded", init);
