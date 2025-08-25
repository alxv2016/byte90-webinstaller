import { useAppContext } from '../contexts/AppContext';
import InfoIcon from '../assets/info.svg?react';
import CardComponent from './card-component';
import StatusAnnouncer from './status-announcer';

export default function ConnectionCard() {
  const { isConnected, connect, connectionStatus } = useAppContext();

  const handleConnect = async (): Promise<void> => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  // Don't render the card if already connected and successful
  if (isConnected && connectionStatus.type === 'success') {
    return null;
  }

  return (
    <CardComponent
      title='BYTE-90 Device Manager'
      description='Connect to your BYTE-90 device to manage WiFi settings and firmware updates. Put the device in Update Mode and connect via USB-C cable.'
      footerIcon={InfoIcon}
      footerDescription='Put your device into Update Mode and connect via USB-C cable.'
    >
      <button
        className='btn btn-primary'
        onClick={handleConnect}
        type='button'
        disabled={isConnected || connectionStatus.type === 'success'}
        aria-label='Connect to BYTE-90 device'
      >
        {isConnected || connectionStatus.type === 'success'
          ? 'Connected'
          : 'Connect'}
      </button>
      <StatusAnnouncer
        label='Status'
        message={connectionStatus.message || 'Not connected'}
      />
    </CardComponent>
  );
}
