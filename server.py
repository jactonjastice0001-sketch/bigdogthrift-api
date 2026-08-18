from thrift.transport import TSocket, TTransport
from thrift.protocol import TBinaryProtocol
from thrift.server import TServer
from login_service import LoginService
from login_service.ttypes import LoginRequest, LoginResponse
from user_db import UserDatabase
import logging
import sys
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LoginServiceHandler:
    def __init__(self):
        self.db = UserDatabase()
        logger.info("LoginService initialized")
        logger.info(f"Available users: {list(self.db.users.keys())}")
    
    def authenticate(self, request):
        logger.info(f"Auth attempt from device: {request.device_id} for user: {request.username}")
        
        success, result = self.db.authenticate(
            request.username,
            request.password,
            request.device_id
        )
        
        if success:
            response = LoginResponse(
                success=True,
                message="Authentication successful",
                session_token=result,
                timestamp=int(time.time())
            )
            logger.info(f"✅ User {request.username} authenticated from {request.device_id}")
        else:
            response = LoginResponse(
                success=False,
                message=result,
                session_token=None,
                timestamp=int(time.time())
            )
            logger.warning(f"❌ Auth failed for {request.username}: {result}")
        
        return response
    
    def logout(self, session_token):
        result = self.db.logout(session_token)
        if result:
            logger.info(f"✅ Session {session_token[:10]}... logged out")
        else:
            logger.warning(f"❌ Logout failed for {session_token[:10]}...")
        return result
    
    def check_session(self, session_token):
        is_valid = self.db.check_session(session_token)
        if is_valid:
            username = self.db.get_user_from_session(session_token)
            logger.info(f"✅ Session valid for {username}")
        else:
            logger.warning(f"❌ Session invalid: {session_token[:10]}...")
        return is_valid

def run_server(port=9090):
    handler = LoginServiceHandler()
    processor = LoginService.Processor(handler)
    
    transport = TSocket.TServerSocket(host='0.0.0.0', port=port)
    tfactory = TTransport.TBufferedTransportFactory()
    pfactory = TBinaryProtocol.TBinaryProtocolFactory()
    
    server = TServer.TSimpleServer(processor, transport, tfactory, pfactory)
    
    logger.info(f"🚀 Thrift Login Server running on port {port}")
    logger.info(f"📡 Listening on all network interfaces (0.0.0.0:{port})")
    logger.info("💡 Press Ctrl+C to stop the server")
    logger.info("="*50)
    
    try:
        server.serve()
    except KeyboardInterrupt:
        logger.info("\n👋 Server shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    port = 9090
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            logger.error("Invalid port number. Using default port 9090.")
    
    run_server(port)
