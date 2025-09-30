import React, { useState, useCallback } from 'react';
import ConnectionNotification from './connection-notification';
import { useAppContext } from '../contexts/AppContext';
import type { UpdateType } from '../data/webserial.interface';
import FirmwareUpdateIcon from '../assets/firmware_update.svg?react';
import InfoIcon from '../assets/info.svg?react';
import ExpandIcon from '../assets/expand.svg?react';
import CardComponent from './card-component';
import FormControl from './form-control';
import './firmware-update-card.css';

const FirmwareUpdateCard: React.FC = () => {
  const {
    updateInProgress,
    updateStatus,
    progress,
    showProgress,
    startUpdate,
    abortUpdate,
  } = useAppContext();
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
        await startUpdate(selectedFile, updateType);
      } catch (error) {
        console.error('Failed to start update:', error);
      }
    }
  }, [selectedFile, updateType, startUpdate]);

  const handleAbortUpdate = useCallback(async (): Promise<void> => {
    try {
      await abortUpdate();
    } catch (error) {
      console.error('Failed to abort update:', error);
    }
  }, [abortUpdate]);

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
    <CardComponent
      icon={FirmwareUpdateIcon}
      title='Firmware or Animations Update'
      footerIcon={InfoIcon}
      footerDescription='Your device will restart automatically once the firmware update is complete. Keep this window active during the update. Do not refresh or close it.'
    >
      <div className='firmware-update__help' id='updateType-help'>
        Select the type of update you want to perform on your BYTE-90 device.
      </div>

      <div className='firmware-update-form'>
        <FormControl label='File Type' htmlFor='updateType'>
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
          <ExpandIcon className='select-icon' />
        </FormControl>

        <FormControl
          label={`Select Firmware File${selectedFile ? ` (${selectedFile.name} - ${(selectedFile.size / 1024).toFixed(1)} KB)` : ''}`}
          htmlFor='firmwareFile'
        >
          <input
            type='file'
            id='firmwareFile'
            accept='.bin'
            onChange={handleFileChange}
            disabled={updateInProgress}
            required
            aria-describedby='firmwareFile-help firmwareFile-validation'
          />
          {updateInProgress ? (
            <button
              className='btn btn-primary'
              onClick={handleAbortUpdate}
              type='button'
              aria-label='Abort firmware update'
            >
              Abort
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
              Install
            </button>
          )}
        </FormControl>

        <ConnectionNotification
          message={updateStatus.message}
          type={updateStatus.type}
        />

        {showProgress && (
          <div className='progress-bar' role='progressbar' aria-live='polite'>
            <progress
              value={progress.percent}
              max='100'
              aria-label={`Update progress: ${Math.round(progress.percent)}%`}
            />
            <div className='progress-bar__message' aria-live='polite'>
              {progress.message}
            </div>
          </div>
        )}
      </div>
    </CardComponent>
  );
};

export default FirmwareUpdateCard;
