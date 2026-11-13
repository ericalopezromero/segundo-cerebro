"""Genera SALT y HASH para una contraseña nueva.
Uso:  python3 scripts/hash_password.py
Después pega los dos valores en app.js (arriba del todo)."""

import getpass
import hashlib
import secrets

ITER = 200000  # debe coincidir con ITER en app.js

pw = getpass.getpass("Contraseña nueva: ")
salt = secrets.token_hex(8)
digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), ITER, dklen=32).hex()
print("\nPega esto en app.js:\n")
print("  var SALT = '%s';" % salt)
print("  var HASH = '%s';" % digest)
