import { useAppContext } from '../contexts/AppContext';
import DeviceInfoIcon from '../assets/device_info.svg?react';
import './device-info.css';

export default function DeviceInfo() {
  const { deviceInfo } = useAppContext();

  if (!deviceInfo) {
    return null;
  }

  return (
    <div className='device-info'>
      <div className='device-info__header'>
        <DeviceInfoIcon className='device-info-icon' />
        <h2 className='device-info__title'>Device Information</h2>
      </div>
      <div
        className='device-info__content'
        role='region'
        aria-label='Device Information'
      >
        <div className='device-info__col'>
          <div className='device-info__item'>
            <span className='device-info__label'>Firmware Version:</span>
            <span
              className='device-info__value'
              title={deviceInfo.firmware_version || 'Not available'}
            >
              {deviceInfo.firmware_version || '--'}
            </span>
          </div>
          <div className='device-info__item'>
            <span className='device-info__label'>MCU Model:</span>
            <span
              className='device-info__value'
              title={deviceInfo.mcu || 'Not available'}
            >
              {deviceInfo.mcu || '--'}
            </span>
          </div>
        </div>
        <div className='device-info__col'>
          <div className='device-info__item'>
            <span className='device-info__label'>Available Space:</span>
            <span
              className='device-info__value'
              title={deviceInfo.flash_available || 'Not available'}
            >
              {deviceInfo.flash_available || '--'}
            </span>
          </div>
          <div className='device-info__item'>
            <span className='device-info__label'>Free Heap:</span>
            <span
              className='device-info__value'
              title={deviceInfo.free_heap || 'Not available'}
            >
              {deviceInfo.free_heap || '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
