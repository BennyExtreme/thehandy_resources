// ==UserScript==
// @name         theHandy Support for xHamster
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @downloadURL  https://raw.githubusercontent.com/BennyExtreme/thehandy_resources/master/xhamster.js
// @updateURL    https://raw.githubusercontent.com/BennyExtreme/thehandy_resources/master/xhamster.js
// @description  Modern xhamster support for theHandy device
// @author       BennyExtreme
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @run-at       document-idle
// ==/UserScript==

(function() {
	'use strict';

	// Modern SVG icon for theHandy
	const HANDY_ICON = `
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
    `;

	// Handy API Class
	class Hander {
		constructor() {
			this.URL_BASE = "https://www.handyfeeling.com/";
			this.URL_API_ENDPOINT = "api/v1/";
			this.urlAPI = "";
			this.timeSyncMessage = 0;
			this.timeSyncAggregatedOffset = 0;
			this.timeSyncAverageOffset = 0;
			this.timeSyncInitialOffset = 0;
		}

		onReady(connectionkey, scriptUrl) {
			this.urlAPI = this.URL_BASE + this.URL_API_ENDPOINT + connectionkey;
			this.updateServerTime();

			const datas = {
				url: scriptUrl,
				timeout: 30000,
			};

			GM_xmlhttpRequest({
				method: "GET",
				url: this.urlAPI + "/syncPrepare?" + new URLSearchParams(datas).toString(),
				onload: (response) => {
					const result = JSON.parse(response.responseText);
					this.logMessage("syncPrepare response: " + JSON.stringify(result));
					if (result.success) {
						this.updateConnectionStatus(true);
					}
				}
			});
		}

		setOffset(ms) {
			const datas = {
				offset: ms,
				timeout: 30000,
			};

			GM_xmlhttpRequest({
				method: "GET",
				url: this.urlAPI + "/syncOffset?" + new URLSearchParams(datas).toString(),
				onload: (response) => {
					const result = JSON.parse(response.responseText);
					this.logMessage("syncOffset response: " + JSON.stringify(result));
				}
			});
		}

		onPlay(videoTime) {
			videoTime = Math.round(videoTime * 1000);
			const datas = {
				play: true,
				serverTime: this.getServerTime(),
				time: videoTime
			};

			GM_xmlhttpRequest({
				method: "GET",
				url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
				onload: (response) => {
					const result = JSON.parse(response.responseText);
					this.logMessage("syncPlay response: " + JSON.stringify(result));
				}
			});
		}

		onPause() {
			const datas = {
				play: false,
			};

			GM_xmlhttpRequest({
				method: "GET",
				url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
				onload: (response) => {
					const result = JSON.parse(response.responseText);
					this.logMessage("syncPause response: " + JSON.stringify(result));
				}
			});
		}

		getServerTime() {
			return Math.round(Date.now() + this.timeSyncAverageOffset + this.timeSyncInitialOffset);
		}

		updateServerTime() {
			const sendTime = Date.now();
			GM_xmlhttpRequest({
				method: "GET",
				url: this.urlAPI + "/getServerTime",
				onload: (response) => {
					const result = JSON.parse(response.responseText);
					const receiveTime = Date.now();
					const rtd = receiveTime - sendTime;
					const serverTime = result.serverTime;
					const estimatedServerTimeNow = serverTime + rtd / 2;

					if (this.timeSyncMessage === 0) {
						this.timeSyncInitialOffset = estimatedServerTimeNow - receiveTime;
					} else {
						const offset = estimatedServerTimeNow - receiveTime - this.timeSyncInitialOffset;
						this.timeSyncAggregatedOffset += offset;
						this.timeSyncAverageOffset = this.timeSyncAggregatedOffset / this.timeSyncMessage;
					}

					this.timeSyncMessage++;
					if (this.timeSyncMessage < 30) {
						this.updateServerTime();
					} else {
						this.logMessage("Server time synchronized. Average offset: " + Math.round(this.timeSyncAverageOffset) + "ms");
					}
				}
			});
		}

		logMessage(message) {
			const logElement = document.getElementById('handy-log');
			if (logElement) {
				const logEntry = document.createElement('div');
				logEntry.className = 'log-entry';
				logEntry.textContent = new Date().toLocaleTimeString() + ': ' + message;
				logElement.appendChild(logEntry);
				logElement.scrollTop = logElement.scrollHeight;
			}
		}

		updateConnectionStatus(connected) {
			const statusElement = document.getElementById('connection-status');
			if (statusElement) {
				statusElement.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
				statusElement.textContent = connected ? 'Connected' : 'Disconnected';
			}
		}
	}

	// Configuration Manager
	class ConfigManager {
		getValue(key, defaultValue = null) {
			return GM_getValue(key, defaultValue);
		}

		setValue(key, value) {
			GM_setValue(key, value);
		}

		getHandyKey() {
			return this.getValue("handy_key", "");
		}

		setHandyKey(key) {
			this.setValue("handy_key", key);
		}

		getHandyDelay() {
			return this.getValue("handy_delay", 0);
		}

		setHandyDelay(delay) {
			this.setValue("handy_delay", delay);
		}

		getMenuVisible() {
			return this.getValue("menu_visible", true);
		}

		setMenuVisible(visible) {
			this.setValue("menu_visible", visible);
		}
	}

	// UI Manager with Modern Interface
	class UIManager {
		constructor(handyController, configManager) {
			this.handy = handyController;
			this.config = configManager;
			this.scriptUrl = null;
			this.videoElement = null;
		}

		createModernUI() {
			this.injectStyles();

			const widget = this.createFloatingWidget();
			document.body.appendChild(widget);

			const panel = this.createMainPanel();
			document.body.appendChild(panel);

			const isVisible = this.config.getMenuVisible();
			panel.style.display = isVisible ? 'flex' : 'none';
			widget.style.display = isVisible ? 'none' : 'flex';

			return {
				widget,
				panel
			};
		}

		injectStyles() {
			const style = document.createElement('style');
			style.textContent = `
                .handy-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    z-index: 2147483647;
                    transition: all 0.3s ease;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                }

                .handy-widget:hover {
                    transform: scale(1.1);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                }

                .handy-widget svg {
                    color: white;
                    width: 24px;
                    height: 24px;
                }

                .handy-panel {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 480px;
                    max-height: 80vh;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    z-index: 2147483647;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }

                .handy-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                }

                .handy-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }

                .close-btn {
                    background: none !important;
                    border: none !important;
                    color: white !important;
                    font-size: 24px !important;
                    cursor: pointer !important;
                    padding: 0 !important;
                    width: 30px !important;
                    height: 30px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: background-color 0.2s !important;
                    position: relative !important;
                    z-index: 999999 !important;
                }

                .close-btn:hover {
                    background-color: rgba(255, 255, 255, 0.2) !important;
                }

                .handy-content {
                    padding: 24px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #333;
                    font-size: 14px;
                }

                .form-control {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e1e5e9;
                    border-radius: 12px;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    background: white;
                    box-sizing: border-box;
                }

                .form-control:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
                }

                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .status-section {
                    background: #f8f9fa;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 20px;
                }

                .status-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .status-indicator.connected {
                    background: rgba(40, 167, 69, 0.1);
                    color: #28a745;
                }

                .status-indicator.connected::before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    background: #28a745;
                    border-radius: 50%;
                }

                .status-indicator.disconnected {
                    background: rgba(220, 53, 69, 0.1);
                    color: #dc3545;
                }

                .status-indicator.disconnected::before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    background: #dc3545;
                    border-radius: 50%;
                }

                .log-container {
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 16px;
                    max-height: 200px;
                    overflow-y: auto;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }

                .log-entry {
                    color: #00ff00;
                    margin-bottom: 4px;
                    word-wrap: break-word;
                }

                .upload-area {
                    border: 2px dashed #e1e5e9;
                    border-radius: 12px;
                    padding: 32px;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }

                .upload-area:hover {
                    border-color: #667eea;
                    background: rgba(102, 126, 234, 0.05);
                }

                .upload-area.dragover {
                    border-color: #667eea;
                    background: rgba(102, 126, 234, 0.1);
                }

                .offset-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .offset-group input {
                    flex: 1;
                }

                .offset-group span {
                    color: #6c757d;
                    font-size: 14px;
                }

                @media (max-width: 600px) {
                    .handy-panel {
                        width: 90vw;
                        max-width: none;
                    }

                    .handy-widget {
                        bottom: 80px;
                    }
                }
            `;
			document.head.appendChild(style);
		}

		createFloatingWidget() {
			const widget = document.createElement('div');
			widget.className = 'handy-widget';
			widget.innerHTML = HANDY_ICON;

			widget.addEventListener('click', () => {
				this.showPanel();
			});

			return widget;
		}

		createMainPanel() {
			const panel = document.createElement('div');
			panel.className = 'handy-panel';
			panel.id = 'handy-panel';

			panel.innerHTML = `
                <div class="handy-header" id="handy-header">
                    <h3>theHandy Controller</h3>
                    <button class="close-btn" id="close-panel">×</button>
                </div>
                <div class="handy-content">
                    <div class="status-section">
                        <div id="connection-status" class="status-indicator disconnected">Disconnected</div>
                    </div>

                    <div class="form-group">
                        <label for="connection-key">Connection Key</label>
                        <input type="password" id="connection-key" class="form-control" placeholder="Enter your Handy connection key" value="${this.config.getHandyKey()}">
                    </div>

                    <div class="form-group">
                        <label>Script Upload</label>
                        <div class="upload-area" id="upload-area">
                            <div>📁</div>
                            <div>Click or drag to upload .funscript file</div>
                            <input type="file" id="file-input" style="display: none;" accept=".funscript">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="offset-input">Timing Offset</label>
                        <div class="offset-group">
                            <input type="number" id="offset-input" class="form-control" placeholder="0" value="${this.config.getHandyDelay()}">
                            <span>ms</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <button id="sync-button" class="btn btn-primary" disabled>
                            ${HANDY_ICON}
                            Sync with Handy
                        </button>
                    </div>

                    <div class="form-group">
                        <label>Activity Log</label>
                        <div id="handy-log" class="log-container"></div>
                    </div>
                </div>
            `;

			this.setupPanelEvents(panel);
			this.makeDraggable(panel);

			return panel;
		}

		setupPanelEvents(panel) {
			// Close button
			panel.querySelector('#close-panel').addEventListener('click', () => {
				this.hidePanel();
			});

			// Connection key input
			const keyInput = panel.querySelector('#connection-key');
			keyInput.addEventListener('input', (e) => {
				this.config.setHandyKey(e.target.value);
				this.updateSyncButtonState();
			});

			// File upload
			const uploadArea = panel.querySelector('#upload-area');
			const fileInput = panel.querySelector('#file-input');

			uploadArea.addEventListener('click', () => fileInput.click());
			uploadArea.addEventListener('dragover', (e) => {
				e.preventDefault();
				uploadArea.classList.add('dragover');
			});
			uploadArea.addEventListener('dragleave', () => {
				uploadArea.classList.remove('dragover');
			});
			uploadArea.addEventListener('drop', (e) => {
				e.preventDefault();
				uploadArea.classList.remove('dragover');
				const files = e.dataTransfer.files;
				if (files.length > 0) {
					this.handleFileUpload(files[0]);
				}
			});

			fileInput.addEventListener('change', (e) => {
				if (e.target.files.length > 0) {
					this.handleFileUpload(e.target.files[0]);
				}
			});

			// Offset input
			const offsetInput = panel.querySelector('#offset-input');
			offsetInput.addEventListener('input', (e) => {
				const value = parseInt(e.target.value) || 0;
				this.config.setHandyDelay(value);
				this.handy.setOffset(value);
			});

			// Sync button
			panel.querySelector('#sync-button').addEventListener('click', () => {
				if (this.scriptUrl && this.config.getHandyKey()) {
					this.handy.onReady(this.config.getHandyKey(), this.scriptUrl);
				}
			});
		}

		handleFileUpload(file) {
			if (!file.name.endsWith('.funscript')) {
				this.handy.logMessage('Error: Please select a .funscript file');
				return;
			}

			const formData = new FormData();
			// Extract filename from xhamster URL structure
			const filename = window.location.href.split('/videos/')[1]?.split('-')[0] || 'unknown';
			formData.set("syncFile", new File([file], filename + ".funscript"));

			this.handy.logMessage('Uploading script file...');

			GM_xmlhttpRequest({
				method: "POST",
				url: "https://www.handyfeeling.com/api/sync/upload",
				data: formData,
				onload: (response) => {
					if (response.status === 200) {
						const result = JSON.parse(response.responseText);
						this.scriptUrl = result.url;
						this.handy.logMessage('Script uploaded successfully!');
						this.updateSyncButtonState();

						// Auto-sync if we have a connection key
						if (this.config.getHandyKey()) {
							this.handy.onReady(this.config.getHandyKey(), this.scriptUrl);
						}
					} else {
						this.handy.logMessage('Upload failed: ' + response.status);
					}
				}
			});
		}

		updateSyncButtonState() {
			const syncButton = document.getElementById('sync-button');
			const hasKey = this.config.getHandyKey().length > 0;
			const hasScript = this.scriptUrl !== null;

			syncButton.disabled = !(hasKey && hasScript);
		}

		showPanel() {
			const panel = document.getElementById('handy-panel');
			const widget = document.querySelector('.handy-widget');

			panel.style.display = 'flex';
			widget.style.display = 'none';
			this.config.setMenuVisible(true);
		}

		hidePanel() {
			const panel = document.getElementById('handy-panel');
			const widget = document.querySelector('.handy-widget');

			panel.style.display = 'none';
			widget.style.display = 'flex';
			this.config.setMenuVisible(false);
		}

		makeDraggable(element) {
			let pos1 = 0,
				pos2 = 0,
				pos3 = 0,
				pos4 = 0;
			const header = element.querySelector('#handy-header');

			header.addEventListener('mousedown', dragMouseDown);

			function dragMouseDown(e) {
				e.preventDefault();
				pos3 = e.clientX;
				pos4 = e.clientY;
				document.addEventListener('mouseup', closeDragElement);
				document.addEventListener('mousemove', elementDrag);
			}

			function elementDrag(e) {
				e.preventDefault();
				pos1 = pos3 - e.clientX;
				pos2 = pos4 - e.clientY;
				pos3 = e.clientX;
				pos4 = e.clientY;
				element.style.top = (element.offsetTop - pos2) + "px";
				element.style.left = (element.offsetLeft - pos1) + "px";
				element.style.transform = 'none';
			}

			function closeDragElement() {
				document.removeEventListener('mouseup', closeDragElement);
				document.removeEventListener('mousemove', elementDrag);
			}
		}
	}

	// Main Application for XHamster
	class XHamsterHandyApp {
		constructor() {
			this.handy = new Hander();
			this.config = new ConfigManager();
			this.ui = new UIManager(this.handy, this.config);
			this.videoElement = null;
		}

		async initialize() {
			// Wait for video element to load (XHamster specific)
			this.videoElement = await this.waitForVideoElement();
			if (!this.videoElement) {
				console.log('theHandy: XHamster video element not found');
				return;
			}

			// Create modern UI
			this.ui.createModernUI();

			// Setup video event listeners
			this.setupVideoListeners();

			// Setup page unload handler
			window.addEventListener("beforeunload", () => {
				if (this.shouldSync()) {
					this.handy.onPause();
				}
			});

			console.log('theHandy: Initialized successfully for XHamster');
		}

		async waitForVideoElement(maxAttempts = 50) {
			for (let i = 0; i < maxAttempts; i++) {
				const element = document.getElementById('xplayer__video');
				if (element) {
					return element;
				}
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			return null;
		}

		setupVideoListeners() {
			const events = {
				play: () => this.onVideoPlay(),
				playing: () => this.onVideoPlay(),
				progress: () => this.onVideoPlay(),
				pause: () => this.onVideoPause(),
				waiting: () => this.onVideoPause()
			};

			Object.entries(events).forEach(([event, handler]) => {
				this.videoElement.addEventListener(event, handler);
			});
		}

		onVideoPlay() {
			if (this.shouldSync()) {
				this.handy.onPlay(this.videoElement.currentTime);
			}
		}

		onVideoPause() {
			if (this.shouldSync()) {
				this.handy.onPause();
			}
		}

		shouldSync() {
			return this.ui.scriptUrl && this.config.getHandyKey();
		}
	}

	// Initialize the application
	const app = new XHamsterHandyApp();
	app.initialize();

})();
