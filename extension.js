'use strict';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Clutter from 'gi://Clutter';

let acControlButton;

function loadEnvFile() {
    try {
        let extensionDir = '/home/hackmann/.local/share/gnome-shell/extensions/air-control@dev-hackmann.github.com';
        let envFile = Gio.File.new_for_path(extensionDir + '/.env');
        
        if (!envFile.query_exists(null)) {
            console.log('No .env file found. Please create one with your credentials.');
            return {};
        }
        
        let [success, contents] = envFile.load_contents(null);
        if (!success) {
            console.log('Failed to load .env file');
            return {};
        }
        
        let env = {};
        let lines = new TextDecoder().decode(contents).split('\n');
        
        for (let line of lines) {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                let [key, value] = line.split('=', 2);
                if (key && value) {
                    env[key.trim()] = value.trim();
                }
            }
        }
        
        return env;
    } catch (e) {
        console.log(`Error loading .env file: ${e}`);
        return {};
    }
}

const ACControlButton = GObject.registerClass(
    class ACControlButton extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'AC Control Button');
            
            this.env = loadEnvFile();
            
            this._checkRequiredEnv();
            
            this.box = new St.BoxLayout({
                style_class: 'panel-status-menu-box'
            });
            
            // Create icon
            this.icon = new St.Icon({
                icon_name: 'weather-clear-symbolic',
                style_class: 'system-status-icon',
            });
            
            this.tempLabel = new St.Label({
                text: '--°C',
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            
            this.tempLabel.set_margin_left(4);
            
            this.box.add_child(this.icon);
            this.box.add_child(this.tempLabel);
            
            this.add_child(this.box);
            
            let turnOnItem = new PopupMenu.PopupMenuItem('Turn AC On');
            turnOnItem.connect('activate', () => {
                this._sendACCommand('POWER_ON');
            });
            this.menu.addMenuItem(turnOnItem);
            
            let turnOffItem = new PopupMenu.PopupMenuItem('Turn AC Off');
            turnOffItem.connect('activate', () => {
                this._sendACCommand('POWER_OFF');
            });
            this.menu.addMenuItem(turnOffItem);

            let tempMenu = new PopupMenu.PopupSubMenuMenuItem('Set Temperature');
            this.menu.addMenuItem(tempMenu);

            for (let temp = 18; temp <= 30; temp++) {
                let tempItem = new PopupMenu.PopupMenuItem(`${temp}°C`);
                tempItem.connect('activate', () => {
                    this._setTemperature(temp);
                });
                tempMenu.menu.addMenuItem(tempItem);
            }
        }

        _checkRequiredEnv() {
            const requiredVars = [
                'DEVICE_ID', 'MESSAGE_ID', 'COUNTRY', 'CLIENT_ID', 
                'API_KEY', 'AUTH_TOKEN', 'API_URL'
            ];
            
            let missing = [];
            for (let variable of requiredVars) {
                if (!this.env[variable]) {
                    missing.push(variable);
                }
            }
            
            if (missing.length > 0) {
                console.log(`Missing required environment variables: ${missing.join(', ')}`);
                Main.notify('AC Control', 'Missing environment variables. Check the extension logs.');
            }
        }

        _getApiUrl(endpoint) {
            return `${this.env.API_URL}/${this.env.DEVICE_ID}/${endpoint}`;
        }

        _setHeaders(message) {
            message.request_headers.append('x-message-id', this.env.MESSAGE_ID);
            message.request_headers.append('x-country', this.env.COUNTRY);
            message.request_headers.append('x-client-id', this.env.CLIENT_ID);
            message.request_headers.append('x-api-key', this.env.API_KEY);
            message.request_headers.append('Accept', 'application/json');
            message.request_headers.append('x-conditional-control', 'false');
            message.request_headers.append('Content-Type', 'application/json');
            message.request_headers.append('Authorization', `Bearer ${this.env.AUTH_TOKEN}`);
        }

        _getTemperature() {
            if (!this._areCredentialsValid()) return;

            let session = new Soup.Session();
            
            let uri = this._getApiUrl('state');
            
            let message = Soup.Message.new('GET', uri);
            
            this._setHeaders(message);

            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const statusCode = message.get_status();
                    const responseBytes = session.send_and_read_finish(result);
                    const responseText = new TextDecoder().decode(responseBytes.get_data());
                    
                    if (statusCode === 200) {
                        const response = JSON.parse(responseText);
                        const currentTemperature = response.response.temperature.currentTemperature;
                        this.tempLabel.text = `${currentTemperature}°C`;
                    } else {
                        Main.notify('Error', `Failed to get temperature: ${statusCode}`);
                        console.log(`Response: ${responseText}`);
                    }
                } catch (e) {
                    Main.notify('Error', `Exception when getting temperature: ${e.message}`);
                    console.log(`Exception: ${e}`);
                    this._scheduleNextUpdate(7); 
                }
            });
        }

        _scheduleNextUpdate(interval) {
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
            }
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
                this._getTemperature();
                return GLib.SOURCE_CONTINUE;
            });
        }

        _areCredentialsValid() {
            const requiredVars = [
                'DEVICE_ID', 'MESSAGE_ID', 'COUNTRY', 'CLIENT_ID', 
                'API_KEY', 'AUTH_TOKEN', 'API_URL'
            ];
            
            for (let variable of requiredVars) {
                if (!this.env[variable]) {
                    Main.notify('AC Control', 'Missing environment variables. Check your .env file.');
                    return false;
                }
            }
            return true;
        }

        _sendACCommand(operationMode) {
            if (!this._areCredentialsValid()) return;

            let session = new Soup.Session();
            
            let uri = this._getApiUrl('control');
            
            let message = Soup.Message.new('POST', uri);
            
            this._setHeaders(message);

            let requestBody = JSON.stringify({
                operation: { airConOperationMode: operationMode }
            });
            
            let bytes = GLib.Bytes.new(new TextEncoder().encode(requestBody));
            message.set_request_body_from_bytes('application/json', bytes);
            
            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const statusCode = message.get_status();
                    const responseBytes = session.send_and_read_finish(result);
                    const responseText = new TextDecoder().decode(responseBytes.get_data());
                    
                    if (statusCode !== 200) {
                        Main.notify('Error', `Failed to send command: ${statusCode}`);
                        console.log(`Response: ${responseText}`);
                    }
                } catch (e) {
                    Main.notify('Error', `Exception when sending command: ${e.message}`);
                    console.log(`Exception: ${e}`);
                }
            });
        }

        _setTemperature(temperature) {
            if (!this._areCredentialsValid()) return;

            let session = new Soup.Session();
            
            let uri = this._getApiUrl('control');
            
            let message = Soup.Message.new('POST', uri);
            
            this._setHeaders(message);

            let requestBody = JSON.stringify({
                temperature: { targetTemperature: temperature }
            });
            
            let bytes = GLib.Bytes.new(new TextEncoder().encode(requestBody));
            message.set_request_body_from_bytes('application/json', bytes);
            
            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    const statusCode = message.get_status();
                    const responseBytes = session.send_and_read_finish(result);
                    const responseText = new TextDecoder().decode(responseBytes.get_data());
                    
                    if (statusCode !== 200) {
                        Main.notify('Error', `Failed to send command: ${statusCode}`);
                        console.log(`Response: ${responseText}`);
                    }
                } catch (e) {
                    Main.notify('Error', `Exception when sending command: ${e.message}`);
                    console.log(`Exception: ${e}`);
                }
            });
        }
    }
);

export default class ACControlExtension {
    enable() {
        acControlButton = new ACControlButton();
        Main.panel.addToStatusArea('ac-control', acControlButton, 2, 'left');
        acControlButton._getTemperature();
        acControlButton._scheduleNextUpdate(180);
    }
    
    disable() {
        if (acControlButton) {
            acControlButton.destroy();
            acControlButton = null;
        }
    }
}