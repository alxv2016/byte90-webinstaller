import React, { useState, useCallback } from 'react';
import StatusNotification from './statusnotification';
import type {
  UseSerialReturn,
  WiFiStatus,
  Network,
} from '../data/webserial.interface';

interface WiFiConnectionCardProps {
  serial: UseSerialReturn;
  isSerialConnected: boolean;
}

const WiFiConnectionCard: React.FC<WiFiConnectionCardProps> = ({
  serial,
  isSerialConnected,
}) => {
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

  const getSecurityIcon = (network: Network) => {
    if (network.secure) {
      return '🔒'; // Secured network
    }
    return '📶'; // Open network
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -60) return 'Good';
    if (rssi >= -70) return 'Fair';
    return 'Weak';
  };

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

      // Send actual command to device
      const response = await serial.sendCommand('WIFI_CONNECT', connectData);

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
        setScanStatus({
          message: `❌ Failed to connect: ${message}`,
          type: 'error',
        });
      }
    } catch (error) {
      // Check if error message indicates "Unknown command"
      const errorMsg = error instanceof Error ? error.message : String(error);
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
      // Send actual command to device
      const response = await serial.sendCommand('WIFI_DISCONNECT');

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
        setScanStatus({
          message: `✅ Force disconnected and device confirmed`,
          type: 'success',
        });
      } else {
        setScanStatus({
          message: `✅ Force disconnected (device error: ${message})`,
          type: 'warning',
        });
      }
    } catch (error) {
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
                  isScanning ||
                  isConnecting ||
                  isDisconnecting ||
                  isCheckingStatus
                }
                type='button'
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

          {networks.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4
                style={{
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  color: '#333',
                }}
              >
                Found {networks.length} networks:
              </h4>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {networks.map((network, index) => (
                  <div
                    key={`${network.ssid}-${index}`}
                    onClick={() =>
                      !isCurrentlyConnected && handleNetworkSelect(network.ssid)
                    }
                    style={{
                      padding: '0.75rem',
                      border:
                        selectedNetwork === network.ssid
                          ? '2px solid #2196f3'
                          : '1px solid #e0e0e0',
                      borderRadius: '6px',
                      backgroundColor:
                        selectedNetwork === network.ssid
                          ? '#f3f9ff'
                          : '#fafafa',
                      cursor: isCurrentlyConnected ? 'not-allowed' : 'pointer',
                      opacity: isCurrentlyConnected ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#333' }}>
                          {network.ssid}
                        </span>
                        <span
                          style={{ fontSize: '1.1em' }}
                          title={network.secure ? 'Secured' : 'Open'}
                        >
                          {getSecurityIcon(network)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          fontSize: '0.85rem',
                          color: '#666',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          Signal:{' '}
                          {network.signal_strength ||
                            getSignalStrength(network.rssi)}
                        </span>
                        <span style={{ fontFamily: 'monospace' }}>
                          ({network.rssi} dBm)
                        </span>
                        {network.security && (
                          <span
                            style={{
                              padding: '0.15rem 0.4rem',
                              backgroundColor: '#e3f2fd',
                              borderRadius: '3px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: '#1976d2',
                            }}
                          >
                            {network.security}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {networks.length === 0 && !isScanning && (
            <div className='no-networks'>
              <p
                style={{ textAlign: 'center', color: '#666', margin: '1rem 0' }}
              >
                No networks found. Click "Scan for Networks" to search for
                available WiFi networks.
              </p>
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
};

export default WiFiConnectionCard;
