import ConnectionNotification from './connection-notification';
import NetworkList from './network-list';
import { useAppContext } from '../contexts/AppContext';
import { useEffect, useRef } from 'react';
import WifiIcon from '../assets/wifi.svg?react';
import ShowIcon from '../assets/show.svg?react';
import HideIcon from '../assets/hide.svg?react';
import CardComponent from './card-component';
import FormControl from './form-control';
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
    console.log('Password input value:', event.target.value);
    setPassword(event.target.value);
  };

  const handleConnectToNetwork = async () => {
    if (!selectedNetwork || !password.trim()) return;

    try {
      // If currently connected to a different network, disconnect first
      if (isCurrentlyConnected && connectedNetwork !== selectedNetwork) {
        await disconnectFromNetwork();
      }

      // Connect to the selected network
      await connectToNetwork();
    } catch (error) {
      console.error('Failed to connect to network:', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isConnecting && selectedNetwork && password) {
      handleConnectToNetwork();
    }
  };

  // Debug logging for connection form visibility
  console.log('WiFi Connection Debug:', {
    selectedNetwork,
    isCurrentlyConnected,
    shouldShowForm: selectedNetwork && !isCurrentlyConnected,
    password: password ? 'has password' : 'no password',
  });

  if (!isSerialConnected) {
    return null;
  }

  return (
    <CardComponent icon={WifiIcon} title='WiFi'>
      <ConnectionNotification
        message={scanStatus.message}
        type={scanStatus.type as any}
      />
      <NetworkList
        networks={networks}
        selectedNetwork={selectedNetwork}
        isCurrentlyConnected={isCurrentlyConnected}
        onNetworkSelect={handleNetworkSelect}
        connectedNetworkSSID={connectedNetwork}
      />

      <div className='wifi-connection-form'>
        <FormControl label='WiFi Password' htmlFor='password'>
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
            className='password-toggle-btn'
            type='button'
            onClick={togglePasswordVisibility}
            disabled={isConnecting || isDisconnecting}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            {isPasswordVisible ? (
              <HideIcon className='password-icon' />
            ) : (
              <ShowIcon className='password-icon' />
            )}
          </button>
        </FormControl>
        <div className='wifi-connection-form__actions'>
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
            Scan Networdks
          </button>
          <button
            className='btn btn-primary'
            onClick={handleConnectToNetwork}
            disabled={
              isConnecting ||
              isDisconnecting ||
              !password.trim() ||
              !selectedNetwork
            }
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </CardComponent>
  );
}
