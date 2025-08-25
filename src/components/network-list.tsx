import type { Network } from '../data/webserial.interface';
import { useState, useRef, useEffect } from 'react';
import WifiSecureIcon from '../assets/wifi_secure.svg?react';
import Wifi1BarIcon from '../assets/wifi_1bar.svg?react';
import Wifi2BarIcon from '../assets/wifi_2bar.svg?react';
import Wifi3BarIcon from '../assets/wifi_3bar.svg?react';
import Wifi4BarIcon from '../assets/wifi_4bar.svg?react';
import CheckIcon from '../assets/check.svg?react';
import WifiFindIcon from '../assets/wifi_find.svg?react';
import './network-list.css';

interface NetworkListProps {
  networks: Network[];
  selectedNetwork: string;
  isCurrentlyConnected: boolean;
  onNetworkSelect: (ssid: string) => void;
  connectedNetworkSSID?: string;
}

export default function NetworkList({
  networks,
  selectedNetwork,
  isCurrentlyConnected,
  onNetworkSelect,
  connectedNetworkSSID,
}: NetworkListProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  // Debug logging
  console.log('NetworkList Debug:', {
    connectedNetworkSSID,
    isCurrentlyConnected,
    networksCount: networks.length,
    networks: networks.map(n => ({
      ssid: n.ssid,
      isConnected: connectedNetworkSSID === n.ssid,
    })),
  });

  const getSecurityIcon = (network: Network) => {
    if (network.is_open) {
      return null; // No icon for open networks
    }
    return <WifiSecureIcon className='wifi-security-icon' />; // Secure icon
  };

  const getSignalStrengthIcon = (rssi: number) => {
    if (rssi >= -50) return <Wifi4BarIcon className='wifi-signal-icon' />;
    if (rssi >= -60) return <Wifi3BarIcon className='wifi-signal-icon' />;
    if (rssi >= -70) return <Wifi2BarIcon className='wifi-signal-icon' />;
    return <Wifi1BarIcon className='wifi-signal-icon' />;
  };

  const scrollToFocusedItem = (index: number) => {
    if (listRef.current && index >= 0) {
      const focusedElement = listRef.current.querySelector(
        `#network-option-${index}`
      );
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      }
    }
  };

  const handleListboxKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Tab':
        // Allow Tab to move focus in and out of the listbox naturally
        break;
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex =
          focusedIndex < networks.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(nextIndex);
        onNetworkSelect(networks[nextIndex].ssid);
        scrollToFocusedItem(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex =
          focusedIndex > 0 ? focusedIndex - 1 : networks.length - 1;
        setFocusedIndex(prevIndex);
        onNetworkSelect(networks[prevIndex].ssid);
        scrollToFocusedItem(prevIndex);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        onNetworkSelect(networks[0].ssid);
        scrollToFocusedItem(0);
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = networks.length - 1;
        setFocusedIndex(lastIndex);
        onNetworkSelect(networks[lastIndex].ssid);
        scrollToFocusedItem(lastIndex);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          onNetworkSelect(networks[focusedIndex].ssid);
        }
        break;
    }
  };

  if (networks.length === 0) {
    return (
      <div className='networks'>
        <div className='networks__list'>
          <div className='networks__list-empty-state'>
            <WifiFindIcon className='wifi-find-icon' />
            <p>Scan for available networks</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='networks'>
      <ul
        className='networks__list'
        ref={listRef}
        role='listbox'
        aria-labelledby='network-list-label'
        tabIndex={0}
        aria-activedescendant={
          focusedIndex >= 0 ? `network-option-${focusedIndex}` : undefined
        }
        onKeyDown={handleListboxKeyDown}
      >
        {networks.map((network, index) => (
          <li
            className='networks__item'
            key={`${network.ssid}-${index}`}
            id={`network-option-${index}`}
            role='option'
            aria-selected={selectedNetwork === network.ssid}
            tabIndex={-1}
            onClick={() => {
              setFocusedIndex(index);
              onNetworkSelect(network.ssid);
            }}
          >
            <span className='networks__item-ssid'>{network.ssid}</span>
            <div className='networks__item-details'>
              {connectedNetworkSSID === network.ssid && (
                <span title='Currently connected'>
                  <CheckIcon className='wifi-connected-icon' />
                </span>
              )}
              <span title={network.is_open ? 'Open' : 'Secured'}>
                {getSecurityIcon(network)}
              </span>
              <span
                title={`Signal strength: ${network.signal_strength} (${network.rssi} dBm)`}
              >
                {getSignalStrengthIcon(network.rssi)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
