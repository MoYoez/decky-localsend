import os
import sys
import asyncio
import subprocess
import time
import zipfile
import socket
import json
import threading

import requests
from typing import Dict, Any

py_modules_path = os.path.join(os.path.dirname(__file__), "py_modules")
if py_modules_path not in sys.path:
    sys.path.insert(0, py_modules_path)


from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import decky


class Plugin:
    def __init__(self):
        self.loop = None
        self.process = None
        self.log_file = None
        self.backend_port = 53317
        self.backend_protocol = "https"
        self.config_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "localsend.yaml")
        self.upload_dir = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "uploads")
        self.binary_path = os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "localsend-core")
        self.backend_url = f"{self.backend_protocol}://127.0.0.1:{self.backend_port}"
        
        # Unix Domain Socket notification server
        self.socket_path = "/tmp/localsend-notify.sock"
        self.notify_socket = None
        self.notify_thread = None
        self.notify_shutdown = threading.Event()
        
        # Upload session tracking
        self.upload_sessions: Dict[str, Dict[str, Any]] = {}

    def _ensure_dirs(self):
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(decky.DECKY_PLUGIN_LOG_DIR, exist_ok=True)

    def _start_notify_server(self):
        """Start Unix Domain Socket notification server"""
        if self.notify_thread is not None and self.notify_thread.is_alive():
            decky.logger.info("Notification server is already running")
            return
        
        # Cleanup existing socket
        if os.path.exists(self.socket_path):
            try:
                os.remove(self.socket_path)
            except Exception as e:
                decky.logger.warning(f"Failed to remove existing socket: {e}")
        
        self.notify_shutdown.clear()
        
        def run_notify_server():
            try:
                # Create Unix socket
                sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                sock.bind(self.socket_path)
                sock.listen(5)
                sock.settimeout(1.0)  # Allow periodic checks for shutdown
                self.notify_socket = sock
                
                decky.logger.info(f"📡 Notification server listening on: {self.socket_path}")
                
                while not self.notify_shutdown.is_set():
                    try:
                        conn, _ = sock.accept()
                        # Handle connection in the same thread (simple implementation)
                        try:
                            data = conn.recv(4096)
                            if data:
                                notification = json.loads(data.decode('utf-8'))
                                self._handle_notification(notification)
                                
                                # Send response
                                response = {"ok": True}
                                conn.send(json.dumps(response).encode('utf-8'))
                        except json.JSONDecodeError as e:
                            decky.logger.error(f"Failed to parse notification JSON: {e}")
                        except Exception as e:
                            decky.logger.error(f"Error handling connection: {e}")
                        finally:
                            conn.close()
                    except socket.timeout:
                        # Timeout is expected, continue loop
                        continue
                    except Exception as e:
                        if not self.notify_shutdown.is_set():
                            decky.logger.error(f"Socket accept error: {e}")
                        break
                
            except Exception as e:
                decky.logger.error(f"Notification server error: {e}")
            finally:
                if self.notify_socket:
                    try:
                        self.notify_socket.close()
                    except:
                        pass
                    self.notify_socket = None
                
                # Cleanup socket file
                if os.path.exists(self.socket_path):
                    try:
                        os.remove(self.socket_path)
                    except:
                        pass
                
                decky.logger.info("📡 Notification server stopped")
        
        self.notify_thread = threading.Thread(target=run_notify_server, daemon=True)
        self.notify_thread.start()
    
    def _stop_notify_server(self):
        """Stop Unix Domain Socket notification server"""
        if self.notify_thread is None or not self.notify_thread.is_alive():
            return
        
        decky.logger.info("Stopping notification server...")
        self.notify_shutdown.set()
        
        # Wait for thread to finish
        if self.notify_thread:
            self.notify_thread.join(timeout=3)
        
        self.notify_thread = None
        decky.logger.info("Notification server stopped")
    
    def _emit_notification_safe(self, title: str, message: str):
        """Safely emit notification from thread to main event loop"""
        if self.loop is None or self.loop.is_closed():
            decky.logger.warning("Event loop not available, skipping notification emit")
            return
        
        try:
            asyncio.run_coroutine_threadsafe(
                decky.emit("unix_socket_notification", {
                    "title": title,
                    "message": message
                }),
                self.loop
            )
        except Exception as e:
            decky.logger.error(f"Failed to emit notification: {e}")
    
    def _handle_notification(self, notification: dict):
        """Handle incoming notification from Go backend"""
        try:
            notification_type = notification.get('type')
            title = notification.get('title', '')
            message = notification.get('message', '')
            notification_data = notification.get('data', {})
            
            session_id = notification_data.get('sessionId', '')
            file_id = notification_data.get('fileId', '')
            file_name = notification_data.get('fileName', '')
            file_size = notification_data.get('size', 0)
            file_type = notification_data.get('fileType', '')
            sha256 = notification_data.get('sha256', '')
            
            if notification_type == 'upload_start':
                decky.logger.info(f"📤 Upload started: {file_name} (size: {file_size} bytes)")
                decky.logger.info(f"   Session ID: {session_id}, File ID: {file_id}")
                
                # Emit event to frontend
                self._emit_notification_safe(
                    "Upload Started",
                    f"File upload started: {file_name} (size: {file_size} bytes)"
                )
                
                # Save upload session information
                if session_id not in self.upload_sessions:
                    self.upload_sessions[session_id] = {}
                
                self.upload_sessions[session_id][file_id] = {
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
                
                # Emit event to frontend
                self._emit_notification_safe(
                    "Upload Completed",
                    f"File upload completed: {file_name} (size: {file_size} bytes)"
                )
                
                # Update upload session status
                if session_id in self.upload_sessions and file_id in self.upload_sessions[session_id]:
                    file_session = self.upload_sessions[session_id][file_id]
                    file_session['status'] = 'completed'
                    file_session['end_time'] = time.time()
                    duration = file_session['end_time'] - file_session.get('start_time', 0)
                    decky.logger.info(f"   Upload duration: {duration:.2f} seconds")
                    
            elif notification_type == 'info':
                decky.logger.info(f"ℹ️  {title}: {message}")
                
                # Emit event to frontend
                self._emit_notification_safe("Info", f"{title}: {message}")
                
            else:
                decky.logger.warning(f"⚠️  Unknown notification type: {notification_type}")
                
                # Emit event to frontend
                self._emit_notification_safe(
                    "Unknown Notification Type",
                    f"Unknown notification type: {notification_type}"
                )
                
        except Exception as e:
            decky.logger.error(f"❌ Error processing notification: {str(e)}")
            self._emit_notification_safe(
                "Error",
                f"Error processing notification: {str(e)}"
            )

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

        # Build startup command
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
            self._start_notify_server()
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
        for session_id, files in self.upload_sessions.items():
            for file_id, file_data in files.items():
                sessions.append({
                    'session_id': session_id,
                    **file_data
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
        is_running = self.notify_thread is not None and self.notify_thread.is_alive()
        return {
            "running": is_running,
            "socket_path": self.socket_path,
            "socket_exists": os.path.exists(self.socket_path)
        }

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
        self._start_notify_server()
        decky.logger.info("localsend plugin loaded")

    async def _unload(self):
        self._stop_backend()
        self._stop_notify_server()

    async def _uninstall(self):
        self._stop_backend()
        self._stop_notify_server()

    async def _migration(self):
        decky.logger.info("Migrating")
