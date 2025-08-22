import ConnectionCard from './components/connection-card';
import ConnectionStatus from './components/connection-status';
import DeviceInfo from './components/device-info';
import WiFiConnectionCard from './components/wifi-connection-card';
import FirmwareUpdateCard from './components/firmware-update-card';
import CompatibilityStatus from './components/compatibility-status';
import { AppProvider, useAppContext } from './contexts/AppContext';

// App component
export default function App() {
  return (
    <AppProvider>
      <main role='main' aria-label='BYTE-90 Device Manager'>
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
    <>
      <ConnectionStatus />
      <DeviceInfo />
      <WiFiConnectionCard />
      <FirmwareUpdateCard />
    </>
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
