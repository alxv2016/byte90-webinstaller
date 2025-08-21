import { useMemo } from 'react';
import StatusNotification from './statusnotification';
import WiFiConnectionCard from './wifi-connection-card';
import UpdateCard from './update-card';
import TabNavigation from './tab-navigation';
import { useAppContext } from '../contexts/AppContext';

export default function ConnectionCard() {
  const {
    isConnected,
    deviceInfo,
    connectionStatus,
    connect,
    disconnect,
    serial,
    updateInProgress,
    updateStatus,
    progress,
    showProgress,
    startUpdate,
    abortUpdate,
  } = useAppContext();
  // Memoize tab content to prevent component unmounting/remounting
  const wifiTabContent = useMemo(() => <WiFiConnectionCard />, []);

  const updateTabContent = useMemo(() => <UpdateCard />, []);

  const handleConnect = async (): Promise<void> => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  return (
    <>
      <h1>BYTE-90 Device Manager</h1>
      <p>
        Connect to your BYTE-90 device to manage WiFi settings and firmware
        updates. Put the device in Update Mode and connect via USB-C cable.
      </p>

      {!isConnected ? (
        <button
          onClick={handleConnect}
          type='button'
          aria-label='Connect to BYTE-90 device'
        >
          Connect
        </button>
      ) : (
        <button
          onClick={handleDisconnect}
          type='button'
          aria-label='Disconnect from BYTE-90 device'
        >
          Disconnect
        </button>
      )}

      {isConnected && deviceInfo && (
        <div role='region' aria-label='Device Information'>
          <div>
            <span>Firmware Version:</span>
            <span title={deviceInfo.firmware_version || 'Not available'}>
              {deviceInfo.firmware_version || '--'}
            </span>
          </div>
          <div>
            <span>MCU Model:</span>
            <span title={deviceInfo.mcu || 'Not available'}>
              {deviceInfo.mcu || '--'}
            </span>
          </div>
          <div>
            <span>Available Space:</span>
            <span title={deviceInfo.flash_available || 'Not available'}>
              {deviceInfo.flash_available || '--'}
            </span>
          </div>
          <div>
            <span>Free Heap:</span>
            <span title={deviceInfo.free_heap || 'Not available'}>
              {deviceInfo.free_heap || '--'}
            </span>
          </div>
        </div>
      )}

      {isConnected && (
        <TabNavigation
          tabs={[
            {
              id: 'wifi',
              label: 'WiFi Settings',
              content: wifiTabContent,
            },
            {
              id: 'update',
              label: 'Firmware Update',
              content: updateTabContent,
            },
          ]}
          defaultActiveTab='wifi'
        />
      )}

      <StatusNotification
        message={connectionStatus.message}
        type={connectionStatus.type}
      />
    </>
  );
}
