from flask import Flask, request, render_template_string, jsonify, session
from thrift import Thrift
from thrift.transport import TSocket, TTransport
from thrift.protocol import TBinaryProtocol
from login_service import LoginService
from login_service.ttypes import LoginRequest
import socket
import time
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

# Thrift server configuration
THRIFT_HOST = 'localhost'  # Change to your server IP if needed
THRIFT_PORT = 9090

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Login System</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 28px;
        }
        .logo {
            text-align: center;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:active {
            transform: translateY(0);
        }
        .message {
            margin-top: 20px;
            padding: 12px;
            border-radius: 10px;
            text-align: center;
            display: none;
        }
        .message.success {
            display: block;
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .message.error {
            display: block;
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .message.info {
            display: block;
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 10px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .status .dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status .dot.online {
            background: #28a745;
        }
        .status .dot.offline {
            background: #dc3545;
        }
        .device-info {
            margin-top: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 10px;
            font-size: 12px;
            color: #888;
            text-align: center;
        }
        .logout-btn {
            margin-top: 10px;
            background: #dc3545;
        }
        .logout-btn:hover {
            background: #c82333;
        }
        @media (max-width: 480px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔐</div>
        <h1>Login System</h1>
        
        <div id="message" class="message"></div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" placeholder="Enter your password" required>
            </div>
            <button type="submit">Login</button>
        </form>
        
        <div id="logoutSection" style="display:none;">
            <button class="logout-btn" onclick="logout()">Logout</button>
        </div>
        
        <div class="status">
            <span class="dot online" id="statusDot"></span>
            <span id="statusText">Connected to server</span>
        </div>
        
        <div class="device-info">
            Device: <span id="deviceName">{{ device }}</span>
        </div>
    </div>

    <script>
        function showMessage(text, type) {
            const msg = document.getElementById('message');
            msg.textContent = text;
            msg.className = 'message ' + type;
            msg.style.display = 'block';
            setTimeout(() => {
                msg.style.display = 'none';
            }, 5000);
        }

        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }
            
            // Send login request
            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({username, password})
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage('✅ Login successful! Welcome ' + username, 'success');
                    document.getElementById('loginForm').style.display = 'none';
                    document.getElementById('logoutSection').style.display = 'block';
                } else {
                    showMessage('❌ ' + data.message, 'error');
                }
            })
            .catch(error => {
                showMessage('❌ Error connecting to server', 'error');
            });
        });

        function logout() {
            fetch('/logout', {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage('✅ Logout successful', 'info');
                    document.getElementById('loginForm').style.display = 'block';
                    document.getElementById('logoutSection').style.display = 'none';
                    document.getElementById('username').value = '';
                    document.getElementById('password').value = '';
                }
            });
        }

        // Check session status
        fetch('/status')
            .then(response => response.json())
            .then(data => {
                if (data.logged_in) {
                    document.getElementById('loginForm').style.display = 'none';
                    document.getElementById('logoutSection').style.display = 'block';
                    showMessage('You are already logged in as ' + data.username, 'info');
                }
            });
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    device_name = socket.gethostname()
    return render_template_string(HTML_TEMPLATE, device=device_name)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'})
    
    try:
        # Connect to Thrift server
        transport = TSocket.TSocket(THRIFT_HOST, THRIFT_PORT)
        transport = TTransport.TBufferedTransport(transport)
        protocol = TBinaryProtocol.TBinaryProtocol(transport)
        client = LoginService.Client(protocol)
        transport.open()
        
        # Create login request
        device_id = f"web_{socket.gethostname()}_{int(time.time())}"
        login_request = LoginRequest(
            username=username,
            password=password,
            device_id=device_id
        )
        
        # Authenticate
        response = client.authenticate(login_request)
        transport.close()
        
        if response.success:
            session['username'] = username
            session['session_token'] = response.session_token
            session['device_id'] = device_id
            return jsonify({'success': True, 'message': 'Login successful'})
        else:
            return jsonify({'success': False, 'message': response.message})
            
    except Thrift.TException as e:
        return jsonify({'success': False, 'message': f'Server connection error: {str(e)}'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@app.route('/logout', methods=['POST'])
def logout():
    try:
        if 'session_token' in session:
            # Optional: Inform thrift server about logout
            transport = TSocket.TSocket(THRIFT_HOST, THRIFT_PORT)
            transport = TTransport.TBufferedTransport(transport)
            protocol = TBinaryProtocol.TBinaryProtocol(transport)
            client = LoginService.Client(protocol)
            transport.open()
            client.logout(session['session_token'])
            transport.close()
    except:
        pass
    
    session.clear()
    return jsonify({'success': True})

@app.route('/status')
def status():
    if 'username' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

if __name__ == '__main__':
    print("="*50)
    print("🌐 Web Login Server Starting...")
    print(f"📡 Access the login page at: http://localhost:5000")
    print("💡 From other devices: http://YOUR_IP:5000")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)
