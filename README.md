# BYTE-90 Firmware Updater

A React-based web application for updating BYTE-90 device firmware using the Web Serial API. This application provides a modern, user-friendly interface for firmware and animation updates with real-time progress tracking and comprehensive error handling.

## Features

- **Web Serial API Integration**: Direct communication with BYTE-90 devices via USB-C
- **Dual Update Types**: Support for both firmware and animation updates
- **Real-time Progress**: Live progress tracking with detailed status updates
- **Error Recovery**: Automatic retry mechanisms and graceful error handling
- **Device Validation**: Ensures device is in correct Update Mode before proceeding
- **Browser Compatibility**: Built for Chrome and Edge browsers with Web Serial support

## Prerequisites

- **Browser**: Chrome 89+, Edge 89+, or Opera 75+ (Web Serial API required)
- **Device**: BYTE-90 device in Update Mode
- **Connection**: USB-C cable for device connection

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd byte90-firmware-updater
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Prepare Device**: Put your BYTE-90 device into Update Mode
2. **Connect**: Click "Connect" and select your device from the browser dialog
3. **Select File**: Choose the appropriate firmware file:
   - `byte90.bin` for firmware updates
   - `byte90animations.bin` for animation updates
4. **Update**: Click "Start Update" and wait for completion
5. **Restart**: Device will restart automatically when update is complete

## Project Structure

```
src/
├── components/
│   ├── ByteLogo.jsx          # BYTE-90 logo component
│   ├── ConnectionCard.jsx    # Device connection interface
│   ├── UpdateCard.jsx        # Firmware update interface
│   ├── CompatibilityCard.jsx # Browser compatibility info
│   └── StatusNotification.jsx # Status message component
├── hooks/
│   ├── useSerial.js          # Web Serial API logic
│   └── useUpdater.js         # Firmware update logic
├── App.jsx                   # Main application component
├── main.jsx                  # React entry point
└── index.css                 # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technical Details

### Serial Communication

- **Baud Rate**: 921,600
- **Chunk Size**: 1,024 bytes
- **Timeout**: 5s for commands, 10s for chunks
- **Retry Logic**: Up to 2 retries with exponential backoff

### Supported Commands

- `GET_INFO` - Retrieve device information
- `START_UPDATE` - Initialize firmware update
- `SEND_CHUNK` - Transfer data chunks
- `FINISH_UPDATE` - Complete update process
- `ABORT_UPDATE` - Cancel ongoing update

### File Requirements

- **Format**: Binary (.bin) files only
- **Naming**: Must contain "byte90" or "byte90animations"
- **Size**: Automatically validated against device capacity

## Browser Compatibility

This application requires browsers with Web Serial API support:

✅ **Supported**:

- Chrome 89+
- Edge 89+
- Opera 75+

❌ **Not Supported**:

- Firefox
- Safari
- Mobile browsers

## Troubleshooting

### Connection Issues

- Ensure device is in Update Mode
- Try a different USB-C cable
- Check browser permissions for serial access
- Restart browser if connection fails

### Update Failures

- Verify correct firmware file selection
- Ensure stable USB connection
- Keep browser window active during update
- Check device has sufficient storage space

### Browser Compatibility

- Update to latest Chrome or Edge version
- Enable experimental web platform features if needed
- Clear browser cache and cookies

## Security Considerations

- Only accepts `.bin` files from trusted sources
- Validates file naming conventions
- Implements command timeouts and retry limits
- Provides clear user feedback for all operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with actual hardware
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For technical support or questions:

- Check the troubleshooting section above
- Review browser console for error messages
- Ensure device firmware supports the update protocol
