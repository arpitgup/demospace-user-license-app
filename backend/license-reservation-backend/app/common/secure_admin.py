from shared_lib.utils import get_secret_value
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from loguru import logger
from .constants import GCP_PROJECT_ID, ADMIN_VALIDATION_KEYS_SECRET_NAME

def load_admin_validation_keys_from_secret_manager():
    """
    Retrieves PEM keys from Secret Manager and loads them into cryptography objects.
    """
    
    private_pem = get_secret_value(GCP_PROJECT_ID, ADMIN_VALIDATION_KEYS_SECRET_NAME)

    if not private_pem:
        raise RuntimeError("Failed to retrieve one or both cryptographic keys from Secret Manager.")

    try:        
        private_key_loaded = serialization.load_pem_private_key(
            private_pem.encode('utf-8'),
            password=None # Change if your key is encrypted with a password
        )        
        public_key_loaded = private_key_loaded.public_key()
        
        # 3. Load Public Key from PEM string
        # public_key_loaded = serialization.load_pem_public_key(
        #     public_pem.encode('utf-8')
        # )
        return public_key_loaded, private_key_loaded
        
    except Exception as e:
        print(f"Error loading keys from PEM data: {e}")
        raise RuntimeError("Invalid key format retrieved from Secret Manager.")