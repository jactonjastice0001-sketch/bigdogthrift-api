from thrift import Thrift
from thrift.transport import TSocket, TTransport
from thrift.protocol import TBinaryProtocol
from login_service import LoginService
from login_service.ttypes import LoginRequest
import socket
import time
import sys

class LoginClient:
    def __init__(self, host='localhost', port=9090):
        self.host = host
        self.port = port
        self.session_token = None
        self.transport = None
        self.client = None
        
    def connect(self):
        try:
            transport = TSocket.TSocket(self.host, self.port)
            self.transport = TTransport.TBufferedTransport(transport)
            protocol = TBinaryProtocol.TBinaryProtocol(self.transport)
            self.client = LoginService.Client(protocol)
            self.transport.open()
            print(f"✅ Connected to {self.host}:{self.port}")
            return True
        except Thrift.TException as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def disconnect(self):
        if self.transport:
            self.transport.close()
            print("Disconnected from server")
    
    def login(self, username, password):
        if not self.client:
            print("❌ Not connected to server")
            return False
        
        device_id = socket.gethostname() + "_" + str(int(time.time()))
        
        request = LoginRequest(
            username=username,
            password=password,
            device_id=device_id
        )
        
        try:
            response = self.client.authenticate(request)
            if response.success:
                self.session_token = response.session_token
                print(f"✅ Login successful for user: {username}")
                print(f"   Session: {response.session_token[:20]}...")
                return True
            else:
                print(f"❌ Login failed: {response.message}")
                return False
        except Thrift.TException as e:
            print(f"❌ Error during login: {e}")
            return False
    
    def logout(self):
        if not self.session_token:
            print("❌ Not logged in")
            return False
        
        try:
            result = self.client.logout(self.session_token)
            if result:
                print("✅ Logout successful")
                self.session_token = None
                return True
            else:
                print("❌ Logout failed")
                return False
        except Thrift.TException as e:
            print(f"❌ Error during logout: {e}")
            return False
    
    def check_session(self):
        if not self.session_token:
            print("❌ No active session")
            return False
        
        try:
            is_valid = self.client.check_session(self.session_token)
            if is_valid:
                print("✅ Session is valid")
                return True
            else:
                print("❌ Session expired or invalid")
                self.session_token = None
                return False
        except Thrift.TException as e:
            print(f"❌ Error checking session: {e}")
            return False

def main():
    server_ip = 'localhost'
    port = 9090
    
    if len(sys.argv) > 1:
        server_ip = sys.argv[1]
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
        except ValueError:
            print("Invalid port number. Using default port 9090.")
    
    print("="*50)
    print(f"🔐 Thrift Login Client - Connecting to {server_ip}:{port}")
    print("="*50)
    
    client = LoginClient(host=server_ip, port=port)
    
    if not client.connect():
        return
    
    try:
        while True:
            print("\n📋 Options:")
            print("1. Login")
            print("2. Check Session")
            print("3. Logout")
            print("4. Exit")
            
            choice = input("\nSelect option (1-4): ").strip()
            
            if choice == '1':
                username = input("Username: ")
                password = input("Password: ")
                client.login(username, password)
            
            elif choice == '2':
                client.check_session()
            
            elif choice == '3':
                client.logout()
            
            elif choice == '4':
                break
            
            else:
                print("Invalid option")
    
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
