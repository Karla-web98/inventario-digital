from flask import Blueprint, jsonify, request
from database import obtener_conexion


contenedores_bp = Blueprint(
    "contenedores",
    __name__,
    url_prefix="/api/contenedores"
)


# =========================================
# GET /api/contenedores
# Obtener todos los contenedores
# =========================================
@contenedores_bp.route("/", methods=["GET"])
def obtener_contenedores():

    conexion = obtener_conexion()

    try:
        contenedores = conexion.execute("""
            SELECT
                id,
                numero,
                carrier,
                estado,
                ubicacion,
                patio,
                fecha_registro,
                hora_registro,
                operador_id,
                observaciones
            FROM Contenedores
            ORDER BY id DESC
        """).fetchall()

        resultado = [dict(contenedor) for contenedor in contenedores]

        return jsonify(resultado), 200

    except Exception as error:
        return jsonify({
            "error": "No se pudieron obtener los contenedores",
            "detalle": str(error)
        }), 500

    finally:
        conexion.close()


# =========================================
# GET /api/contenedores/<id>
# Obtener un contenedor específico
# =========================================
@contenedores_bp.route("/<int:contenedor_id>", methods=["GET"])
def obtener_contenedor(contenedor_id):

    conexion = obtener_conexion()

    try:
        contenedor = conexion.execute("""
            SELECT
                id,
                numero,
                carrier,
                estado,
                ubicacion,
                patio,
                fecha_registro,
                hora_registro,
                operador_id,
                observaciones
            FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,)).fetchone()

        if contenedor is None:
            return jsonify({
                "error": "Contenedor no encontrado"
            }), 404

        return jsonify(dict(contenedor)), 200

    except Exception as error:
        return jsonify({
            "error": "No se pudo obtener el contenedor",
            "detalle": str(error)
        }), 500

    finally:
        conexion.close()


# =========================================
# POST /api/contenedores
# Crear un contenedor
# =========================================
@contenedores_bp.route("/", methods=["POST"])
def crear_contenedor():

    datos = request.get_json()

    if not datos:
        return jsonify({
            "error": "No se recibieron datos"
        }), 400

    numero = datos.get("numero")
    carrier = datos.get("carrier")
    estado = datos.get("estado")
    ubicacion = datos.get("ubicacion")
    patio = datos.get("patio")
    operador_id = datos.get("operador_id")
    observaciones = datos.get("observaciones")

    # =========================================
    # Validar número / CAJA
    # =========================================
    if not numero:
        return jsonify({
            "error": "El número del contenedor es obligatorio"
        }), 400

    numero = numero.strip().upper()

    # =========================================
    # Normalizar campos opcionales
    # =========================================
    carrier = carrier.strip() if carrier else None
    estado = estado.strip() if estado else "registrado"
    ubicacion = ubicacion.strip() if ubicacion else None
    patio = patio.strip() if patio else None
    observaciones = observaciones.strip() if observaciones else None

    conexion = obtener_conexion()

    try:

        # =========================================
        # Verificar si ya existe
        # =========================================
        existente = conexion.execute("""
            SELECT id
            FROM Contenedores
            WHERE numero = ?
        """, (numero,)).fetchone()

        if existente:
            return jsonify({
                "error": "El contenedor ya existe",
                "id": existente["id"]
            }), 409

        # =========================================
        # Crear contenedor
        # =========================================
        cursor = conexion.execute("""
            INSERT INTO Contenedores (
                numero,
                carrier,
                estado,
                ubicacion,
                patio,
                operador_id,
                observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            numero,
            carrier,
            estado,
            ubicacion,
            patio,
            operador_id,
            observaciones
        ))

        conexion.commit()

        contenedor_id = cursor.lastrowid

        # =========================================
        # Obtener registro creado
        # =========================================
        contenedor = conexion.execute("""
            SELECT
                id,
                numero,
                carrier,
                estado,
                ubicacion,
                patio,
                fecha_registro,
                hora_registro,
                operador_id,
                observaciones
            FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,)).fetchone()

        return jsonify(dict(contenedor)), 201

    except Exception as error:

        conexion.rollback()

        return jsonify({
            "error": "No se pudo crear el contenedor",
            "detalle": str(error)
        }), 500

    finally:
        conexion.close()


# =========================================
# PUT /api/contenedores/<id>
# Actualizar un contenedor
# =========================================
@contenedores_bp.route("/<int:contenedor_id>", methods=["PUT"])
def actualizar_contenedor(contenedor_id):

    datos = request.get_json()

    if not datos:
        return jsonify({
            "error": "No se recibieron datos"
        }), 400

    conexion = obtener_conexion()

    try:

        # =========================================
        # Verificar que exista
        # =========================================
        existente = conexion.execute("""
            SELECT id
            FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,)).fetchone()

        if existente is None:
            return jsonify({
                "error": "Contenedor no encontrado"
            }), 404

        numero = datos.get("numero")
        carrier = datos.get("carrier")
        estado = datos.get("estado")
        ubicacion = datos.get("ubicacion")
        patio = datos.get("patio")
        operador_id = datos.get("operador_id")
        observaciones = datos.get("observaciones")

        if not numero:
            return jsonify({
                "error": "El número del contenedor es obligatorio"
            }), 400

        numero = numero.strip().upper()

        carrier = carrier.strip() if carrier else None
        estado = estado.strip() if estado else "registrado"
        ubicacion = ubicacion.strip() if ubicacion else None
        patio = patio.strip() if patio else None
        observaciones = observaciones.strip() if observaciones else None

        # =========================================
        # Evitar número duplicado
        # =========================================
        duplicado = conexion.execute("""
            SELECT id
            FROM Contenedores
            WHERE numero = ?
            AND id != ?
        """, (numero, contenedor_id)).fetchone()

        if duplicado:
            return jsonify({
                "error": "Ya existe otro contenedor con ese número",
                "id": duplicado["id"]
            }), 409

        # =========================================
        # Actualizar
        # =========================================
        conexion.execute("""
            UPDATE Contenedores
            SET
                numero = ?,
                carrier = ?,
                estado = ?,
                ubicacion = ?,
                patio = ?,
                operador_id = ?,
                observaciones = ?
            WHERE id = ?
        """, (
            numero,
            carrier,
            estado,
            ubicacion,
            patio,
            operador_id,
            observaciones,
            contenedor_id
        ))

        conexion.commit()

        # =========================================
        # Obtener registro actualizado
        # =========================================
        contenedor = conexion.execute("""
            SELECT
                id,
                numero,
                carrier,
                estado,
                ubicacion,
                patio,
                fecha_registro,
                hora_registro,
                operador_id,
                observaciones
            FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,)).fetchone()

        return jsonify(dict(contenedor)), 200

    except Exception as error:

        conexion.rollback()

        return jsonify({
            "error": "No se pudo actualizar el contenedor",
            "detalle": str(error)
        }), 500

    finally:
        conexion.close()


# =========================================
# DELETE /api/contenedores/<id>
# Eliminar un contenedor
# =========================================
@contenedores_bp.route("/<int:contenedor_id>", methods=["DELETE"])
def eliminar_contenedor(contenedor_id):

    conexion = obtener_conexion()

    try:

        contenedor = conexion.execute("""
            SELECT id
            FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,)).fetchone()

        if contenedor is None:
            return jsonify({
                "error": "Contenedor no encontrado"
            }), 404

        conexion.execute("""
            DELETE FROM Contenedores
            WHERE id = ?
        """, (contenedor_id,))

        conexion.commit()

        return jsonify({
            "mensaje": "Contenedor eliminado correctamente"
        }), 200

    except Exception as error:

        conexion.rollback()

        return jsonify({
            "error": "No se pudo eliminar el contenedor",
            "detalle": str(error)
        }), 500

    finally:
        conexion.close()