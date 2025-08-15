import type { Network } from '../data/webserial.interface';

interface NetworkListProps {
  networks: Network[];
  selectedNetwork: string;
  isCurrentlyConnected: boolean;
  onNetworkSelect: (ssid: string) => void;
}

export default function NetworkList({
  networks,
  selectedNetwork,
  isCurrentlyConnected,
  onNetworkSelect,
}: NetworkListProps) {
  const getSecurityIcon = (network: Network) => {
    if (network.secure) {
      return '🔒'; // Secured network
    }
    return '📶'; // Open network
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -60) return 'Good';
    if (rssi >= -70) return 'Fair';
    return 'Weak';
  };

  if (networks.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <h4
        style={{
          marginBottom: '0.5rem',
          fontSize: '1rem',
          color: '#333',
        }}
      >
        Found {networks.length} networks:
      </h4>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {networks.map((network, index) => (
          <div
            key={`${network.ssid}-${index}`}
            onClick={() =>
              !isCurrentlyConnected && onNetworkSelect(network.ssid)
            }
            style={{
              padding: '0.75rem',
              border:
                selectedNetwork === network.ssid
                  ? '2px solid #2196f3'
                  : '1px solid #e0e0e0',
              borderRadius: '6px',
              backgroundColor:
                selectedNetwork === network.ssid ? '#f3f9ff' : '#fafafa',
              cursor: isCurrentlyConnected ? 'not-allowed' : 'pointer',
              opacity: isCurrentlyConnected ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 600, color: '#333' }}>
                  {network.ssid}
                </span>
                <span
                  style={{ fontSize: '1.1em' }}
                  title={network.secure ? 'Secured' : 'Open'}
                >
                  {getSecurityIcon(network)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                  color: '#666',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  Signal:{' '}
                  {network.signal_strength || getSignalStrength(network.rssi)}
                </span>
                <span style={{ fontFamily: 'monospace' }}>
                  ({network.rssi} dBm)
                </span>
                {network.security && (
                  <span
                    style={{
                      padding: '0.15rem 0.4rem',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#1976d2',
                    }}
                  >
                    {network.security}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
