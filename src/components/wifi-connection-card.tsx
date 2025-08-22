import ConnectionNotification from './connection-notification';
import NetworkList from './network-list';
import { useAppContext } from '../contexts/AppContext';
import { useEffect, useRef } from 'react';
import './wifi-connection-card.css';

// No props needed - using context

export default function WiFiConnectionCard() {
  const {
    isConnected: isSerialConnected,
    deviceInfo,
    networks,
    isScanning,
    scanStatus,
    selectedNetwork,
    password,
    isPasswordVisible,
    isConnecting,
    isDisconnecting,
    isCurrentlyConnected,
    connectedNetwork,
    isCheckingStatus,
    connectionStatus,
    scanNetworks,
    handleNetworkSelect,
    setPassword,
    togglePasswordVisibility,
    connectToNetwork,
    disconnectFromNetwork,
    checkWiFiStatus,
  } = useAppContext();

  const hasCheckedStatus = useRef(false);

  // Check WiFi status when connection is successful
  useEffect(() => {
    if (
      connectionStatus.type === 'success' &&
      deviceInfo &&
      !isCheckingStatus &&
      !hasCheckedStatus.current
    ) {
      hasCheckedStatus.current = true;
      checkWiFiStatus();
    }
  }, [connectionStatus.type, deviceInfo, isCheckingStatus, checkWiFiStatus]);

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isConnecting && selectedNetwork && password) {
      connectToNetwork();
    }
  };

  if (!isSerialConnected) {
    return null;
  }

  return (
    <div className='card'>
      <div className='card__content'>
        <h2>WiFi Scanner & Connector</h2>
        <h3>Available Networks</h3>
        <p>
          Scan for WiFi networks and select one to connect. Connection attempts
          will be logged to the console for now.
        </p>

        {isCurrentlyConnected && (
          <>
            <h4>Currently Connected</h4>
            <div>
              <strong>Network:</strong> {connectedNetwork}
            </div>
            <button
              className='btn btn-primary'
              onClick={disconnectFromNetwork}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </>
        )}

        <button
          className='btn btn-secondary'
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
          className='btn btn-secondary'
          onClick={checkWiFiStatus}
          disabled={isCheckingStatus || isConnecting || isDisconnecting}
        >
          {isCheckingStatus ? 'Checking...' : 'Check WiFi Status'}
        </button>

        {networks.length > 0 ? (
          <NetworkList
            networks={networks}
            selectedNetwork={selectedNetwork}
            isCurrentlyConnected={isCurrentlyConnected}
            onNetworkSelect={handleNetworkSelect}
          />
        ) : (
          <>
            <h4>Available Networks</h4>
            {!deviceInfo ? (
              <p>
                Waiting for device connection...
                <br />
                <span>Connect to your device to scan for WiFi networks</span>
              </p>
            ) : !isScanning && networks.length === 0 ? (
              <p>
                No networks scanned yet
                <br />
                <span>
                  Click "Scan for Networks" to discover available WiFi networks
                </span>
              </p>
            ) : isScanning ? (
              <p>
                Scanning for networks...
                <br />
                <span>
                  Please wait while we discover available WiFi networks
                </span>
              </p>
            ) : (
              <p>
                No networks found
                <br />
                <span>
                  Try scanning again or check your device's WiFi capability
                </span>
              </p>
            )}
          </>
        )}

        {selectedNetwork && !isCurrentlyConnected && (
          <>
            <h4>Connect to: {selectedNetwork}</h4>
            <label htmlFor='password'>WiFi Password</label>
            <input
              type={isPasswordVisible ? 'text' : 'password'}
              id='password'
              value={password}
              onChange={handlePasswordChange}
              onKeyDown={handleKeyDown}
              disabled={isConnecting || isDisconnecting}
              placeholder='Enter network password'
            />
            <button
              type='button'
              onClick={togglePasswordVisibility}
              disabled={isConnecting || isDisconnecting}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? 'Hide' : 'Show'}
            </button>
            <p>Press Enter to connect, or use the Connect button below.</p>
            <button
              onClick={connectToNetwork}
              disabled={isConnecting || isDisconnecting || !password.trim()}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            <button
              onClick={() => {
                handleNetworkSelect('');
                setPassword('');
              }}
              disabled={isConnecting || isDisconnecting}
            >
              Cancel
            </button>
          </>
        )}

        <ConnectionNotification
          message={scanStatus.message}
          type={scanStatus.type as any}
        />
      </div>
    </div>
  );
}
