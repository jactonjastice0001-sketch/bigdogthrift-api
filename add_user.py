import hashlib
from datetime import datetime

def add_user(username, password, email="user@example.com"):
    # Read the current user_db.py
    with open('user_db.py', 'r') as f:
        content = f.read()
    
    # Create the new user entry
    hashed = hashlib.sha256(password.encode()).hexdigest()
    new_user = f'''        "{username}": {{
                "password": "{hashed}",
                "devices": [],
                "email": "{email}",
                "created_at": "{datetime.now().isoformat()}"
            }},\n'''
    
    # Find where to insert (after user1)
    lines = content.split('\n')
    insert_pos = -1
    for i, line in enumerate(lines):
        if '"user1"' in line:
            insert_pos = i + 2
            break
    
    if insert_pos != -1:
        lines.insert(insert_pos, new_user)
        new_content = '\n'.join(lines)
        
        # Write back
        with open('user_db.py', 'w') as f:
            f.write(new_content)
        
        print(f"✅ User '{username}' added successfully!")
        print(f"   Password: {password}")
        print(f"   Email: {email}")
        return True
    else:
        print("❌ Could not find insertion point")
        return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 3:
        email = sys.argv[3] if len(sys.argv) > 3 else "user@example.com"
        add_user(sys.argv[1], sys.argv[2], email)
    else:
        print("Usage: python add_user.py username password [email]")
        print("Example: python add_user.py jactonjastice oriwoboyshigh jacton@example.com")
