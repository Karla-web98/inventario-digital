import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "database" / "inventario.db"


def obtener_conexion():
    conexion = sqlite3.connect(DATABASE_PATH)

    # Permite trabajar con las columnas por nombre
    conexion.row_factory = sqlite3.Row

    # Activa las claves foráneas de SQLite
    conexion.execute("PRAGMA foreign_keys = ON")

    return conexion