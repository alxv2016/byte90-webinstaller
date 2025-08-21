import ConnectionCard from './components/connection-card';
import CompatibilityCard from './components/compatibility-card';
import { AppProvider, useAppContext } from './contexts/AppContext';

// App component
export default function App() {
  return (
    <AppProvider>
      <main role='main' aria-label='BYTE-90 Device Manager'>
        <ConnectionCard />
        <CompatibilityCard />
        <AppAccessibilityAnnouncements />
      </main>
    </AppProvider>
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
