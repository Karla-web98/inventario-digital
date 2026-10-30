import cv2
import numpy as np
from flask import Blueprint, jsonify, request

from ocr import calcular_digito_control, leer_identificador


escanear_bp = Blueprint(
    "escanear",
    __name__,
    url_prefix="/api/escanear"
)

MODOS_VALIDOS = {"auto", "iso", "numerico"}


def _silencio(*args, **kwargs):
    """El OCR imprime cada intento; en la API no hace falta."""


# =========================================
# POST /api/escanear
# Lee el número de un contenedor desde una foto.
# No guarda nada: solo devuelve lo que detectó el OCR.
#
# Recibe FormData:
#   imagen  (archivo, obligatorio)
#   modo    ("auto" | "iso" | "numerico", opcional; por defecto "auto")
# =========================================
@escanear_bp.route("", methods=["POST"])
@escanear_bp.route("/", methods=["POST"])
def escanear():
    print(">>> ENTRE A /api/escanear", flush=True)
    archivo = request.files.get("imagen")
    
    print(">>> ARCHIVO RECIBIDO", archivo.filename if archivo else None, flush=True)

    if archivo is None or not archivo.filename:
        return jsonify({
            "error": "Debes enviar una fotografía en el campo 'imagen'"
        }), 400

    modo = request.form.get("modo", "auto").strip().lower()

    if modo not in MODOS_VALIDOS:
        return jsonify({
            "error": "El modo debe ser 'auto', 'iso' o 'numerico'"
        }), 400

    datos = archivo.read()
    print(">>> BYTES RECIBIDOS:", len(datos), flush=True)

    if not datos:
        return jsonify({"error": "La fotografía está vacía"}), 400

    imagen = cv2.imdecode(np.frombuffer(datos, dtype=np.uint8), cv2.IMREAD_COLOR)

    if imagen is None:
        return jsonify({
            "error": "No se pudo leer la imagen. Usa JPG, PNG o WEBP"
        }), 400

    print(">>> ANTES DE EJECUTAR OCR", flush=True)
    
    try:
        resultado = leer_identificador(
        imagen,
        modo=modo,
        log=print
    )
        print(">>> OCR TERMINADO:", resultado, flush=True)
    except Exception as error:
        print(">>> ERROR DURANTE OCR:", repr(error), flush=True)
        
        return jsonify({
        "error": "Falló el procesamiento de la imagen",
        "detalle": str(error)
    }), 500
    
    if resultado is None:
        return jsonify({
            "encontrado": False,
            "mensaje": "No se encontró un número reconocible. "
                       "Acércate más, de frente y sin reflejos."
        }), 200

    tipo = resultado["tipo"]
    valor = resultado["valor"]
    control_calculado = None
    valor_completo = valor

    if tipo == "iso_sin_control":
        # La foto no mostraba el dígito de control: se calcula.
        control_calculado = calcular_digito_control(valor)
        valor_completo = f"{valor}{control_calculado}"

    return jsonify({
        "encontrado": True,
        "tipo": tipo,
        "valor": valor_completo,
        "control_calculado": control_calculado,
        "confianza": round(float(resultado["confianza"]), 1),
        # iso_invalido y parcial deben revisarse a mano antes de guardar.
        "requiere_revision": tipo not in ("iso_valido", "iso_sin_control", "numerico"),
        "orientacion": resultado.get("orientacion"),
        "metodo": resultado.get("fuente"),
    }), 200