import { useAppContext } from '../contexts/AppContext';
import ConnectionNotification from './connection-notification';
import './connection-status.css';

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
    <div className='connection-status'>
      <div className='connection-status__content'>
        <div className='connection-status-message'>
          <ConnectionNotification
            message={connectionStatus.message}
            type={connectionStatus.type}
          />
        </div>
        <button
          className='btn btn-muted'
          onClick={handleDisconnect}
          type='button'
          aria-label='Disconnect from BYTE-90 device'
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
