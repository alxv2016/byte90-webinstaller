import { useAppContext } from '../contexts/AppContext';
import RefreshIcon from '../assets/refresh.svg?react';
import WifiIcon from '../assets/wifi.svg?react';
import './wifi-status-card.css';

export default function WifiStatusCard() {
  const {
    isCurrentlyConnected,
    connectedNetwork,
    isCheckingStatus,
    isDisconnecting,
    checkWiFiStatus,
    disconnectFromNetwork,
  } = useAppContext();

  if (!isCurrentlyConnected) {
    return null;
  }

  return (
    <div className='wifi-status-card'>
      <div className='wifi-status-card__content'>
        <div className='wifi-status-card__status'>
          <WifiIcon className='wifi-icon' />
          <span className='wifi-status-card__label'>Connected</span>
          <span className='wifi-status-card__network'>{connectedNetwork}</span>
        </div>

        <div className='wifi-status-card__actions'>
          <button
            className='btn btn-icon btn-rounded btn-outline-inverse'
            onClick={checkWiFiStatus}
            disabled={isCheckingStatus || isDisconnecting}
            aria-label='Refresh WiFi status'
            type='button'
          >
            <RefreshIcon className='refresh-icon' />
          </button>

          <button
            className='btn btn-rounded btn-outline-inverse'
            onClick={disconnectFromNetwork}
            disabled={isDisconnecting || isCheckingStatus}
            type='button'
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}
