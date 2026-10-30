from pathlib import Path
from flask import Flask, jsonify, render_template

from routes.contenedores import contenedores_bp
from routes.fotos import fotos_bp
from routes.escanear import escanear_bp


# =========================================================
# CONFIGURACIÓN DE RUTAS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


# =========================================================
# CONFIGURACIÓN DE FLASK
# =========================================================

app = Flask(
    __name__,
    template_folder=str(FRONTEND_DIR),
    static_folder=str(FRONTEND_DIR),
    static_url_path="/static"
)

# Límite máximo de cada solicitud de subida: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# =========================================================
# REGISTRO DE RUTAS DEL BACKEND
# =========================================================

app.register_blueprint(contenedores_bp)
app.register_blueprint(fotos_bp)
app.register_blueprint(escanear_bp)


# =========================================================
# VISTA PRINCIPAL
# =========================================================

@app.route("/")
def inicio():
    return render_template("index.html")


# =========================================================
# ESTADO DE LA API
# =========================================================

@app.route("/api/estado")
def estado():
    return jsonify({
        "estado": "ok",
        "base_datos": "SQLite",
        "backend": "Flask"
    })


# =========================================================
# MANEJO DE ARCHIVOS DEMASIADO GRANDES
# =========================================================

@app.errorhandler(413)
def archivo_demasiado_grande(error):
    return jsonify({
        "error": "La solicitud supera el límite de 10 MB"
    }), 413


# =========================================================
# EJECUCIÓN DEL SERVIDOR
# =========================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)