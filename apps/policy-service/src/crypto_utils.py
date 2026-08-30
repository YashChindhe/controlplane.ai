import os
import base64
from cryptography.fernet import Fernet

# For this demo, we'll use a static or env-provided encryption key
# In production, this should be a securely injected KMS key.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode('utf-8'))
_fernet = Fernet(ENCRYPTION_KEY.encode('utf-8'))

def encrypt_key(api_key: str) -> str:
    if not api_key:
        return ""
    return _fernet.encrypt(api_key.encode('utf-8')).decode('utf-8')

def decrypt_key(encrypted_key: str) -> str:
    if not encrypted_key:
        return ""
    return _fernet.decrypt(encrypted_key.encode('utf-8')).decode('utf-8')
