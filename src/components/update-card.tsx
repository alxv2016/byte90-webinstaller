import React, { useState, useCallback } from 'react';
import StatusNotification from './statusnotification';

// Import types from centralized location
import type { UpdateCardProps, UpdateType } from '../data/webserial.interface';

const UpdateCard: React.FC<UpdateCardProps> = ({
  updateInProgress,
  updateStatus,
  progress,
  showProgress,
  onStartUpdate,
  onAbortUpdate,
}) => {
  const [updateType, setUpdateType] = useState<UpdateType>('firmware');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0] || null;
      setSelectedFile(file);
    },
    []
  );

  const handleUpdateTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      setUpdateType(e.target.value as UpdateType);
    },
    []
  );

  const handleStartUpdate = useCallback(async (): Promise<void> => {
    if (selectedFile) {
      try {
        await onStartUpdate(selectedFile, updateType);
      } catch (error) {
        console.error('Failed to start update:', error);
      }
    }
  }, [selectedFile, updateType, onStartUpdate]);

  const handleAbortUpdate = useCallback(async (): Promise<void> => {
    try {
      await onAbortUpdate();
    } catch (error) {
      console.error('Failed to abort update:', error);
    }
  }, [onAbortUpdate]);

  const isUploadDisabled = !selectedFile || updateInProgress;

  const getExpectedFilename = (type: UpdateType): string => {
    return type === 'firmware' ? 'byte90.bin' : 'byte90animations.bin';
  };

  const validateFile = (
    file: File | null
  ): { isValid: boolean; message?: string } => {
    if (!file) {
      return { isValid: false, message: 'No file selected' };
    }

    if (!file.name.endsWith('.bin')) {
      return { isValid: false, message: 'Please select a .bin file' };
    }

    const expectedString =
      updateType === 'firmware' ? 'byte90' : 'byte90animations';
    if (!file.name.includes(expectedString)) {
      return {
        isValid: false,
        message: `Please select the correct file (${getExpectedFilename(updateType)})`,
      };
    }

    return { isValid: true };
  };

  const fileValidation = validateFile(selectedFile);

  return (
    <div className='card-wrapper'>
      <h2 className='section-title'>Firmware or Animations Update</h2>
      <div className='card'>
        <div className='card__header'>
          <div className='status-notification status-notice' role='alert'>
            <div className='status-notification__icon' aria-hidden='true'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24'
                viewBox='0 -960 960 960'
                width='24'
                fill='currentColor'
              >
                <path d='M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z' />
              </svg>
            </div>
            <div>
              Your device will restart automatically once the firmware update is
              complete. Make sure to keep the window active during the update
              process. Do not refresh or close the window.
            </div>
          </div>
        </div>

        <div className='card__body'>
          <div className='form-control'>
            <label htmlFor='updateType'>Update Type</label>
            <div className='form-select'>
              <select
                id='updateType'
                value={updateType}
                onChange={handleUpdateTypeChange}
                disabled={updateInProgress}
                aria-describedby='updateType-help'
              >
                <option value='firmware'>Firmware (byte90.bin)</option>
                <option value='filesystem'>
                  Animations (byte90animations.bin)
                </option>
              </select>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                height='24'
                viewBox='0 -960 960 960'
                width='24'
                fill='currentColor'
                aria-hidden='true'
              >
                <path d='M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z' />
              </svg>
            </div>
            <div id='updateType-help' className='form-help'>
              Select the type of update you want to perform on your BYTE-90
              device.
            </div>
          </div>

          <div className='form-control'>
            <label htmlFor='firmwareFile'>
              Select Firmware File
              {selectedFile && (
                <span className='file-info'>
                  ({selectedFile.name} - {(selectedFile.size / 1024).toFixed(1)}{' '}
                  KB)
                </span>
              )}
            </label>
            <input
              type='file'
              id='firmwareFile'
              accept='.bin'
              onChange={handleFileChange}
              disabled={updateInProgress}
              required
              aria-describedby='firmwareFile-help firmwareFile-validation'
            />
            <div id='firmwareFile-help' className='form-help'>
              Expected file: <strong>{getExpectedFilename(updateType)}</strong>
            </div>
            {selectedFile && !fileValidation.isValid && (
              <div
                id='firmwareFile-validation'
                className='form-error'
                role='alert'
                aria-live='polite'
              >
                {fileValidation.message}
              </div>
            )}
          </div>

          {showProgress && (
            <div
              className='progress-bar show'
              role='progressbar'
              aria-live='polite'
            >
              <progress
                value={progress.percent}
                max='100'
                aria-label={`Update progress: ${Math.round(progress.percent)}%`}
              />
              <div className='progress-bar__status' aria-live='polite'>
                {progress.message}
              </div>
            </div>
          )}
        </div>

        <div className='card__footer'>
          <div className='btn-group'>
            {updateInProgress ? (
              <button
                className='btn btn-muted'
                onClick={handleAbortUpdate}
                type='button'
                aria-label='Abort firmware update'
              >
                Abort Update
              </button>
            ) : (
              <button
                className='btn btn-primary'
                onClick={handleStartUpdate}
                disabled={isUploadDisabled}
                type='button'
                aria-label={`Start ${updateType} update`}
                title={
                  !selectedFile
                    ? 'Please select a file first'
                    : !fileValidation.isValid
                      ? fileValidation.message
                      : `Start ${updateType} update with ${selectedFile?.name}`
                }
              >
                Start Update
              </button>
            )}
          </div>
        </div>

        <StatusNotification
          message={updateStatus.message}
          type={updateStatus.type}
        />
      </div>
    </div>
  );
};

export default UpdateCard;
