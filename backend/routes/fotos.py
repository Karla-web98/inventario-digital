from pathlib import Path
from uuid import uuid4

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from database import obtener_conexion


fotos_bp = Blueprint(
    "fotos",
    __name__,
    url_prefix="/api/fotos"
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB por fotografía

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# =========================================
# POST /api/fotos/<contenedor_id>
# Subir una fotografía para un contenedor
# =========================================
@fotos_bp.route("/<int:contenedor_id>", methods=["POST"])
def subir_foto(contenedor_id):
    archivo = request.files.get("foto")

    if archivo is None or not archivo.filename:
        return jsonify({
            "error": "Debes seleccionar una fotografía en el campo 'foto'"
        }), 400

    nombre_seguro = secure_filename(archivo.filename)
    extension = Path(nombre_seguro).suffix.lower()

    if extension not in EXTENSIONES_PERMITIDAS:
        return jsonify({
            "error": "Formato no permitido. Usa JPG, JPEG, PNG o WEBP"
        }), 400

    # Comprobar que el contenedor existe antes de guardar el archivo.
    conexion = obtener_conexion()

    try:
        contenedor = conexion.execute(
            "SELECT id FROM Contenedores WHERE id = ?",
            (contenedor_id,)
        ).fetchone()

        if contenedor is None:
            return jsonify({
                "error": "El contenedor no existe"
            }), 404

        # Limitar el tamaño real recibido.
        archivo.seek(0, 2)
        tamano = archivo.tell()
        archivo.seek(0)

        if tamano == 0:
            return jsonify({
                "error": "La fotografía está vacía"
            }), 400

        if tamano > MAX_BYTES:
            return jsonify({
                "error": "La fotografía supera el límite de 10 MB"
            }), 413

        carpeta_contenedor = UPLOADS_DIR / f"contenedor_{contenedor_id}"
        carpeta_contenedor.mkdir(parents=True, exist_ok=True)

        nombre_archivo = f"{uuid4().hex}{extension}"
        ruta_archivo = carpeta_contenedor / nombre_archivo

        archivo.save(str(ruta_archivo))

        ruta_relativa = ruta_archivo.relative_to(BASE_DIR).as_posix()

        try:
            cursor = conexion.execute(
                """
                INSERT INTO Fotos (contenedor_id, ruta_archivo)
                VALUES (?, ?)
                """,
                (contenedor_id, ruta_relativa)
            )
            conexion.commit()

        except Exception:
            conexion.rollback()
            ruta_archivo.unlink(missing_ok=True)
            raise

        return jsonify({
            "mensaje": "Fotografía subida correctamente",
            "foto": {
                "id": cursor.lastrowid,
                "contenedor_id": contenedor_id,
                "ruta_archivo": ruta_relativa,
                "url": f"/api/fotos/archivo/{contenedor_id}/{nombre_archivo}"
            }
        }), 201

    except Exception:
        app_error = {
            "error": "No se pudo guardar la fotografía"
        }
        return jsonify(app_error), 500

    finally:
        conexion.close()


# =========================================
# GET /api/fotos/contenedor/<id>
# Consultar las fotos de un contenedor
# =========================================
@fotos_bp.route("/contenedor/<int:contenedor_id>", methods=["GET"])
def obtener_fotos_contenedor(contenedor_id):
    conexion = obtener_conexion()

    try:
        contenedor = conexion.execute(
            "SELECT id FROM Contenedores WHERE id = ?",
            (contenedor_id,)
        ).fetchone()

        if contenedor is None:
            return jsonify({
                "error": "El contenedor no existe"
            }), 404

        fotos = conexion.execute(
            """
            SELECT id, contenedor_id, ruta_archivo, fecha_subida
            FROM Fotos
            WHERE contenedor_id = ?
            ORDER BY id DESC
            """,
            (contenedor_id,)
        ).fetchall()

        resultado = []

        for foto in fotos:
            item = dict(foto)
            nombre_archivo = Path(item["ruta_archivo"]).name

            item["url"] = (
                f"/api/fotos/archivo/{contenedor_id}/{nombre_archivo}"
            )
            resultado.append(item)

        return jsonify(resultado), 200

    except Exception:
        return jsonify({
            "error": "No se pudieron consultar las fotografías"
        }), 500

    finally:
        conexion.close()


# =========================================
# GET /api/fotos/archivo/<id>/<nombre>
# Visualizar una fotografía
# =========================================
@fotos_bp.route(
    "/archivo/<int:contenedor_id>/<path:nombre_archivo>",
    methods=["GET"]
)
def ver_foto(contenedor_id, nombre_archivo):
    # No permitir rutas de carpetas proporcionadas por el usuario.
    if Path(nombre_archivo).name != nombre_archivo:
        return jsonify({"error": "Nombre de archivo inválido"}), 400

    conexion = obtener_conexion()

    try:
        foto = conexion.execute(
            """
            SELECT ruta_archivo
            FROM Fotos
            WHERE contenedor_id = ?
            """,
            (contenedor_id,)
        ).fetchall()

        ruta_encontrada = next(
            (
                Path(item["ruta_archivo"])
                for item in foto
                if Path(item["ruta_archivo"]).name == nombre_archivo
            ),
            None
        )

        if ruta_encontrada is None:
            return jsonify({
                "error": "La fotografía no está registrada"
            }), 404

        directorio = BASE_DIR / ruta_encontrada.parent

        return send_from_directory(
            str(directorio),
            nombre_archivo
        )

    finally:
        conexion.close()


# =========================================
# DELETE /api/fotos/<foto_id>
# Eliminar una fotografía
# =========================================
@fotos_bp.route("/<int:foto_id>", methods=["DELETE"])
def eliminar_foto(foto_id):
    conexion = obtener_conexion()

    try:
        foto = conexion.execute(
            """
            SELECT id, contenedor_id, ruta_archivo
            FROM Fotos
            WHERE id = ?
            """,
            (foto_id,)
        ).fetchone()

        if foto is None:
            return jsonify({
                "error": "Fotografía no encontrada"
            }), 404

        ruta = BASE_DIR / foto["ruta_archivo"]

        conexion.execute(
            "DELETE FROM Fotos WHERE id = ?",
            (foto_id,)
        )
        conexion.commit()

        # Eliminar el archivo físico si existe.
        try:
            ruta.resolve().relative_to(UPLOADS_DIR.resolve())
        except ValueError:
            return jsonify({
                "mensaje": "Registro eliminado; no se eliminó el archivo externo"
            }), 200

        ruta.unlink(missing_ok=True)

        return jsonify({
            "mensaje": "Fotografía eliminada correctamente"
        }), 200

    except Exception:
        conexion.rollback()
        return jsonify({
            "error": "No se pudo eliminar la fotografía"
        }), 500

    finally:
        conexion.close()