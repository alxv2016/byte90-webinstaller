import { useMemo } from 'react';
import ByteLogo from './bytelogo';
import StatusNotification from './statusnotification';
import WiFiConnectionCard from './wifi-connection-card';
import UpdateCard from './update-card';
import TabNavigation from './tab-navigation';

// Import types from centralized location
import type {
  ConnectionCardProps,
  UseSerialReturn,
  StatusMessage,
  ProgressUpdate,
  UpdateType,
} from '../data/webserial.interface';

interface ExtendedConnectionCardProps extends ConnectionCardProps {
  serial: UseSerialReturn;
  updateInProgress: boolean;
  updateStatus: StatusMessage;
  progress: ProgressUpdate;
  showProgress: boolean;
  onStartUpdate: (file: File, updateType: UpdateType) => Promise<void>;
  onAbortUpdate: () => Promise<void>;
}

export default function ConnectionCard({
  isConnected,
  deviceInfo,
  connectionStatus,
  onConnect,
  onDisconnect,
  serial,
  updateInProgress,
  updateStatus,
  progress,
  showProgress,
  onStartUpdate,
  onAbortUpdate,
}: ExtendedConnectionCardProps) {
  // Memoize tab content to prevent component unmounting/remounting
  const wifiTabContent = useMemo(
    () => (
      <WiFiConnectionCard
        serial={serial}
        isSerialConnected={isConnected}
        deviceInfo={deviceInfo}
      />
    ),
    [serial, isConnected, deviceInfo]
  );

  const updateTabContent = useMemo(
    () => (
      <UpdateCard
        updateInProgress={updateInProgress}
        updateStatus={updateStatus}
        progress={progress}
        showProgress={showProgress}
        onStartUpdate={onStartUpdate}
        onAbortUpdate={onAbortUpdate}
      />
    ),
    [
      updateInProgress,
      updateStatus,
      progress,
      showProgress,
      onStartUpdate,
      onAbortUpdate,
    ]
  );

  const handleConnect = async (): Promise<void> => {
    try {
      await onConnect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    try {
      await onDisconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  return (
    <div className='card-wrapper'>
      <div className='card'>
        <div className='card__header'>
          <ByteLogo />
          <h1 className='card__title'>BYTE-90 Device Manager</h1>
          <p className='card__description'>
            Connect to your BYTE-90 device to manage WiFi settings and firmware
            updates. Put the device in Update Mode and connect via USB-C cable.
          </p>
        </div>

        <div className='card__body'>
          <div className='form-control'>
            <div className='connection-controls'>
              {!isConnected ? (
                <button
                  className='btn btn-primary'
                  onClick={handleConnect}
                  type='button'
                  aria-label='Connect to BYTE-90 device'
                >
                  Connect
                </button>
              ) : (
                <button
                  className='btn btn-muted'
                  onClick={handleDisconnect}
                  type='button'
                  aria-label='Disconnect from BYTE-90 device'
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {isConnected && deviceInfo && (
            <div
              className='device-info'
              role='region'
              aria-label='Device Information'
            >
              <div className='info-grid'>
                <div className='info-item'>
                  <span className='info-label'>Firmware Version:</span>
                  <span
                    className='info-value'
                    title={deviceInfo.firmware_version || 'Not available'}
                  >
                    {deviceInfo.firmware_version || '--'}
                  </span>
                </div>
                <div className='info-item'>
                  <span className='info-label'>MCU Model:</span>
                  <span
                    className='info-value'
                    title={deviceInfo.mcu || 'Not available'}
                  >
                    {deviceInfo.mcu || '--'}
                  </span>
                </div>
                <div className='info-item'>
                  <span className='info-label'>Available Space:</span>
                  <span
                    className='info-value'
                    title={deviceInfo.flash_available || 'Not available'}
                  >
                    {deviceInfo.flash_available || '--'}
                  </span>
                </div>
                <div className='info-item'>
                  <span className='info-label'>Free Heap:</span>
                  <span
                    className='info-value'
                    title={deviceInfo.free_heap || 'Not available'}
                  >
                    {deviceInfo.free_heap || '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation - only show when connected */}
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
        </div>

        <StatusNotification
          message={connectionStatus.message}
          type={connectionStatus.type}
        />
      </div>
    </div>
  );
}
