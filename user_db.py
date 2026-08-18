import hashlib
import secrets
from datetime import datetime, timedelta

class UserDatabase:
    def __init__(self):
        self.users = {
            "admin": {
                "password": self._hash_password("admin123"),
                "devices": [],
                "email": "admin@example.com",
                "created_at": datetime.now().isoformat()
            },
            "user1": {
                "password": self._hash_password("pass123"),
        "jactonjastice": {
                "password": "93e8072e52f84efc2253182bd1fd682dbba6fc02282f4747761e27e2da6c2a11",
                "devices": [],
                "email": "jacton@example.com",
                "created_at": "2026-07-21T11:20:21.827863"
            },

        "jactonjastice": {
                "password": "93e8072e52f84efc2253182bd1fd682dbba6fc02282f4747761e27e2da6c2a11",
                "devices": [],
                "email": "jacton@example.com",
                "created_at": "2026-07-21T11:18:36.482122"
            },

                "devices": [],
                "email": "user1@example.com",
                "created_at": datetime.now().isoformat()
            }
        }
        self.sessions = {}
        
    def _hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register(self, username, password, email, device_id):
        if username in self.users:
            return False, "Username already exists"
        
        if len(username) < 3:
            return False, "Username must be at least 3 characters"
        
        if len(password) < 6:
            return False, "Password must be at least 6 characters"
        
        self.users[username] = {
            "password": self._hash_password(password),
            "devices": [device_id],
            "email": email,
            "created_at": datetime.now().isoformat()
        }
        
        return True, "User registered successfully"
    
    def authenticate(self, username, password, device_id):
        if username not in self.users:
            return False, "User not found"
        
        if self.users[username]["password"] != self._hash_password(password):
            return False, "Invalid password"
        
        session_token = secrets.token_urlsafe(32)
        self.sessions[session_token] = {
            "username": username,
            "device_id": device_id,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(hours=24)).isoformat()
        }
        
        if device_id not in self.users[username]["devices"]:
            self.users[username]["devices"].append(device_id)
        
        return True, session_token
    
    def logout(self, session_token):
        if session_token in self.sessions:
            del self.sessions[session_token]
            return True
        return False
    
    def check_session(self, session_token):
        if session_token not in self.sessions:
            return False
        
        session = self.sessions[session_token]
        if datetime.now().isoformat() > session["expires_at"]:
            del self.sessions[session_token]
            return False
        
        return True
    
    def get_user_from_session(self, session_token):
        if session_token in self.sessions:
            return self.sessions[session_token]["username"]
        return None
