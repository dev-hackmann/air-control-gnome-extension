# Air Control Extension

This project is a GNOME Shell extension that allows users to control their air conditioning units directly from the GNOME panel. It provides functionalities to turn the AC on or off, as well as set the desired temperature.

## Features

- Turn AC on or off
- Set temperature between 18°C and 30°C
- Display current temperature

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd air-control-extension
   ```

3. Install the extension:
   - Copy the contents of the project directory to your GNOME Shell extensions directory, typically located at `~/.local/share/gnome-shell/extensions/`.
   - Ensure the folder name matches the `uuid` specified in the `metadata.json` file (e.g., `air-control@dev-hackmann.github.com`).

4. Create a `.env` file in the project root to store your environment variables, such as API keys. **Make sure to update the path to the `.env` file in the `extension.js` file if you install the extension in a different directory.**

   Example `.env` file:
   ```
   DEVICE_ID=your_device_id
   MESSAGE_ID=your_message_id
   COUNTRY=your_country
   CLIENT_ID=your_client_id
   API_KEY=your_api_key
   AUTH_TOKEN=your_auth_token
   API_URL=your_api_url
   ```

5. Remember to change `extensionDir` to your path

## Usage

- After installation, enable the extension through GNOME Tweaks or the Extensions app.
- Click on the AC control button in the GNOME panel to access the controls.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.
