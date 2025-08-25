import ConnectionCard from './components/connection-card';
import ConnectionStatus from './components/connection-status';
import DeviceInfo from './components/device-info';
import WiFiConnectionCard from './components/wifi-connection-card';
import WifiStatusCard from './components/wifi-status-card';
import FirmwareUpdateCard from './components/firmware-update-card';
import CompatibilityStatus from './components/compatibility-status';
import SupportCard from './components/support-card';
import { AppProvider, useAppContext } from './contexts/AppContext';
import Byte90Logo from './assets/byte90_logo.svg?react';
import './app.css';

// App component
export default function App() {
  return (
    <AppProvider>
      <main role='main' aria-label='BYTE-90 Device Manager'>
        <Byte90Logo className='byte90-logo' />
        <ConnectionCard />
        <ConnectedComponents />
        <DisconnectedComponents />
        <AppAccessibilityAnnouncements />
      </main>
    </AppProvider>
  );
}

// Component that only renders when connected
function ConnectedComponents() {
  const { isConnected, connectionStatus } = useAppContext();

  if (!isConnected || connectionStatus.type !== 'success') {
    return null;
  }

  return (
    <div className='connected-components'>
      <DeviceInfo />
      <WifiStatusCard />
      <WiFiConnectionCard />
      <FirmwareUpdateCard />
      <SupportCard />
      <ConnectionStatus />
    </div>
  );
}

// Component that only renders when disconnected
function DisconnectedComponents() {
  const { isConnected, connectionStatus } = useAppContext();

  if (isConnected && connectionStatus.type === 'success') {
    return null;
  }

  return (
    <>
      <CompatibilityStatus />
    </>
  );
}

// Separate component for accessibility announcements
function AppAccessibilityAnnouncements() {
  const { updateInProgress } = useAppContext();

  return (
    <div role='status' aria-live='polite' aria-atomic='true'>
      {updateInProgress &&
        'Firmware update in progress. Please do not close this window.'}
    </div>
  );
}
