import { useAppContext } from '../contexts/AppContext';
import './connection-card.css';

export default function ConnectionCard() {
  const { isConnected, connect, connectionStatus } = useAppContext();

  const handleConnect = async (): Promise<void> => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  if (isConnected && connectionStatus.type == 'success') {
    return null;
  }

  return (
    <>
      <div className='connection-card'>
        <div className='connection-card__content'>
          <h1>BYTE-90 Device Manager</h1>
          <p>
            Connect to your BYTE-90 device to manage WiFi settings and firmware
            updates. Put the device in Update Mode and connect via USB-C cable.
          </p>
        </div>
        <button
          className='btn btn-primary'
          onClick={handleConnect}
          type='button'
          aria-label='Connect to BYTE-90 device'
        >
          Connect
        </button>
        {connectionStatus.message && (
          <div role='alert' aria-live='assertive'>
            <p>{connectionStatus.message}</p>
          </div>
        )}
      </div>
    </>
  );
}
