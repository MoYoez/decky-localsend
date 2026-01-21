import os
import sys
import asyncio
import subprocess
import time
import threading
import zipfile
from typing import Optional, Dict, Any

py_modules_path = os.path.join(os.path.dirname(__file__), "py_modules")
if py_modules_path not in sys.path:
    sys.path.insert(0, py_modules_path)

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import Flask, request, jsonify
import decky


class Plugin:
    def __init__(self):
        self.loop = None
        self.process = None
        self.log_file = None
        self.backend_port = 53317
        self.backend_protocol = "https"
        self.notify_port = 9000  # Flask server port for receiving notifications from Go backend
        self.config_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "localsend.yaml")
        self.upload_dir = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "uploads")
        self.binary_path = os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "localsend-core")
        self.backend_url = f"{self.backend_protocol}://127.0.0.1:{self.backend_port}"
        
        # Flask application and server thread
        self.flask_app: Optional[Flask] = None
        self.flask_thread: Optional[threading.Thread] = None
        self.flask_shutdown = threading.Event()
        
        # Upload session tracking
        self.upload_sessions: Dict[str, Dict[str, Any]] = {}

    def _ensure_dirs(self):
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(decky.DECKY_PLUGIN_LOG_DIR, exist_ok=True)

    def _create_flask_app(self) -> Flask:
        """Create Flask application to receive notifications from Go backend"""
        app = Flask(__name__)
        
        # Disable Flask logging, use decky logger instead
        import logging
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.ERROR)
        
        @app.route('/api/py-backend/v1/notify', methods=['POST'])
        def receive_notification():
            """Receive file upload notifications from Go service"""
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'status': 'error', 'message': 'No data received'}), 400
                
                notification_type = data.get('type')
                title = data.get('title', '')
                message = data.get('message', '')
                notification_data = data.get('data', {})
                
                session_id = notification_data.get('sessionId', '')
                file_id = notification_data.get('fileId', '')
                file_name = notification_data.get('fileName', '')
                file_size = notification_data.get('size', 0)
                file_type = notification_data.get('fileType', '')
                sha256 = notification_data.get('sha256', '')
                
                if notification_type == 'upload_start':
                    decky.logger.info(f"📤 Upload started: {file_name} (size: {file_size} bytes)")
                    decky.logger.info(f"   Session ID: {session_id}, File ID: {file_id}")
                    
                    # Save upload session information
                    self.upload_sessions[session_id] = {
                        'file_id': file_id,
                        'file_name': file_name,
                        'file_size': file_size,
                        'file_type': file_type,
                        'sha256': sha256,
                        'start_time': time.time(),
                        'status': 'uploading'
                    }
                    
                elif notification_type == 'upload_end':
                    decky.logger.info(f"✅ Upload completed: {file_name} (size: {file_size} bytes)")
                    decky.logger.info(f"   Session ID: {session_id}, SHA256: {sha256}")
                    
                    # Update upload session status
                    if session_id in self.upload_sessions:
                        session = self.upload_sessions[session_id]
                        session['status'] = 'completed'
                        session['end_time'] = time.time()
                        duration = session['end_time'] - session.get('start_time', 0)
                        decky.logger.info(f"   Upload duration: {duration:.2f} seconds")
                else:
                    decky.logger.warning(f"Unknown notification type: {notification_type}")
                
                return jsonify({'status': 'ok', 'message': 'Notification received'}), 200
                
            except Exception as e:
                decky.logger.error(f"❌ Error processing notification: {str(e)}")
                return jsonify({'status': 'error', 'message': str(e)}), 400
        
        @app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint"""
            return jsonify({'status': 'ok', 'service': 'decky-localsend-notify'}), 200
        
        return app
    
    def _start_flask_server(self):
        """Start Flask server in background thread"""
        if self.flask_thread is not None and self.flask_thread.is_alive():
            decky.logger.info("Flask server is already running")
            return
        
        self.flask_app = self._create_flask_app()
        self.flask_shutdown.clear()
        
        def run_flask():
            try:
                self.flask_app.run(
                    host='127.0.0.1',
                    port=self.notify_port,
                    debug=False,
                    use_reloader=False,
                    threaded=True
                )
            except Exception as e:
                decky.logger.error(f"Flask server error: {e}")
        
        self.flask_thread = threading.Thread(target=run_flask, daemon=True)
        self.flask_thread.start()
        decky.logger.info(f"Flask notification server started on port: {self.notify_port}")
    
    def _stop_flask_server(self):
        """Stop Flask server"""
        if self.flask_thread is None or not self.flask_thread.is_alive():
            return
        
        self.flask_shutdown.set()
        
        # Try to trigger server shutdown via request
        try:
            requests.get(f"http://127.0.0.1:{self.notify_port}/health", timeout=1)
        except:
            pass
        
        # Wait for thread to finish
        if self.flask_thread:
            self.flask_thread.join(timeout=2)
        
        self.flask_thread = None
        self.flask_app = None
        decky.logger.info("Flask notification server stopped")

    def _is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def _start_backend(self):
        if self._is_running():
            return
        if not os.path.exists(self.binary_path):
            raise FileNotFoundError(f"backend binary not found: {self.binary_path}")

        self._ensure_dirs()
        log_path = os.path.join(decky.DECKY_PLUGIN_LOG_DIR, "localsend-backend.log")
        self.log_file = open(log_path, "a", encoding="utf-8")
        env = os.environ.copy()

        # Build startup command with Python backend notification URL
        cmd = [
            self.binary_path,
            "-useConfigPath",
            self.config_path,
            "-useDefaultUploadFolder",
            self.upload_dir,
            "-log",
            "prod",
        ]

        self.process = subprocess.Popen(
            cmd,
            stdout=self.log_file,
            stderr=self.log_file,
            env=env,
        )
        decky.logger.info(f"localsend backend started with config: {self.config_path}")

    def _stop_backend(self):
        if not self._is_running():
            return
        self.process.terminate()
        for _ in range(20):
            if self.process.poll() is not None:
                break
            time.sleep(0.1)
        if self.process.poll() is None:
            self.process.kill()
        self.process = None
        if self.log_file:
            self.log_file.close()
            self.log_file = None
        decky.logger.info("localsend backend stopped")

    async def start_backend(self):
        try:
            self._start_flask_server()
            self._start_backend()
            return {"running": True, "url": self.backend_url}
        except Exception as error:
            decky.logger.error(f"failed to start backend: {error}")
            return {"running": False, "error": str(error), "url": self.backend_url}

    async def stop_backend(self):
        self._stop_backend()
        return {"running": False, "url": self.backend_url}

    async def get_backend_status(self):
        return {"running": self._is_running(), "url": self.backend_url}

    def _get_session(self):
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.verify = False
        try:
            import urllib3
            urllib3.disable_warnings()
        except ImportError:
            pass
        return session

    async def _proxy_request(self, method: str, path: str, **kwargs):
        if not self._is_running():
            return {"error": "Backend not running"}, 503

        url = f"{self.backend_url}{path}"

        try:
            loop = asyncio.get_event_loop()
            session = self._get_session()
            response = await loop.run_in_executor(
                None,
                lambda: session.request(method, url, **kwargs)
            )

            content_type = response.headers.get('Content-Type', '')
            if 'application/json' in content_type:
                data = response.json()
            else:
                data = response.text

            return data, response.status_code
        except Exception as e:
            decky.logger.error(f"Proxy request failed: {e}")
            return {"error": str(e)}, 500

    async def proxy_get(self, path: str):
        data, status = await self._proxy_request("GET", path)
        return {"data": data, "status": status}

    async def proxy_post(self, path: str, json_data: dict = None, body: bytes = None):
        kwargs = {}
        if json_data is not None:
            kwargs['json'] = json_data
        if body is not None:
            kwargs['data'] = bytes(body) if isinstance(body, list) else body
            kwargs['headers'] = {'Content-Type': 'application/octet-stream'}

        data, status = await self._proxy_request("POST", path, **kwargs)
        return {"data": data, "status": status}

    async def get_upload_sessions(self):
        """Get upload session records"""
        sessions = []
        for session_id, session_data in self.upload_sessions.items():
            sessions.append({
                'session_id': session_id,
                **session_data
            })
        # Sort by start time in descending order
        sessions.sort(key=lambda x: x.get('start_time', 0), reverse=True)
        return sessions
    
    async def clear_upload_sessions(self):
        """Clear upload session records"""
        self.upload_sessions.clear()
        decky.logger.info("Upload session records cleared")
        return {"success": True}
    
    async def get_notify_server_status(self):
        """Get notification server status"""
        is_running = self.flask_thread is not None and self.flask_thread.is_alive()
        return {
            "running": is_running,
            "port": self.notify_port,
            "url": f"http://127.0.0.1:{self.notify_port}"
        }
    
    async def test_notify_callback(self):
        """Send a test notification to the Flask server"""
        self._start_flask_server()
        try:
            response = requests.post(
                f"http://127.0.0.1:{self.notify_port}/api/py-backend/v1/notify",
                json={
                    "type": "upload_end",
                    "title": "Test Callback",
                    "message": "This is a test notification",
                    "data": {
                        "sessionId": f"test-{int(time.time())}",
                        "fileId": "test-file",
                        "fileName": "callback-test.txt",
                        "size": 1234,
                        "fileType": "text/plain",
                        "sha256": "test-sha256"
                    }
                },
                timeout=3,
                verify=False
            )
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}"}
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Test callback failed: {e}")
            return {"success": False, "error": str(e)}

    async def prepare_folder_upload(self, folder_path: str):
        """Zip a folder for upload and return the archive path"""
        if not folder_path or not os.path.isdir(folder_path):
            return {"success": False, "error": "Invalid folder path"}
        
        self._ensure_dirs()
        base_name = os.path.basename(os.path.normpath(folder_path))
        zip_name = f"{base_name}-{int(time.time())}.zip"
        zip_path = os.path.join(self.upload_dir, zip_name)

        try:
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for root, _, files in os.walk(folder_path):
                    for file in files:
                        abs_path = os.path.join(root, file)
                        rel_path = os.path.relpath(abs_path, folder_path)
                        zipf.write(abs_path, arcname=os.path.join(base_name, rel_path))

            size = os.path.getsize(zip_path)
            return {
                "success": True,
                "path": zip_path,
                "file_name": zip_name,
                "size": size,
                "file_type": "application/zip"
            }
        except Exception as e:
            decky.logger.error(f"Failed to zip folder: {e}")
            return {"success": False, "error": str(e)}

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        # Start Flask notification server
        self._start_flask_server()
        decky.logger.info("localsend plugin loaded")

    async def _unload(self):
        self._stop_backend()
        self._stop_flask_server()

    async def _uninstall(self):
        self._stop_backend()
        self._stop_flask_server()

    async def _migration(self):
        decky.logger.info("Migrating")
