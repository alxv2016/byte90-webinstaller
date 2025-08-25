import { useAppContext } from '../contexts/AppContext';
import ConnectionNotification from './connection-notification';
import './connection-status.css';
import StatusAnnouncer from './status-announcer';

export default function ConnectionStatus() {
  const { isConnected, disconnect, connectionStatus } = useAppContext();

  if (!isConnected || connectionStatus.type !== 'success') {
    return null;
  }

  const handleDisconnect = async (): Promise<void> => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  return (
    <div className='connection-status-container'>
      <div className='connection-status'>
        <div className='connection-status__content'>
          <div className='connection-status-message'>
            <StatusAnnouncer
              label={connectionStatus.type}
              message={connectionStatus.message}
            />
          </div>
          <button
            className='btn btn-rounded btn-outline'
            onClick={handleDisconnect}
            type='button'
            aria-label='Disconnect from BYTE-90 device'
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
