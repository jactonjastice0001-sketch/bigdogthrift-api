from client import LoginClient

print("🧪 Testing Thrift Login System")
print("="*50)

client = LoginClient(host='localhost', port=9090)

if client.connect():
    print("\n📝 Testing admin login...")
    client.login("admin", "admin123")
    
    if client.session_token:
        print("\n🔍 Checking session...")
        client.check_session()
        
        print("\n🚪 Logging out...")
        client.logout()
    
    client.disconnect()

print("\n✅ Test complete!")
