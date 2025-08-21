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
      return '[SECURED]'; // Secured network
    }
    return '[OPEN]'; // Open network
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
    <>
      <h4>Found {networks.length} networks:</h4>
      {networks.map((network, index) => (
        <div
          key={`${network.ssid}-${index}`}
          onClick={() => !isCurrentlyConnected && onNetworkSelect(network.ssid)}
        >
          <span>{network.ssid}</span>
          <span title={network.secure ? 'Secured' : 'Open'}>
            {getSecurityIcon(network)}
          </span>
          <span>
            Signal: {network.signal_strength || getSignalStrength(network.rssi)}
          </span>
          <span>({network.rssi} dBm)</span>
          {network.security && <span>{network.security}</span>}
        </div>
      ))}
    </>
  );
}
