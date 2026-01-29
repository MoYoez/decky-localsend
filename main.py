import os
import asyncio
import subprocess
import time
import socket
import json
import threading
import ssl
import urllib.request
import urllib.error

from typing import Dict, Any

import decky


class Plugin:
    def __init__(self):
        self.loop = None
        self.process = None
        self.log_file = None
        self.backend_port = 53317
        self.config_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "localsend.yaml")
        self.upload_dir = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "uploads")
        self.binary_path = os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "localsend-core")
        self.settings_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "plugin-settings.json")

        # Scan Config
        self.legacy_mode = False
        self.use_mixed_scan = True  # Default to Mixed mode
        self.skip_notify = False
        self.multicast_address = "224.0.0.167"
        self.multicast_port = 53317


        # Plugin Sets
        self.pin = ""
        self.auto_save = True
        self.use_https = True
        self.notify_on_download = False
        self.save_receive_history = True  # New: save file receive history
        
        # Unix Domain Socket notification server
        self.socket_path = "/tmp/localsend-notify.sock"
        self.notify_socket = None
        self.notify_thread = None
        self.notify_shutdown = threading.Event()
        
        # Upload session tracking
        self.upload_sessions: Dict[str, Dict[str, Any]] = {}
        
        # File receive history
        self.receive_history_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "receive-history.json")
        self.receive_history: list = []

        self._load_settings()
        self._load_receive_history()

    @property
    def backend_url(self) -> str:
        """Dynamically compute backend URL based on use_https setting"""
        protocol = "https" if self.use_https else "http"
        return f"{protocol}://127.0.0.1:{self.backend_port}"

    def _load_settings(self):
        """Load plugin settings from disk"""
        try:
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            if os.path.exists(self.settings_path):
                with open(self.settings_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.legacy_mode = bool(data.get("legacy_mode", self.legacy_mode))
                self.use_mixed_scan = bool(data.get("use_mixed_scan", self.use_mixed_scan))
                self.skip_notify = bool(data.get("skip_notify", self.skip_notify))
                self.multicast_address = str(data.get("multicast_address", self.multicast_address)).strip()
                multicast_port = data.get("multicast_port", self.multicast_port)
                try:
                    self.multicast_port = int(multicast_port or 0)
                except (ValueError, TypeError):
                    self.multicast_port = 0
                self.pin = str(data.get("pin", "")).strip()
                self.auto_save = bool(data.get("auto_save", self.auto_save))
                self.use_https = bool(data.get("use_https", self.use_https))
                self.notify_on_download = bool(data.get("notify_on_download", self.notify_on_download))
                self.save_receive_history = bool(data.get("save_receive_history", self.save_receive_history))
                upload_dir = str(data.get("download_folder", "")).strip()
                if upload_dir:
                    self.upload_dir = upload_dir
        except Exception as e:
            decky.logger.warning(f"Failed to load settings: {e}")

    def _load_receive_history(self):
        """Load file receive history from disk"""
        try:
            if os.path.exists(self.receive_history_path):
                with open(self.receive_history_path, "r", encoding="utf-8") as f:
                    self.receive_history = json.load(f)
                decky.logger.info(f"Loaded {len(self.receive_history)} receive history records")
        except Exception as e:
            decky.logger.warning(f"Failed to load receive history: {e}")
            self.receive_history = []

    def _save_receive_history(self):
        """Persist file receive history to disk"""
        try:
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            with open(self.receive_history_path, "w", encoding="utf-8") as f:
                json.dump(self.receive_history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            decky.logger.error(f"Failed to save receive history: {e}")

    def _add_receive_history(self, folder_path: str, files: list, title: str = ""):
        """Add a new entry to receive history"""
        if not self.save_receive_history:
            return
        
        entry = {
            "id": f"recv-{int(time.time() * 1000)}-{len(self.receive_history)}",
            "timestamp": time.time(),
            "title": title or "File Received",
            "folderPath": folder_path,
            "fileCount": len(files),
            "files": files,
        }
        self.receive_history.insert(0, entry)  # Insert at beginning (newest first)
        
        # Keep only last 100 records
        if len(self.receive_history) > 100:
            self.receive_history = self.receive_history[:100]
        
        self._save_receive_history()
        decky.logger.info(f"Added receive history: {folder_path} ({len(files)} files)")

    def _save_settings(self):
        """Persist plugin settings to disk"""
        try:
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            with open(self.settings_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "legacy_mode": self.legacy_mode,
                        "use_mixed_scan": self.use_mixed_scan,
                        "skip_notify": self.skip_notify,
                        "multicast_address": self.multicast_address,
                        "multicast_port": self.multicast_port,
                        "pin": self.pin,
                        "auto_save": self.auto_save,
                        "use_https": self.use_https,
                        "notify_on_download": self.notify_on_download,
                        "save_receive_history": self.save_receive_history,
                        "download_folder": self.upload_dir,
                    },
                    f,
                    ensure_ascii=True,
                    indent=2,
                )
        except Exception as e:
            decky.logger.error(f"Failed to save settings: {e}")

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
                    "type": "info",
                    "title": title,
                    "message": message,
                }),
                self.loop
            )
        except Exception as e:
            decky.logger.error(f"Failed to emit notification: {e}")

    def _emit_notification_event(self, payload: dict):
        """Emit full notification payload to frontend"""
        if self.loop is None or self.loop.is_closed():
            decky.logger.warning("Event loop not available, skipping notification emit")
            return

        try:
            asyncio.run_coroutine_threadsafe(
                decky.emit("unix_socket_notification", payload),
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
            is_text_only = notification.get('isTextOnly', False)

            self._emit_notification_event({
                "type": notification_type,
                "title": title,
                "message": message,
                "data": notification_data,
            })
            
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
                if session_id not in self.upload_sessions:
                    self.upload_sessions[session_id] = {}
                
                self.upload_sessions[session_id][file_id] = {
                    'file_id': file_id,
                    'file_name': file_name,
                    'file_size': file_size,
                    'file_type': file_type,
                    'sha256': sha256,
                    'start_time': time.time(),
                    'status': 'uploading',
                    'is_text_only': is_text_only
                }
                
            elif notification_type == 'upload_end':
                decky.logger.info(f"✅ Upload completed: {file_name} (size: {file_size} bytes)")
                decky.logger.info(f"   Session ID: {session_id}, SHA256: {sha256}")
                
                # Check if this is a text-only notification
                if is_text_only:
                    decky.logger.info(f"📝 Text-only notification detected")
                    # Read text content from uploaded file
                    try:
                        # Problem in text only :P my bad.
                        file_path = os.path.join(self.upload_dir,session_id)
                        txt_files = [f for f in os.listdir(file_path) if f.endswith('.txt')]
                        file_name = txt_files[0] if txt_files else ''
                        if file_name and os.path.exists(os.path.join(file_path, file_name)):
                            with open(os.path.join(file_path, file_name), 'r', encoding='utf-8') as f:
                                text_content = f.read()
                            
                            # Send text content to frontend with special event type
                            asyncio.run_coroutine_threadsafe(
                                decky.emit("text_received", {
                                    "title": title or "Text Received",
                                    "content": text_content,
                                    "fileName": file_name
                                }),
                                self.loop
                            )
                            decky.logger.info(f"📝 Text content sent to frontend: {len(text_content)} characters")
                        else:
                            decky.logger.warning(f"Text file not found: {file_path}")
                    except Exception as e:
                        decky.logger.error(f"Failed to read text content: {e}")
                
                # Emit regular upload completed event
                # Update upload session status
                if session_id in self.upload_sessions and file_id in self.upload_sessions[session_id]:
                    file_session = self.upload_sessions[session_id][file_id]
                    file_session['status'] = 'completed'
                    file_session['end_time'] = time.time()
                    duration = file_session['end_time'] - file_session.get('start_time', 0)
                    decky.logger.info(f"   Upload duration: {duration:.2f} seconds")
                
                # Send file received notification if enabled and not text-only
                if not is_text_only:
                    try:
                        folder_path = os.path.join(self.upload_dir, session_id)
                        files_in_folder = []
                        if os.path.isdir(folder_path):
                            files_in_folder = os.listdir(folder_path)
                        
                        # Save to receive history
                        self._add_receive_history(folder_path, files_in_folder, title or "File Received")
                        
                        # Send notification if enabled
                        if self.notify_on_download:
                            asyncio.run_coroutine_threadsafe(
                                decky.emit("file_received", {
                                    "title": title or "File Received",
                                    "folderPath": folder_path,
                                    "fileCount": len(files_in_folder),
                                    "files": files_in_folder
                                }),
                                self.loop
                            )
                            decky.logger.info(f"📁 File received notification sent: {folder_path}")
                    except Exception as e:
                        decky.logger.error(f"Failed to send file received notification: {e}")
                    
            elif notification_type == 'info':
                decky.logger.info(f"ℹ️  {title}: {message}")
            else:
                decky.logger.warning(f"⚠️  Unknown notification type: {notification_type}")
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
            "-log",
            "prod",
            "-useDefaultUploadFolder",
            self.upload_dir,
            "-useReferNetworkInterface",
            "*", # set to all
        ]
        if self.multicast_address:
            cmd.extend(["-useMultcastAddress", self.multicast_address])
        if self.multicast_port > 0:
            cmd.extend(["-useMultcastPort", str(self.multicast_port)])
        if self.legacy_mode:
            cmd.append("-useLegacyMode")
        if self.use_mixed_scan:
            cmd.append("-useMixedScan")
        if self.skip_notify:
            cmd.append("-skipNotify")
        if self.pin:
            cmd.extend(["-usePin", self.pin])
        cmd.append(f"-useAutoSave={'true' if self.auto_save else 'false'}")
        cmd.append(f"-useHttps={'true' if self.use_https else 'false'}")

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

    def _read_config_yaml(self) -> dict:
        if not os.path.exists(self.config_path):
            return {}
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            decky.logger.error(f"Failed to read config: {e}")
            return {}

        config = {}
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or ":" not in line:
                continue
            key, _, value = stripped.partition(":")
            key = key.strip()
            value = value.strip()
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.lower() in ("true", "false"):
                value = value.lower() == "true"
            else:
                try:
                    value = int(value)
                except ValueError:
                    pass
            config[key] = value
        return config

    def _format_yaml_value(self, value):
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        value_str = str(value)
        if value_str == "":
            return '""'
        needs_quote = any(ch in value_str for ch in [":", "#", "\n", "\r", "\t"]) or value_str.startswith(" ") or value_str.endswith(" ")
        return json.dumps(value_str) if needs_quote else value_str

    def _update_config_yaml(self, updates: dict) -> None:
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        lines = []
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
            except Exception as e:
                decky.logger.error(f"Failed to read config for update: {e}")
                lines = []

        updated_keys = set()
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or ":" not in line:
                continue
            key, _, _ = stripped.partition(":")
            key = key.strip()
            if key in updates:
                lines[idx] = f"{key}: {self._format_yaml_value(updates[key])}\n"
                updated_keys.add(key)

        for key, value in updates.items():
            if key in updated_keys:
                continue
            lines.append(f"{key}: {self._format_yaml_value(value)}\n")

        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
        except Exception as e:
            decky.logger.error(f"Failed to write config: {e}")

    def _get_ssl_context(self):
        """Create SSL context that ignores certificate verification"""
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    def _do_request(self, method: str, url: str, data: bytes = None, headers: dict = None, max_retries: int = 3, backoff_factor: float = 0.5):
        """Execute HTTP request with retry logic using urllib"""
        retry_status_codes = {500, 502, 503, 504}
        last_error = None
        
        req_headers = headers or {}
        
        for attempt in range(max_retries + 1):
            try:
                request = urllib.request.Request(url, data=data, headers=req_headers, method=method)
                ctx = self._get_ssl_context()
                
                with urllib.request.urlopen(request, context=ctx, timeout=30) as response:
                    response_data = response.read()
                    status_code = response.status
                    content_type = response.headers.get('Content-Type', '')
                    
                    return response_data, status_code, content_type
                    
            except urllib.error.HTTPError as e:
                status_code = e.code
                if status_code in retry_status_codes and attempt < max_retries:
                    time.sleep(backoff_factor * (2 ** attempt))
                    last_error = e
                    continue
                # Return error response
                try:
                    response_data = e.read()
                except:
                    response_data = b''
                content_type = e.headers.get('Content-Type', '') if e.headers else ''
                return response_data, status_code, content_type
                
            except urllib.error.URLError as e:
                last_error = e
                if attempt < max_retries:
                    time.sleep(backoff_factor * (2 ** attempt))
                    continue
                raise
                
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    time.sleep(backoff_factor * (2 ** attempt))
                    continue
                raise
        
        raise last_error if last_error else Exception("Max retries exceeded")

    async def _proxy_request(self, method: str, path: str, **kwargs):
        if not self._is_running():
            return {"error": "Backend not running"}, 503

        url = f"{self.backend_url}{path}"

        try:
            loop = asyncio.get_event_loop()
            
            # Prepare request data and headers
            data = None
            headers = {}
            
            if 'json' in kwargs:
                data = json.dumps(kwargs['json']).encode('utf-8')
                headers['Content-Type'] = 'application/json'
            elif 'data' in kwargs:
                data = kwargs['data']
                if isinstance(data, str):
                    data = data.encode('utf-8')
            
            if 'headers' in kwargs:
                headers.update(kwargs['headers'])
            
            response_data, status_code, content_type = await loop.run_in_executor(
                None,
                lambda: self._do_request(method, url, data=data, headers=headers)
            )

            if 'application/json' in content_type:
                try:
                    parsed_data = json.loads(response_data.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    parsed_data = response_data.decode('utf-8', errors='replace')
            else:
                parsed_data = response_data.decode('utf-8', errors='replace')

            return parsed_data, status_code
        except Exception as e:
            decky.logger.error(f"Proxy request failed: {e}")
            return {"error": str(e)}, 500


    # used in frontend to get data from backend.
    async def proxy_get(self, path: str):
        data, status = await self._proxy_request("GET", path)
        return {"data": data, "status": status}

    # used in frontend to send data to backend.
    async def proxy_post(self, path: str, json_data: dict = None, body: bytes = None):
        kwargs = {}
        if json_data is not None:
            kwargs['json'] = json_data
        if body is not None:
            kwargs['data'] = bytes(body) if isinstance(body, list) else body
            kwargs['headers'] = {'Content-Type': 'application/octet-stream'}

        data, status = await self._proxy_request("POST", path, **kwargs)
        return {"data": data, "status": status}

    # used in frontend to get upload session records.
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
    
    # used in frontend to clear upload session records.
    async def clear_upload_sessions(self):
        """Clear upload session records"""
        self.upload_sessions.clear()
        decky.logger.info("Upload session records cleared")
        return {"success": True}
    
    # used in frontend to get notification server status.
    async def get_notify_server_status(self):
        """Get notification server status"""
        is_running = self.notify_thread is not None and self.notify_thread.is_alive()
        return {
            "running": is_running,
            "socket_path": self.socket_path,
            "socket_exists": os.path.exists(self.socket_path)
        }

    # Receive history API
    async def get_receive_history(self):
        """Get file receive history"""
        return self.receive_history

    async def clear_receive_history(self):
        """Clear file receive history"""
        self.receive_history.clear()
        self._save_receive_history()
        decky.logger.info("Receive history cleared")
        return {"success": True}

    async def delete_receive_history_item(self, item_id: str):
        """Delete a single receive history item"""
        original_len = len(self.receive_history)
        self.receive_history = [item for item in self.receive_history if item.get("id") != item_id]
        if len(self.receive_history) < original_len:
            self._save_receive_history()
            decky.logger.info(f"Deleted receive history item: {item_id}")
            return {"success": True}
        return {"success": False, "error": "Item not found"}

    async def get_backend_config(self):
        config = self._read_config_yaml()
        return {
            "alias": str(config.get("alias", "")).strip(),
            "download_folder": self.upload_dir,
            "legacy_mode": self.legacy_mode,
            "use_mixed_scan": self.use_mixed_scan,
            "skip_notify": self.skip_notify,
            "multicast_address": self.multicast_address,
            "multicast_port": self.multicast_port,
            "pin": self.pin,
            "auto_save": self.auto_save,
            "use_https": self.use_https,
            "notify_on_download": self.notify_on_download,
            "save_receive_history": self.save_receive_history,
        }

    async def set_backend_config(self, config: dict):
        alias = str(config.get("alias", "")).strip()
        download_folder = str(config.get("download_folder", "")).strip()
        legacy_mode = bool(config.get("legacy_mode", False))
        use_mixed_scan = bool(config.get("use_mixed_scan", False))
        skip_notify = bool(config.get("skip_notify", False))
        multicast_address = str(config.get("multicast_address", "")).strip()
        multicast_port_raw = config.get("multicast_port", 0)
        pin = str(config.get("pin", "")).strip()
        auto_save = bool(config.get("auto_save", True))
        use_https = bool(config.get("use_https", True))
        notify_on_download = bool(config.get("notify_on_download", False))
        save_receive_history = bool(config.get("save_receive_history", True))

        self._update_config_yaml({"alias": alias})

        if download_folder:
            self.upload_dir = download_folder

        self.legacy_mode = legacy_mode
        self.use_mixed_scan = use_mixed_scan
        self.skip_notify = skip_notify
        self.multicast_address = multicast_address
        try:
            self.multicast_port = int(multicast_port_raw or 0)
        except (ValueError, TypeError):
            self.multicast_port = 0
        self.pin = pin
        self.auto_save = auto_save
        self.use_https = use_https
        self.notify_on_download = notify_on_download
        self.save_receive_history = save_receive_history

        self._save_settings()
        self._ensure_dirs()

        restarted = False
        try:
            if self._is_running():
                self._stop_backend()
                self._start_backend()
                restarted = True
        except Exception as e:
            decky.logger.error(f"Failed to restart backend: {e}")
            return {
                "success": False,
                "error": str(e),
                "restarted": restarted,
                "running": self._is_running(),
            }

        return {
            "success": True,
            "restarted": restarted,
            "running": self._is_running(),
        }

    # used in frontend to list all files in a folder recursively.
    async def list_folder_files(self, folder_path: str):
        """List all files in a folder recursively, returning their paths relative to the folder"""
        if not folder_path or not os.path.isdir(folder_path):
            return {"success": False, "error": "Invalid folder path", "files": []}
        
        try:
            files = []
            base_name = os.path.basename(os.path.normpath(folder_path))
            
            for root, _, filenames in os.walk(folder_path):
                for filename in filenames:
                    abs_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(abs_path, folder_path)
                    # Display path includes the folder name for clarity
                    display_path = os.path.join(base_name, rel_path)
                    
                    files.append({
                        "path": abs_path,
                        "displayPath": display_path,
                        "fileName": filename,
                    })
            
            return {
                "success": True,
                "files": files,
                "folderName": base_name,
                "count": len(files)
            }
        except Exception as e:
            decky.logger.error(f"Failed to list folder files: {e}")
            return {"success": False, "error": str(e), "files": []}
    

    async def factory_reset(self):
        """Reset all settings to default and delete config files"""
        try:
            # Stop backend if running
            if self._is_running():
                self._stop_backend()
            
            # Delete plugin settings file
            if os.path.exists(self.settings_path):
                os.remove(self.settings_path)
                decky.logger.info(f"Deleted settings file: {self.settings_path}")
            
            # Delete backend config file
            if os.path.exists(self.config_path):
                os.remove(self.config_path)
                decky.logger.info(f"Deleted config file: {self.config_path}")
            
            # Delete receive history file
            if os.path.exists(self.receive_history_path):
                os.remove(self.receive_history_path)
                decky.logger.info(f"Deleted receive history file: {self.receive_history_path}")
            
            # Reset instance variables to defaults
            self.legacy_mode = False
            self.use_mixed_scan = True  # Default to Mixed mode
            self.skip_notify = False
            self.multicast_address = "224.0.0.167"
            self.multicast_port = 53317
            self.pin = ""
            self.auto_save = True
            self.use_https = True
            self.notify_on_download = False
            self.save_receive_history = True
            self.upload_dir = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "uploads")
            
            # Clear upload sessions and receive history
            self.upload_sessions.clear()
            self.receive_history.clear()
            
            decky.logger.info("Factory reset completed")
            return {"success": True, "message": "Factory reset completed"}
        except Exception as e:
            decky.logger.error(f"Factory reset failed: {e}")
            return {"success": False, "error": str(e)}

    # BASE decky python-backend.
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
