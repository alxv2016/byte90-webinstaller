import React, { useState, useCallback } from 'react';
import StatusNotification from './statusnotification';
import { useAppContext } from '../contexts/AppContext';
import type { UpdateType } from '../data/webserial.interface';

const UpdateCard: React.FC = () => {
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
    <>
      <h2>Firmware or Animations Update</h2>
      <div role='alert'>
        <div aria-hidden='true'>Warning</div>
        <div>
          Your device will restart automatically once the firmware update is
          complete. Make sure to keep the window active during the update
          process. Do not refresh or close the window.
        </div>
      </div>

      <label htmlFor='updateType'>Update Type</label>
      <select
        id='updateType'
        value={updateType}
        onChange={handleUpdateTypeChange}
        disabled={updateInProgress}
        aria-describedby='updateType-help'
      >
        <option value='firmware'>Firmware (byte90.bin)</option>
        <option value='filesystem'>Animations (byte90animations.bin)</option>
      </select>
      <div id='updateType-help'>
        Select the type of update you want to perform on your BYTE-90 device.
      </div>

      <label htmlFor='firmwareFile'>
        Select Firmware File
        {selectedFile && (
          <span>
            ({selectedFile.name} - {(selectedFile.size / 1024).toFixed(1)} KB)
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
      <div id='firmwareFile-help'>
        Expected file: <strong>{getExpectedFilename(updateType)}</strong>
      </div>
      {selectedFile && !fileValidation.isValid && (
        <div id='firmwareFile-validation' role='alert' aria-live='polite'>
          {fileValidation.message}
        </div>
      )}

      {showProgress && (
        <div role='progressbar' aria-live='polite'>
          <progress
            value={progress.percent}
            max='100'
            aria-label={`Update progress: ${Math.round(progress.percent)}%`}
          />
          <div aria-live='polite'>{progress.message}</div>
        </div>
      )}

      {updateInProgress ? (
        <button
          onClick={handleAbortUpdate}
          type='button'
          aria-label='Abort firmware update'
        >
          Abort Update
        </button>
      ) : (
        <button
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

      <StatusNotification
        message={updateStatus.message}
        type={updateStatus.type}
      />
    </>
  );
};

export default UpdateCard;
