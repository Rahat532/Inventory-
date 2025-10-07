import os
import sys


def get_data_root() -> str:
    """Return a stable, writable data root directory.

    Uses IMS_DATA_DIR env var if set. Otherwise, selects a user-scoped folder:
    - On Windows: %APPDATA%/IMS
    - On Unix/macOS: ~/.ims
    """
    env_dir = os.getenv('IMS_DATA_DIR')
    if env_dir:
        return env_dir

    # Detect portable/frozen runtime but still prefer user data path
    # sys.frozen is set by PyInstaller
    if sys.platform.startswith('win'):
        base = os.getenv('APPDATA') or os.path.expanduser('~')
        return os.path.join(base, 'IMS')
    else:
        return os.path.join(os.path.expanduser('~'), '.ims')


def ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def get_data_dir(subfolder: str = '') -> str:
    root = ensure_dir(get_data_root())
    if subfolder:
        return ensure_dir(os.path.join(root, subfolder))
    return root
