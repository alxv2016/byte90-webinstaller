import { useState, useCallback } from 'react';
import StatusNotification from './statusnotification';
import NetworkList from './network-list';
import type {
  UseSerialReturn,
  WiFiStatus,
  Network,
  DeviceInfo,
} from '../data/webserial.interface';

interface WiFiConnectionCardProps {
  serial: UseSerialReturn;
  isSerialConnected: boolean;
  deviceInfo: DeviceInfo | null;
}

export default function WiFiConnectionCard({
  serial,
  isSerialConnected,
  deviceInfo,
}: WiFiConnectionCardProps) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<{
    message: string;
    type: string;
  }>({
    message: '',
    type: '',
  });
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [isCurrentlyConnected, setIsCurrentlyConnected] =
    useState<boolean>(false);
  const [connectedNetwork, setConnectedNetwork] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  const scanNetworks = useCallback(async (): Promise<void> => {
    if (!serial.isConnected || isScanning) return;

    setIsScanning(true);
    setScanStatus({
      message: 'Scanning for networks...',
      type: 'info',
    });

    try {
      const response = await serial.sendCommand('WIFI_SCAN');

      const parsedResponse = response as unknown as WiFiStatus;

      if (parsedResponse.success && parsedResponse.networks) {
        // Sort networks by signal strength (RSSI)
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

  const handleNetworkSelect = (ssid: string) => {
    setSelectedNetwork(ssid);
    setPassword(''); // Clear password when switching networks
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

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

      // Send actual command to device
      const response = await serial.sendCommand('WIFI_CONNECT', connectData);
      console.log('WiFi Connect Response:', response);

      // Handle different response formats
      let isSuccess = false;
      let message = '';

      if (response && typeof response === 'object' && 'success' in response) {
        // Standard response format
        isSuccess = response.success === true;
        message = response.message || '';
      } else {
        // Unknown response format
        isSuccess = false;
        message = `Unexpected response format: ${JSON.stringify(response)}`;
      }

      if (isSuccess) {
        console.log(`✅ Successfully connected to ${selectedNetwork}`);
        setScanStatus({
          message: `✅ Successfully connected to ${selectedNetwork}`,
          type: 'success',
        });

        // Update connection state
        setIsCurrentlyConnected(true);
        setConnectedNetwork(selectedNetwork);
        setSelectedNetwork(''); // Clear selection
        setPassword(''); // Clear password
      } else {
        console.log(`❌ Failed to connect to ${selectedNetwork}: ${message}`);
        setScanStatus({
          message: `❌ Failed to connect: ${message}`,
          type: 'error',
        });
      }
    } catch (error) {
      // Check if error message indicates "Unknown command"
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`❌ Connection error: ${errorMsg}`);
      if (errorMsg.includes('Unknown command')) {
        setScanStatus({
          message: 'WIFI_CONNECT command not supported by device firmware',
          type: 'error',
        });
      } else {
        setScanStatus({
          message: `Connection failed: ${errorMsg}`,
          type: 'error',
        });
      }
    } finally {
      setIsConnecting(false);
    }
  }, [selectedNetwork, password, serial]);

  const disconnectFromNetwork = useCallback(async (): Promise<void> => {
    setIsDisconnecting(true);

    const networkToDisconnect = connectedNetwork || 'current network';
    setScanStatus({
      message: `Force disconnecting from ${networkToDisconnect}...`,
      type: 'info',
    });

    // Always force disconnect the UI state first
    setIsCurrentlyConnected(false);
    setConnectedNetwork('');
    setSelectedNetwork('');
    setPassword('');

    if (!serial.isConnected) {
      setScanStatus({
        message: '✅ Force disconnected (serial not connected)',
        type: 'success',
      });
      setIsDisconnecting(false);
      return;
    }

    try {
      console.log('Attempting to disconnect from WiFi network');
      // Send actual command to device
      const response = await serial.sendCommand('WIFI_DISCONNECT');
      console.log('WiFi Disconnect Response:', response);

      // Handle response (but don't change UI state based on it)
      let isSuccess = false;
      let message = '';

      if (response && typeof response === 'object' && 'success' in response) {
        isSuccess = response.success === true;
        message = response.message || '';
      } else {
        isSuccess = false;
        message = `Unexpected disconnect response: ${JSON.stringify(response)}`;
      }

      if (isSuccess) {
        console.log('✅ Successfully disconnected from WiFi');
        setScanStatus({
          message: `✅ Force disconnected and device confirmed`,
          type: 'success',
        });
      } else {
        console.log(`⚠️ Disconnect command sent but device error: ${message}`);
        setScanStatus({
          message: `✅ Force disconnected (device error: ${message})`,
          type: 'warning',
        });
      }
    } catch (error) {
      console.log(
        `⚠️ Disconnect command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setScanStatus({
        message: `✅ Force disconnected (command failed: ${error instanceof Error ? error.message : 'Unknown error'})`,
        type: 'warning',
      });
    }

    // Always check WiFi status after disconnect attempt to verify
    try {
      // Wait a moment for the device to process the disconnect
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await serial.sendCommand('WIFI_STATUS');

      // Analyze the status response
      if (statusResponse && typeof statusResponse === 'object') {
        const isStillConnected =
          statusResponse.connected === true ||
          statusResponse.status === 'CONNECTED';
        const currentSSID = statusResponse.ssid || '';

        if (isStillConnected && currentSSID) {
          setScanStatus({
            message: `⚠️ UI disconnected but device still reports connected to ${currentSSID}`,
            type: 'warning',
          });
        } else {
          setScanStatus({
            message:
              '✅ Force disconnected and verified device is disconnected',
            type: 'success',
          });
        }
      }
    } catch (statusError) {
      // Error handling without logging
    } finally {
      setIsDisconnecting(false);
    }
  }, [serial, connectedNetwork]);

  const checkWiFiStatus = useCallback(async (): Promise<void> => {
    if (!serial.isConnected) {
      setScanStatus({
        message: 'Cannot check WiFi status - serial not connected',
        type: 'error',
      });
      return;
    }

    setIsCheckingStatus(true);
    setScanStatus({
      message: 'Checking WiFi status...',
      type: 'info',
    });

    try {
      // Send WIFI_STATUS command to device
      const response = await serial.sendCommand('WIFI_STATUS');

      // Analyze the status response
      if (response && typeof response === 'object' && 'success' in response) {
        // Status check succeeded if we got a valid response (regardless of connection state)
        if (response.success !== undefined) {
          const isConnected =
            response.connected === true || response.status === 'CONNECTED';
          const currentSSID = String(response.ssid || '');
          const signalStrength = response.signal_strength || '';
          const rssi = response.rssi || 0;

          if (isConnected && currentSSID) {
            setScanStatus({
              message: `✅ Connected to ${currentSSID} (${signalStrength}, ${rssi} dBm)`,
              type: 'success',
            });

            // Update UI state if device reports connected but UI shows disconnected
            if (!isCurrentlyConnected) {
              setIsCurrentlyConnected(true);
              setConnectedNetwork(currentSSID);
            }
          } else {
            setScanStatus({
              message: `📶 Not connected - Status: ${response.status || 'Unknown'}`,
              type: 'info',
            });

            // Update UI state if device reports disconnected but UI shows connected
            if (isCurrentlyConnected) {
              setIsCurrentlyConnected(false);
              setConnectedNetwork('');
            }
          }
        } else {
          setScanStatus({
            message: `❌ Status check failed: ${response.message || 'Unknown error'}`,
            type: 'error',
          });
        }
      } else {
        setScanStatus({
          message: '❓ Unexpected status response format',
          type: 'warning',
        });
      }
    } catch (error) {
      setScanStatus({
        message: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [serial, isCurrentlyConnected]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isConnecting && selectedNetwork && password) {
      connectToNetwork();
    }
  };

  if (!isSerialConnected) {
    return null;
  }

  return (
    <div className='card-wrapper'>
      <h2 className='section-title'>WiFi Scanner & Connector</h2>
      <div className='card'>
        <div className='card__header'>
          <h3 className='card__title'>Available Networks</h3>
          <p className='card__description'>
            Scan for WiFi networks and select one to connect. Connection
            attempts will be logged to the console for now.
          </p>
        </div>

        <div className='card__body'>
          {isCurrentlyConnected && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                border: '1px solid #4caf50',
                borderRadius: '6px',
                backgroundColor: '#f1f8e9',
              }}
            >
              <h4
                style={{
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  color: '#2e7d32',
                }}
              >
                ✅ Currently Connected
              </h4>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong>Network:</strong> {connectedNetwork}
              </div>
              <button
                onClick={disconnectFromNetwork}
                disabled={isDisconnecting}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isDisconnecting ? '#ccc' : '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )}

          <div className='form-control'>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                className='btn btn-primary'
                onClick={scanNetworks}
                disabled={
                  !deviceInfo ||
                  isScanning ||
                  isConnecting ||
                  isDisconnecting ||
                  isCheckingStatus
                }
                type='button'
                title={!deviceInfo ? 'Waiting for device information...' : ''}
              >
                {isScanning ? 'Scanning...' : 'Scan for Networks'}
              </button>

              <button
                onClick={checkWiFiStatus}
                disabled={isCheckingStatus || isConnecting || isDisconnecting}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: isCheckingStatus ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isCheckingStatus ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {isCheckingStatus ? 'Checking...' : 'Check WiFi Status'}
              </button>

              <button
                onClick={disconnectFromNetwork}
                disabled={isDisconnecting || isCheckingStatus}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: isDisconnecting ? '#ccc' : '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {isDisconnecting
                  ? 'Force Disconnecting...'
                  : 'Force Disconnect'}
              </button>
            </div>
          </div>

          {/* Always show network list area */}
          <div style={{ marginTop: '1rem' }}>
            {networks.length > 0 ? (
              <NetworkList
                networks={networks}
                selectedNetwork={selectedNetwork}
                isCurrentlyConnected={isCurrentlyConnected}
                onNetworkSelect={handleNetworkSelect}
              />
            ) : (
              <div className='no-networks'>
                <h4
                  style={{
                    marginBottom: '0.5rem',
                    fontSize: '1rem',
                    color: '#333',
                  }}
                >
                  Available Networks
                </h4>
                <div
                  style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: '#666',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  {!deviceInfo ? (
                    <p>
                      📡 Waiting for device connection...
                      <br />
                      <span style={{ fontSize: '0.9rem', color: '#888' }}>
                        Connect to your device to scan for WiFi networks
                      </span>
                    </p>
                  ) : !isScanning && networks.length === 0 ? (
                    <p>
                      📶 No networks scanned yet
                      <br />
                      <span style={{ fontSize: '0.9rem', color: '#888' }}>
                        Click "Scan for Networks" to discover available WiFi
                        networks
                      </span>
                    </p>
                  ) : isScanning ? (
                    <p>
                      🔄 Scanning for networks...
                      <br />
                      <span style={{ fontSize: '0.9rem', color: '#888' }}>
                        Please wait while we discover available WiFi networks
                      </span>
                    </p>
                  ) : (
                    <p>
                      📭 No networks found
                      <br />
                      <span style={{ fontSize: '0.9rem', color: '#888' }}>
                        Try scanning again or check your device's WiFi
                        capability
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedNetwork && !isCurrentlyConnected && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: '#fff',
              }}
            >
              <h4
                style={{
                  marginBottom: '0.75rem',
                  fontSize: '1rem',
                  color: '#333',
                }}
              >
                Connect to: {selectedNetwork}
              </h4>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor='password'
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    color: '#555',
                  }}
                >
                  WiFi Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    id='password'
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyPress={handleKeyPress}
                    disabled={isConnecting || isDisconnecting}
                    placeholder='Enter network password'
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '3rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type='button'
                    onClick={togglePasswordVisibility}
                    disabled={isConnecting || isDisconnecting}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor:
                        isConnecting || isDisconnecting
                          ? 'not-allowed'
                          : 'pointer',
                      padding: '0.25rem',
                      color: '#666',
                    }}
                    aria-label={
                      isPasswordVisible ? 'Hide password' : 'Show password'
                    }
                  >
                    {isPasswordVisible ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: '#666',
                    marginTop: '0.25rem',
                  }}
                >
                  Press Enter to connect, or use the Connect button below.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={connectToNetwork}
                  disabled={isConnecting || isDisconnecting || !password.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor:
                      isConnecting || isDisconnecting || !password.trim()
                        ? '#ccc'
                        : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor:
                      isConnecting || isDisconnecting || !password.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>

                <button
                  onClick={() => {
                    setSelectedNetwork('');
                    setPassword('');
                  }}
                  disabled={isConnecting || isDisconnecting}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor:
                      isConnecting || isDisconnecting
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '1rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <StatusNotification
          message={scanStatus.message}
          type={scanStatus.type as any}
        />
      </div>
    </div>
  );
}
