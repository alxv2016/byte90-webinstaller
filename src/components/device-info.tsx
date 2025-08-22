import { useAppContext } from '../contexts/AppContext';

export default function DeviceInfo() {
  const { deviceInfo } = useAppContext();

  if (!deviceInfo) {
    return null;
  }

  return (
    <div className='card'>
      <div
        className='card__content'
        role='region'
        aria-label='Device Information'
      >
        <div>
          <span>Firmware Version:</span>
          <span title={deviceInfo.firmware_version || 'Not available'}>
            {deviceInfo.firmware_version || '--'}
          </span>
        </div>
        <div>
          <span>MCU Model:</span>
          <span title={deviceInfo.mcu || 'Not available'}>
            {deviceInfo.mcu || '--'}
          </span>
        </div>
        <div>
          <span>Available Space:</span>
          <span title={deviceInfo.flash_available || 'Not available'}>
            {deviceInfo.flash_available || '--'}
          </span>
        </div>
        <div>
          <span>Free Heap:</span>
          <span title={deviceInfo.free_heap || 'Not available'}>
            {deviceInfo.free_heap || '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
