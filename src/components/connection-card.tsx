import React from 'react';
import ByteLogo from './bytelogo';
import StatusNotification from './statusnotification';

// Import types from centralized location
import type { ConnectionCardProps } from '../data/webserial.interface';

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  isConnected,
  deviceInfo,
  connectionStatus,
  onConnect,
  onDisconnect,
}) => {
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
          <h1 className='card__title'>BYTE-90 Firmware Update</h1>
          <p className='card__description'>
            To update your BYTE-90 firmware, put the device in Update Mode,
            connect via the provided USB-C cable, and connect to continue.
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
        </div>

        <StatusNotification
          message={connectionStatus.message}
          type={connectionStatus.type}
        />
      </div>
    </div>
  );
};

export default ConnectionCard;
