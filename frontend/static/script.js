
"use strict";

// =====================================================
// 1. ELEMENTOS Y ESTADO GLOBAL
// =====================================================

const $ = (selector, contexto = document) =>
    contexto.querySelector(selector);

const $$ = (selector, contexto = document) =>
    [...contexto.querySelectorAll(selector)];

// Cámara y OCR
const scanForm = $("#scanForm");
const scanButton = $("#scanButton");

const cameraVideo = $("#cameraVideo");
const cameraCanvas = $("#cameraCanvas");
const cameraPlaceholder = $("#cameraPlaceholder");
const cameraStatus = $("#cameraStatus");

const startCameraButton = $("#startCameraButton");
const stopCameraButton = $("#stopCameraButton");
const cameraScanMode = $("#cameraScanMode");

// Inventario
const containerForm = $("#containerForm");
const containerNumber = $("#containerNumber");
const containersList = $("#containersList");

// Fotografías del administrador
const photosSection = $("#photosSection");
const adminPhotoForm = $("#legacyPhotoForm");
const adminPhotoInput = $("#adminPhotoInput");
const adminPhotosList = $("#adminPhotosList");

// Fotografías del operador
const operatorPhotoForm = $("#photoForm");
const operatorPhotoInput = $("#photoInput");

// Login
const roleSelector = $("#roleSelector");
const loginForm = $("#loginForm");
const loginPassword = $("#loginPassword");
const togglePassword = $("#togglePassword");

// Estado general
let rolTemporal = null;
let contenedores = [];
let contenedorSeleccionado = null;
let ultimoResultadoOCR = null;

let analisisEnCurso = false;
let avisoLentoMostrado = false;
let temporizadorAvisoOCR = null;

let tipoEvidencia = "contenedor";
let pasoOperador = "contenedor";
let fotosTemporales = [];

const fotosTemporalesURLs = new Map();

let selloRegistradoTemporalmente = false;
let ubicacionTemporal = "";
let observacionesTemporales = "";

// Estado de la cámara
let cameraStream = null;
let camaraActiva = false;
let escaneoAutomatico = true;
let temporizadorCamara = null;
let solicitudOCRActiva = false;
let generacionCamara = 0;

// Configuración
const LIMITE_IMAGEN = 10 * 1024 * 1024;
const TIEMPO_AVISO_OCR = 12000;
const MAX_FOTOS_CONTENEDOR = 5;

const INTERVALO_ESCANEO_AUTOMATICO = 1800;
const ANCHO_MAXIMO_CAMARA = 1280;
const CALIDAD_IMAGEN_CAMARA = 0.85;

// =====================================================
// 2. UTILIDADES
// =====================================================

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function mostrarMensaje(selector, texto, tipo = "info") {
    const elemento = $(selector);

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = `message ${tipo}`;
}

function ocultarMensaje(selector) {
    const elemento = $(selector);

    if (!elemento) return;

    elemento.textContent = "";
    elemento.className = "message hidden";
}

async function peticion(url, opciones = {}) {
    const respuesta = await fetch(url, opciones);

    const contenido = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(
            contenido.message ||
            contenido.mensaje ||
            contenido.error ||
            `Error del servidor (${respuesta.status})`
        );
    }

    return contenido;
}

function formatearFecha(fecha) {
    if (!fecha) return "Fecha no disponible";

    const valor = String(fecha);

    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [anio, mes, dia] = valor.split("-");
        return `${dia}/${mes}/${anio}`;
    }

    const fechaObjeto = new Date(valor);

    if (Number.isNaN(fechaObjeto.getTime())) {
        return valor;
    }

    return fechaObjeto.toLocaleDateString("es-MX");
}

function formatearHora(hora) {
    if (!hora) return "";

    const valor = String(hora);

    return valor.length >= 5 ? valor.slice(0, 5) : valor;
}

function fechaHoraActual() {
    const ahora = new Date();

    return {
        fecha: ahora.toLocaleDateString("es-MX"),
        hora: ahora.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit"
        })
    };
}

function esImagenValida(archivo) {
    if (!archivo) {
        return "Selecciona una fotografía.";
    }

    const extensiones = /\.(jpg|jpeg|png|webp)$/i;

    const tiposValidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        !tiposValidos.includes(archivo.type) &&
        !extensiones.test(archivo.name)
    ) {
        return "Selecciona una imagen JPG, PNG o WEBP.";
    }

    if (archivo.size === 0) {
        return "La imagen está vacía.";
    }

    if (archivo.size > LIMITE_IMAGEN) {
        return "La imagen supera el límite de 10 MB.";
    }

    return null;
}

function limpiarVistaPrevia() {
    ultimoResultadoOCR = null;

    $("#scanResult")?.classList.add("hidden");

    mostrarEstadoVacio(
        "Aún no hay resultados",
        "El identificador aparecerá aquí después del análisis."
    );

    ocultarMensaje("#scanMessage");
}

function mostrarEstadoVacio(
    titulo,
    descripcion,
    permitirReintento = false
) {
    $("#scanResult")?.classList.add("hidden");
    $("#emptyResult")?.classList.remove("hidden");

    const tituloElemento = $("#emptyResultTitle");
    const descripcionElemento = $("#emptyResultDescription");

    if (tituloElemento) {
        tituloElemento.textContent = titulo;
    }

    if (descripcionElemento) {
        descripcionElemento.textContent = descripcion;
    }

    $("#retryScan")?.classList.toggle(
        "hidden",
        !permitirReintento
    );
}

function obtenerNumeroContenedor() {
    return (
        containerNumber?.value ||
        $("#adminContainerNumber")?.value ||
        ""
    ).trim().toUpperCase();
}

function actualizarTexto(selector, valor) {
    const elemento = $(selector);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function mostrarSeccion(seccion) {
    const destino = typeof seccion === "string"
        ? document.getElementById(seccion)
        : seccion;

    if (!destino) return;

    destino.classList.remove("hidden");

    destino.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function liberarFotosTemporales() {
    fotosTemporalesURLs.forEach((url) => {
        URL.revokeObjectURL(url);
    });

    fotosTemporalesURLs.clear();
    fotosTemporales = [];

    renderizarFotosTemporales();
    actualizarResumenOperador();
}

// =====================================================
// 3. LOGIN Y PERFILES DE DEMOSTRACIÓN
// =====================================================

togglePassword?.addEventListener("click", () => {
    if (!loginPassword) return;

    const mostrar = loginPassword.type === "password";

    loginPassword.type = mostrar ? "text" : "password";

    togglePassword.textContent = mostrar
        ? "Ocultar"
        : "Ver";

    togglePassword.setAttribute(
        "aria-label",
        mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
    );
});

// Este acceso es únicamente de demostración.
// No valida usuarios ni contraseñas contra el backend.
loginForm?.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const campos = $$("input", loginForm).filter((campo) =>
        campo.type !== "password" &&
        campo.type !== "checkbox" &&
        campo.value.trim()
    );

    const identificador = campos
        .map((campo) => campo.value.trim().toLowerCase())
        .join(" ");

    if (!identificador) {
        mostrarMensaje(
            "#loginMessage",
            "Escribe tu correo o usuario para continuar.",
            "error"
        );

        return;
    }

    const rol = identificador.includes("admin")
        ? "administrador"
        : "operador";

    aplicarPerfil(rol);
});

function aplicarPerfil(rol) {
    if (!["operador", "administrador"].includes(rol)) {
        return;
    }

    if (window.AppState) {
        const rolValido = window.AppState.establecerRol(rol);

        if (!rolValido) return;
    } else {
        document.body.dataset.role = rol;
    }

    rolTemporal = rol;

    try {
        sessionStorage.setItem(
            "inventarioPerfilTemporal",
            rol
        );
    } catch {
        // La aplicación puede continuar sin sessionStorage.
    }

    roleSelector?.classList.add("hidden");

    loginForm?.reset();
    ocultarMensaje("#loginMessage");

    const esAdmin = rol === "administrador";

    actualizarTexto(
        "#currentRoleIcon",
        esAdmin ? "▦" : "📷"
    );

    actualizarTexto(
        "#currentRoleLabel",
        esAdmin ? "Administrador" : "Operador"
    );

    actualizarTexto(
        "#welcomeEyebrow",
        esAdmin ? "PANEL DE ADMINISTRACIÓN" : "MODO OPERADOR"
    );

    actualizarTexto(
        "#welcomeTitle",
        esAdmin ? "Bienvenida al panel" : "Hola, operadora"
    );

    actualizarTexto(
        "#welcomeDescription",
        esAdmin
            ? "Consulta el inventario y revisa los registros."
            : "Identifica un contenedor y documenta su evidencia."
    );

    actualizarTexto(
        "#inventoryHeadingTitle",
        esAdmin
            ? "Administrar inventario"
            : "Consultar inventario"
    );

    actualizarTexto(
        "#inventoryHeadingDescription",
        esAdmin
            ? "Consulta los registros y sus fotografías."
            : "Consulta los contenedores disponibles."
    );

    $$(".admin-only").forEach((elemento) => {
        elemento.classList.toggle("hidden", !esAdmin);
    });

    $$(".operator-only").forEach((elemento) => {
        elemento.classList.toggle("hidden", esAdmin);
    });

    $("#operatorFlowSection")?.classList.add("hidden");
    $("#operatorHistorySection")?.classList.add("hidden");
    $("#photosSection")?.classList.add("hidden");

    if (esAdmin) {
        cambiarVista("inventario");
    } else {
        cambiarVista("dashboard_operador");
    }

    renderizarContenedores();
    actualizarResumenOperador();
}

function mostrarSelectorPerfil() {
    detenerCamara();

    rolTemporal = null;

    try {
        sessionStorage.removeItem("inventarioPerfilTemporal");
    } catch {
        // No se requiere ninguna acción.
    }

    if (window.AppState) {
        window.AppState.limpiarRol();
    } else {
        document.body.removeAttribute("data-role");
        document.body.removeAttribute("data-view");
    }

    $$(".admin-only").forEach((elemento) => {
        elemento.classList.add("hidden");
    });

    $$(".operator-only").forEach((elemento) => {
        elemento.classList.add("hidden");
    });

    ocultarTodasLasVistasRouter();

    photosSection?.classList.add("hidden");

    roleSelector?.classList.remove("hidden");

    loginForm?.reset();
    ocultarMensaje("#loginMessage");

    if (loginPassword) {
        loginPassword.type = "password";
    }

    if (togglePassword) {
        togglePassword.textContent = "Ver";

        togglePassword.setAttribute(
            "aria-label",
            "Mostrar contraseña"
        );
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

roleSelector?.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-select-role]");

    if (!boton) return;

    aplicarPerfil(boton.dataset.selectRole);
});

$("#changeRoleButton")?.addEventListener(
    "click",
    mostrarSelectorPerfil
);

// =====================================================
// 4. NAVEGACIÓN
// =====================================================

function ocultarTodasLasVistasRouter() {
    const ids = [
        "operatorHomeSection",
        "operatorFlowSection",
        "operatorHistorySection",
        "statsSection",
        "inventoryHeading",
        "adminInventoryWorkspace",
        "photosSection"
    ];

    ids.forEach((id) => {
        document.getElementById(id)?.classList.add("hidden");
    });
}

$$("[data-scroll-to]").forEach((boton) => {
    boton.addEventListener("click", () => {
        const destino = document.getElementById(
            boton.dataset.scrollTo
        );

        if (!destino) return;

        mostrarSeccion(destino);

        $$(".quick-nav-link").forEach((enlace) => {
            enlace.classList.toggle("active", enlace === boton);
        });
    });
});

$("#startContainerButton")?.addEventListener("click", () => {
    iniciarFlujoOperador();
});

$("#openOperatorHistoryButton")?.addEventListener("click", () => {
    mostrarHistorialOperador();
});

$("#backToOperatorHome")?.addEventListener("click", () => {
    if (rolTemporal !== "operador") return;

    cambiarVista("dashboard_operador");
});

$("#backToContainer")?.addEventListener("click", () => {
    cambiarPasoOperador("contenedor");
});

$("#continueToEvidence")?.addEventListener("click", (evento) => {
    evento.preventDefault();

    if (validarDatosContenedor()) {
        guardarDatosTemporalesContenedor();
        cambiarPasoOperador("evidencia");
    }
});

$("#continueToConfirmation")?.addEventListener(
    "click",
    (evento) => {
        evento.preventDefault();

        if (validarEvidenciaOperador()) {
            prepararConfirmacion();
            cambiarPasoOperador("confirmacion");
        }
    }
);

$("#backToEvidence")?.addEventListener("click", () => {
    cambiarPasoOperador("evidencia");
});

$("#confirmRegistration")?.addEventListener("click", async () => {
    await confirmarRegistroOperador();
});

$("#captureSealButton")?.addEventListener("click", () => {
    mostrarMensaje(
        "#photoMessage",
        "La captura de sellos requiere un endpoint específico en el backend. No se ha guardado ninguna foto de sello.",
        "info"
    );
});

// =====================================================
// 5. FLUJO DEL OPERADOR
// =====================================================

function iniciarFlujoOperador() {
    if (rolTemporal !== "operador") return;

    detenerCamara();

    pasoOperador = "contenedor";

    liberarFotosTemporales();

    selloRegistradoTemporalmente = false;
    ubicacionTemporal = "";
    observacionesTemporales = "";

    containerForm?.reset();

    if (containerNumber) {
        containerNumber.value = "";
    }

    limpiarVistaPrevia();

    ultimoResultadoOCR = null;

    ocultarMensaje("#containerMessage");
    ocultarMensaje("#photoMessage");
    ocultarMensaje("#scanMessage");

    cambiarVista("registro");
    cambiarPasoOperador("contenedor");
}

function cambiarPasoOperador(paso) {
    const pasosValidos = [
        "contenedor",
        "evidencia",
        "confirmacion"
    ];

    if (!pasosValidos.includes(paso)) return;

    pasoOperador = paso;

    const mapa = {
        contenedor: "containerStep",
        evidencia: "evidenceStep",
        confirmacion: "confirmationStep"
    };

    Object.entries(mapa).forEach(([nombre, id]) => {
        document.getElementById(id)?.classList.toggle(
            "hidden",
            nombre !== paso
        );
    });

    $$("[data-flow-step]").forEach((boton) => {
        const nombre = boton.dataset.flowStep;

        const indiceActual = pasosValidos.indexOf(paso);
        const indiceBoton = pasosValidos.indexOf(nombre);

        boton.classList.toggle("active", nombre === paso);

        boton.classList.toggle(
            "completed",
            indiceBoton < indiceActual
        );

        boton.classList.toggle(
            "pending",
            indiceBoton > indiceActual
        );

        boton.setAttribute(
            "aria-current",
            nombre === paso ? "step" : "false"
        );
    });

    actualizarResumenOperador();
}

function validarDatosContenedor() {
    const numero = obtenerNumeroContenedor();

    const ubicacion = (
        $("#containerLocation")?.value || ""
    ).trim();

    if (!numero) {
        mostrarMensaje(
            "#containerMessage",
            "Escanea o escribe el identificador del contenedor.",
            "error"
        );

        containerNumber?.focus();

        return false;
    }

    if (!ubicacion) {
        mostrarMensaje(
            "#containerMessage",
            "La ubicación es obligatoria para continuar.",
            "error"
        );

        $("#containerLocation")?.focus();

        return false;
    }

    ocultarMensaje("#containerMessage");

    return true;
}

function guardarDatosTemporalesContenedor() {
    ubicacionTemporal = (
        $("#containerLocation")?.value || ""
    ).trim();

    observacionesTemporales = (
        $("#containerObservations")?.value || ""
    ).trim();

    actualizarTexto(
        "#confirmationContainerNumber",
        obtenerNumeroContenedor()
    );

    actualizarTexto(
        "#confirmationLocation",
        ubicacionTemporal
    );

    actualizarTexto(
        "#confirmationObservations",
        observacionesTemporales || "Sin observaciones"
    );
}

function validarEvidenciaOperador() {
    if (fotosTemporales.length < 1) {
        mostrarMensaje(
            "#photoMessage",
            "Agrega al menos una fotografía del contenedor.",
            "error"
        );

        return false;
    }

    ocultarMensaje("#photoMessage");

    return true;
}

function prepararConfirmacion() {
    guardarDatosTemporalesContenedor();

    actualizarTexto(
        "#confirmationPhotoCount",
        String(fotosTemporales.length)
    );

    actualizarTexto(
        "#confirmationSealStatus",
        selloRegistradoTemporalmente
            ? "Registrado en esta sesión de prueba"
            : "Pendiente de integración"
    );

    const actual = fechaHoraActual();

    actualizarTexto(
        "#confirmationDateTime",
        `${actual.fecha} · ${actual.hora}`
    );

    actualizarTexto(
        "#confirmationStatus",
        "Listo para registrar"
    );
}

async function confirmarRegistroOperador() {
    if (rolTemporal !== "operador") return;

    if (!validarDatosContenedor()) {
        cambiarPasoOperador("contenedor");
        return;
    }

    if (!validarEvidenciaOperador()) {
        cambiarPasoOperador("evidencia");
        return;
    }

    const numero = obtenerNumeroContenedor();
    const boton = $("#confirmRegistration");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Registrando...";
    }

    try {
        const nuevo = await peticion("/api/contenedores/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ numero })
        });

        const idNuevo = nuevo.id;

        if (!idNuevo) {
            throw new Error(
                "El servidor respondió sin ID de contenedor. Revisa el inventario antes de volver a intentarlo."
            );
        }

        for (const archivo of fotosTemporales) {
            const datos = new FormData();

            datos.append("foto", archivo);

            await peticion(`/api/fotos/${idNuevo}`, {
                method: "POST",
                body: datos
            });
        }

        actualizarTexto(
            "#confirmationStatus",
            "Registro completado"
        );

        mostrarMensaje(
            "#operatorHomeMessage",
            `Registro completado: ${nuevo.numero || numero}.`,
            "success"
        );

        await cargarContenedores();

        liberarFotosTemporales();

        cambiarVista("dashboard_operador");

    } catch (error) {
        mostrarMensaje(
            "#containerMessage",
            `No se pudo completar el registro: ${error.message}`,
            "error"
        );

        actualizarTexto(
            "#confirmationStatus",
            "Registro incompleto"
        );

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Confirmar registro";
        }
    }
}

// =====================================================
// 6. HISTORIAL DEL OPERADOR
// =====================================================

function mostrarHistorialOperador() {
    if (rolTemporal !== "operador") return;

    if (!$("#operatorHistorySection")) {
        console.warn(
            "No existe la sección de historial del operador."
        );

        return;
    }

    if (!cambiarVista("historial_operador")) {
        return;
    }

    renderizarHistorialOperador();
}

function renderizarHistorialOperador() {
    const lista =
        $("#operatorHistoryList") ||
        $("#historyList");

    if (!lista) return;

    if (!contenedores.length) {
        lista.innerHTML = `
            <div class="empty-list">
                Todavía no hay registros para consultar.
            </div>
        `;

        return;
    }

    lista.innerHTML = [...contenedores]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((contenedor) => `
            <article class="container-item">
                <div class="container-info">
                    <strong>${escaparHTML(contenedor.numero)}</strong>

                    <span>
                        ${escaparHTML(
                            formatearFecha(contenedor.fecha_registro)
                        )}

                        ${contenedor.hora_registro
                            ? ` · ${escaparHTML(
                                formatearHora(contenedor.hora_registro)
                            )}`
                            : ""}
                    </span>

                    ${contenedor.observaciones
                        ? `<small>${escaparHTML(
                            contenedor.observaciones
                        )}</small>`
                        : ""}
                </div>

                <div class="container-actions">
                    <button
                        class="button secondary"
                        type="button"
                        data-action="photos"
                        data-id="${Number(contenedor.id)}">
                        Ver evidencia
                    </button>
                </div>
            </article>
        `).join("");
}

// =====================================================
// 7. ESTADO DEL SISTEMA
// =====================================================

async function comprobarEstado() {
    const punto = $(".status-dot");

    try {
        await peticion("/api/estado");

        actualizarTexto(
            "#connectionStatus",
            "Sistema conectado"
        );

        actualizarTexto("#systemStatus", "Disponible");

        if (punto) {
            punto.className = "status-dot online";
        }

    } catch {
        actualizarTexto(
            "#connectionStatus",
            "Sin conexión"
        );

        actualizarTexto(
            "#systemStatus",
            "Sin conexión"
        );

        if (punto) {
            punto.className = "status-dot offline";
        }
    }
}

// =====================================================
// 8. INDICADOR DE OCR
// =====================================================

function iniciarIndicadorOCR() {
    analisisEnCurso = true;
    avisoLentoMostrado = false;

    $("#scanProgress")?.classList.remove("hidden");

    actualizarTexto(
        "#progressTitle",
        "Analizando imagen de la cámara..."
    );

    actualizarTexto(
        "#progressDescription",
        "Estamos identificando el contenedor."
    );

    if (scanButton) {
        scanButton.disabled = true;

        scanButton.innerHTML =
            '<span class="spinner spinner-button" aria-hidden="true"></span> Analizando...';
    }

    temporizadorAvisoOCR = window.setTimeout(() => {
        if (!analisisEnCurso) return;

        avisoLentoMostrado = true;

        actualizarTexto(
            "#progressTitle",
            "El análisis está tardando más de lo esperado"
        );

        actualizarTexto(
            "#progressDescription",
            "El reconocimiento continúa. Espera la respuesta."
        );

        mostrarMensaje(
            "#scanMessage",
            "El OCR lleva más de 12 segundos. El análisis continúa.",
            "info"
        );
    }, TIEMPO_AVISO_OCR);
}

function finalizarIndicadorOCR() {
    analisisEnCurso = false;

    if (temporizadorAvisoOCR !== null) {
        clearTimeout(temporizadorAvisoOCR);
        temporizadorAvisoOCR = null;
    }

    $("#scanProgress")?.classList.add("hidden");

    if (scanButton) {
        scanButton.disabled = false;
        scanButton.innerHTML = "Analizar fotograma";
    }
}

// =====================================================
// 9. CÁMARA Y ESCANEO OCR EN TIEMPO REAL
// =====================================================

// -----------------------------------------------------
// 9.1. Estado visual de la cámara
// -----------------------------------------------------

function actualizarEstadoCamara(texto, tipo = "info") {
    if (!cameraStatus) return;

    cameraStatus.textContent = texto;
    cameraStatus.className = `camera-status ${tipo}`;
}

function actualizarControlesCamara() {
    startCameraButton?.classList.toggle(
        "hidden",
        camaraActiva
    );

    stopCameraButton?.classList.toggle(
        "hidden",
        !camaraActiva
    );

    cameraPlaceholder?.classList.toggle(
        "hidden",
        camaraActiva
    );

    cameraVideo?.classList.toggle(
        "hidden",
        !camaraActiva
    );

    if (scanButton) {
        scanButton.classList.toggle(
            "hidden",
            !camaraActiva || escaneoAutomatico
        );
    }
}

// -----------------------------------------------------
// 9.2. Iniciar cámara
// -----------------------------------------------------

async function iniciarCamara() {
    if (camaraActiva || cameraStream) return;

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        actualizarEstadoCamara(
            "Tu navegador no permite acceder a la cámara.",
            "error"
        );

        mostrarMensaje(
            "#scanMessage",
            "Utiliza Chrome o Edge desde localhost o HTTPS para acceder a la cámara.",
            "error"
        );

        return;
    }

    try {
        actualizarEstadoCamara(
            "Solicitando permiso para acceder a la cámara...",
            "info"
        );

        if (startCameraButton) {
            startCameraButton.disabled = true;
        }

        const generacionInicio = generacionCamara;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        // Si se canceló el inicio mientras el navegador
        // solicitaba permisos, no conservar el stream.
        if (generacionInicio !== generacionCamara) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }

        cameraStream = stream;

        if (!cameraVideo) {
            throw new Error("No se encontró el elemento de video.");
        }

        cameraVideo.srcObject = stream;

        await cameraVideo.play();

        camaraActiva = true;

        actualizarControlesCamara();

        actualizarEstadoCamara(
            "Cámara activa. Enfoca el identificador del contenedor.",
            "success"
        );

        ocultarMensaje("#scanMessage");

        if (escaneoAutomatico) {
            programarEscaneoAutomatico(500);
        }

    } catch (error) {
        console.error("Error al iniciar la cámara:", error);

        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            cameraStream = null;
        }

        camaraActiva = false;

        actualizarControlesCamara();

        actualizarEstadoCamara(
            error.name === "NotAllowedError"
                ? "Permiso de cámara denegado."
                : "No se pudo iniciar la cámara.",
            "error"
        );

        mostrarMensaje(
            "#scanMessage",
            error.name === "NotAllowedError"
                ? "Debes permitir el acceso a la cámara desde tu navegador."
                : "No fue posible activar la cámara. Comprueba que esté conectada y disponible.",
            "error"
        );

    } finally {
        if (startCameraButton) {
            startCameraButton.disabled = false;
        }
    }
}

// -----------------------------------------------------
// 9.3. Detener cámara
// -----------------------------------------------------

function detenerCamara() {
    generacionCamara++;

    camaraActiva = false;

    if (temporizadorCamara !== null) {
        clearTimeout(temporizadorCamara);
        temporizadorCamara = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => {
            track.stop();
        });

        cameraStream = null;
    }

    if (cameraVideo) {
        cameraVideo.pause();
        cameraVideo.srcObject = null;
    }

    actualizarControlesCamara();

    actualizarEstadoCamara(
        "Cámara detenida.",
        "info"
    );

    if (!solicitudOCRActiva) {
        finalizarIndicadorOCR();
    }
}

// -----------------------------------------------------
// 9.4. Capturar fotograma
// -----------------------------------------------------

function capturarFotograma() {
    if (!camaraActiva || !cameraVideo || !cameraCanvas) {
        throw new Error("La cámara no está activa.");
    }

    if (
        cameraVideo.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
        throw new Error(
            "La cámara todavía no está lista. Espera un momento."
        );
    }

    const anchoOriginal = cameraVideo.videoWidth;
    const altoOriginal = cameraVideo.videoHeight;

    if (!anchoOriginal || !altoOriginal) {
        throw new Error(
            "No se pudo obtener la imagen de la cámara."
        );
    }

    const escala = Math.min(
        1,
        ANCHO_MAXIMO_CAMARA / anchoOriginal
    );

    const ancho = Math.round(anchoOriginal * escala);
    const alto = Math.round(altoOriginal * escala);

    cameraCanvas.width = ancho;
    cameraCanvas.height = alto;

    const contexto = cameraCanvas.getContext("2d");

    if (!contexto) {
        throw new Error(
            "No se pudo preparar la imagen para el OCR."
        );
    }

    contexto.drawImage(
        cameraVideo,
        0,
        0,
        ancho,
        alto
    );

    return new Promise((resolve, reject) => {
        cameraCanvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error(
                            "No se pudo capturar el fotograma."
                        )
                    );

                    return;
                }

                resolve(blob);
            },
            "image/jpeg",
            CALIDAD_IMAGEN_CAMARA
        );
    });
}

// -----------------------------------------------------
// 9.5. Enviar imagen al backend OCR
// -----------------------------------------------------

async function analizarFotograma(origen = "manual") {
    if (!camaraActiva || solicitudOCRActiva) return;

    const generacionActual = generacionCamara;

    solicitudOCRActiva = true;

    ocultarMensaje("#scanMessage");

    if (origen === "manual") {
        iniciarIndicadorOCR();
    } else {
        actualizarEstadoCamara(
            "Detectando identificador...",
            "info"
        );
    }

    try {
        const imagen = await capturarFotograma();

        const datos = new FormData();

        datos.append(
            "imagen",
            imagen,
            "captura-camara.jpg"
        );

        // Modo de reconocimiento del backend.
        // Si no existe el selector, se utiliza auto.
        const modoSeleccionado =
            $("#scanMode")?.value || "auto";

        const modo = modoSeleccionado === "automatico"
            ? "auto"
            : modoSeleccionado;

        datos.append("modo", modo);

        const resultado = await peticion(
            "/api/escanear",
            {
                method: "POST",
                body: datos
            }
        );

        // Ignorar respuestas de una cámara que ya se detuvo
        // o que se reinició mientras el OCR trabajaba.
        if (
            generacionActual !== generacionCamara ||
            !camaraActiva
        ) {
            return;
        }

        if (!resultado.encontrado) {
            if (origen === "manual") {
                ultimoResultadoOCR = null;

                mostrarEstadoVacio(
                    "No pudimos identificar el contenedor",
                    resultado.mensaje ||
                    "Acércate al identificador, evita reflejos y vuelve a intentarlo.",
                    true
                );

                mostrarMensaje(
                    "#scanMessage",
                    "No se detectó un identificador.",
                    "error"
                );
            } else {
                actualizarEstadoCamara(
                    "Buscando identificador...",
                    "info"
                );
            }

            return;
        }

        ultimoResultadoOCR = resultado;

        mostrarResultadoOCR(resultado);

        actualizarEstadoCamara(
            `Identificador detectado: ${resultado.valor}`,
            "success"
        );

        mostrarMensaje(
            "#scanMessage",
            resultado.requiere_revision
                ? "Identificador detectado. Revisa el resultado antes de utilizarlo."
                : "Identificador reconocido correctamente.",
            resultado.requiere_revision
                ? "info"
                : "success"
        );

    } catch (error) {
        console.error("Error durante el OCR:", error);

        if (generacionActual !== generacionCamara) {
            return;
        }

        if (origen === "manual") {
            mostrarEstadoVacio(
                "No se pudo completar el análisis",
                "Verifica la conexión con Flask e inténtalo nuevamente.",
                true
            );

            mostrarMensaje(
                "#scanMessage",
                error.message || "No se pudo procesar la imagen.",
                "error"
            );
        }

        actualizarEstadoCamara(
            "Error durante el reconocimiento.",
            "error"
        );

    } finally {
        solicitudOCRActiva = false;

        if (origen === "manual") {
            finalizarIndicadorOCR();
        }
    }
}

// -----------------------------------------------------
// 9.6. Mostrar resultado del OCR
// -----------------------------------------------------

function mostrarResultadoOCR(resultado) {
    $("#emptyResult")?.classList.add("hidden");
    $("#scanResult")?.classList.remove("hidden");

    actualizarTexto(
        "#resultValue",
        resultado.valor || "—"
    );

    actualizarTexto(
        "#resultType",
        resultado.tipo || "No especificado"
    );

    actualizarTexto(
        "#resultConfidence",
        resultado.confianza != null
            ? `${resultado.confianza}%`
            : "No disponible"
    );

    actualizarTexto(
        "#resultOrientation",
        resultado.orientacion || "No disponible"
    );

    actualizarTexto(
        "#resultMethod",
        resultado.metodo || "No especificado"
    );

    $("#reviewNotice")?.classList.toggle(
        "hidden",
        !resultado.requiere_revision
    );

    // El resultado se coloca en los formularios,
    // pero el usuario todavía puede corregirlo.
    if (containerNumber) {
        containerNumber.value = resultado.valor || "";
    }

    const adminNumber = $("#adminContainerNumber");

    if (adminNumber) {
        adminNumber.value = resultado.valor || "";
    }
}

// -----------------------------------------------------
// 9.7. Escaneo automático continuo
// -----------------------------------------------------

function programarEscaneoAutomatico(
    espera = INTERVALO_ESCANEO_AUTOMATICO
) {
    if (
        !camaraActiva ||
        !escaneoAutomatico ||
        temporizadorCamara !== null
    ) {
        return;
    }

    temporizadorCamara = window.setTimeout(async () => {
        temporizadorCamara = null;

        if (
            !camaraActiva ||
            !escaneoAutomatico ||
            solicitudOCRActiva
        ) {
            return;
        }

        await analizarFotograma("automatico");

        if (camaraActiva && escaneoAutomatico) {
            programarEscaneoAutomatico(
                INTERVALO_ESCANEO_AUTOMATICO
            );
        }

    }, espera);
}

// -----------------------------------------------------
// 9.8. Cambiar entre modo automático y manual
// -----------------------------------------------------

cameraScanMode?.addEventListener("change", () => {
    escaneoAutomatico =
        cameraScanMode.value === "auto";

    if (temporizadorCamara !== null) {
        clearTimeout(temporizadorCamara);
        temporizadorCamara = null;
    }

    actualizarControlesCamara();

    if (!camaraActiva) return;

    if (escaneoAutomatico) {
        actualizarEstadoCamara(
            "Modo automático activado. Buscando identificadores...",
            "success"
        );

        programarEscaneoAutomatico(300);
    } else {
        actualizarEstadoCamara(
            "Modo manual activado. Presiona Analizar fotograma cuando estés listo.",
            "info"
        );
    }
});

// -----------------------------------------------------
// 9.9. Eventos de los controles
// -----------------------------------------------------

startCameraButton?.addEventListener(
    "click",
    iniciarCamara
);

stopCameraButton?.addEventListener(
    "click",
    detenerCamara
);

// El formulario se utiliza para el escaneo manual.
scanForm?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!camaraActiva) {
        mostrarMensaje(
            "#scanMessage",
            "Primero debes iniciar la cámara.",
            "error"
        );

        return;
    }

    if (escaneoAutomatico) {
        mostrarMensaje(
            "#scanMessage",
            "Cambia al modo manual para realizar un análisis bajo demanda.",
            "info"
        );

        return;
    }

    if (solicitudOCRActiva) return;

    await analizarFotograma("manual");
});

// Reintentar análisis.
$("#retryScan")?.addEventListener("click", async () => {
    if (!camaraActiva) {
        await iniciarCamara();
        return;
    }

    if (solicitudOCRActiva) return;

    await analizarFotograma("manual");
});

// Utilizar identificador reconocido.
$("#useIdentifier")?.addEventListener("click", () => {
    if (!ultimoResultadoOCR) return;

    const destino = rolTemporal === "administrador"
        ? $("#adminContainerNumber")
        : containerNumber;

    if (destino) {
        destino.value = ultimoResultadoOCR.valor || "";
        destino.focus();
    }

    const formulario = rolTemporal === "administrador"
        ? $("#adminContainerForm")
        : containerForm;

    formulario?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

// Inicializar estado de los controles.
escaneoAutomatico =
    !cameraScanMode ||
    cameraScanMode.value === "auto";

actualizarControlesCamara();

actualizarEstadoCamara(
    "La cámara está detenida.",
    "info"
);

// Liberar la cámara al abandonar la página.
window.addEventListener("beforeunload", detenerCamara);

// =====================================================
// 10. INVENTARIO DE CONTENEDORES
// =====================================================

async function cargarContenedores() {
    if (containersList) {
        containersList.innerHTML =
            '<div class="loading">Cargando contenedores...</div>';
    }

    try {
        const respuesta = await peticion(
            "/api/contenedores/"
        );

        if (!Array.isArray(respuesta)) {
            throw new Error(
                "La respuesta de contenedores no es válida."
            );
        }

        contenedores = respuesta;

        actualizarTexto(
            "#totalContainers",
            String(contenedores.length)
        );

        renderizarContenedores();
        renderizarHistorialOperador();

        await actualizarTotalFotos();

        actualizarResumenOperador();

    } catch (error) {
        if (containersList) {
            containersList.innerHTML =
                '<div class="empty-list">No se pudieron cargar los contenedores.</div>';
        }

        mostrarMensaje(
            "#containerMessage",
            error.message,
            "error"
        );
    }
}

function renderizarContenedores() {
    if (!containersList) return;

    if (!contenedores.length) {
        containersList.innerHTML = `
            <div class="empty-list">
                Todavía no hay contenedores registrados.
            </div>
        `;

        return;
    }

    const esAdmin = rolTemporal === "administrador";

    containersList.innerHTML = contenedores.map((contenedor) => {
        const seleccionado =
            Number(contenedorSeleccionado) ===
            Number(contenedor.id);

        const fecha = formatearFecha(
            contenedor.fecha_registro
        );

        const hora = formatearHora(
            contenedor.hora_registro
        );

        const estado = contenedor.estado
            ? `<span class="container-status">${escaparHTML(
                contenedor.estado
            )}</span>`
            : "";

        const observaciones = contenedor.observaciones
            ? `<small>${escaparHTML(
                contenedor.observaciones
            )}</small>`
            : "";

        const operador = contenedor.operador_nombre
            ? `<small>Operador: ${escaparHTML(
                contenedor.operador_nombre
            )}</small>`
            : "";

        return `
            <article class="container-item ${
                seleccionado ? "selected" : ""
            }">
                <div class="container-info">
                    <strong>${escaparHTML(contenedor.numero)}</strong>

                    <span>
                        Registro #${escaparHTML(contenedor.id)}
                        · ${escaparHTML(fecha)}
                        ${hora
                            ? ` · ${escaparHTML(hora)}`
                            : ""}
                    </span>

                    ${estado}
                    ${operador}
                    ${observaciones}
                </div>

                <div class="container-actions">
                    <button
                        class="button secondary"
                        type="button"
                        data-action="photos"
                        data-id="${Number(contenedor.id)}">
                        Fotografías
                    </button>

                    ${
                        esAdmin
                            ? `
                                <button
                                    class="button danger"
                                    type="button"
                                    data-action="delete"
                                    data-id="${Number(contenedor.id)}">
                                    Eliminar
                                </button>
                            `
                            : ""
                    }
                </div>
            </article>
        `;
    }).join("");
}

containersList?.addEventListener("click", async (evento) => {
    const boton = evento.target.closest(
        "button[data-action]"
    );

    if (!boton) return;

    const id = Number(boton.dataset.id);

    if (!Number.isFinite(id)) return;

    if (boton.dataset.action === "photos") {
        await abrirFotografias(id);
    }

    if (
        boton.dataset.action === "delete" &&
        rolTemporal === "administrador"
    ) {
        await eliminarContenedor(id);
    }
});

containerForm?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    ocultarMensaje("#containerMessage");

    const numero = obtenerNumeroContenedor();

    if (!numero) {
        mostrarMensaje(
            "#containerMessage",
            "Escribe el identificador del contenedor.",
            "error"
        );

        return;
    }

    const boton = containerForm.querySelector(
        "button[type='submit']"
    );

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Registrando...";
    }

    try {
        const nuevo = await peticion(
            "/api/contenedores/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ numero })
            }
        );

        if (containerNumber) {
            containerNumber.value = "";
        }

        mostrarMensaje(
            "#containerMessage",
            `Contenedor ${nuevo.numero || numero} registrado correctamente.`,
            "success"
        );

        await cargarContenedores();

    } catch (error) {
        mostrarMensaje(
            "#containerMessage",
            error.message,
            "error"
        );

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Registrar contenedor";
        }
    }
});

// Formulario de registro del administrador.
$("#adminContainerForm")?.addEventListener(
    "submit",
    async (evento) => {
        evento.preventDefault();

        if (rolTemporal !== "administrador") return;

        const campo = $("#adminContainerNumber");

        const numero = (
            campo?.value || ""
        ).trim().toUpperCase();

        if (!numero) {
            mostrarMensaje(
                "#adminContainerMessage",
                "Escribe el identificador del contenedor.",
                "error"
            );

            return;
        }

        const boton = $(
            "#adminContainerForm button[type='submit']"
        );

        if (boton) {
            boton.disabled = true;
            boton.textContent = "Registrando...";
        }

        try {
            await peticion(
                "/api/contenedores/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ numero })
                }
            );

            if (campo) {
                campo.value = "";
            }

            mostrarMensaje(
                "#adminContainerMessage",
                `Contenedor ${numero} registrado correctamente.`,
                "success"
            );

            await cargarContenedores();

        } catch (error) {
            mostrarMensaje(
                "#adminContainerMessage",
                error.message,
                "error"
            );

        } finally {
            if (boton) {
                boton.disabled = false;
                boton.textContent = "Registrar contenedor";
            }
        }
    }
);

async function eliminarContenedor(id) {
    if (rolTemporal !== "administrador") return;

    const contenedor = contenedores.find(
        (item) => Number(item.id) === id
    );

    if (!contenedor) return;

    const confirmar = window.confirm(
        `¿Eliminar el contenedor ${contenedor.numero}?\n\nEsta operación no se puede deshacer.`
    );

    if (!confirmar) return;

    try {
        await peticion(
            `/api/contenedores/${id}`,
            { method: "DELETE" }
        );

        if (Number(contenedorSeleccionado) === id) {
            cerrarFotografias();
        }

        mostrarMensaje(
            "#containerMessage",
            "Contenedor eliminado correctamente.",
            "success"
        );

        await cargarContenedores();

    } catch (error) {
        mostrarMensaje(
            "#containerMessage",
            error.message,
            "error"
        );
    }
}

$("#refreshContainers")?.addEventListener(
    "click",
    cargarContenedores
);

// =====================================================
// 11. FOTOGRAFÍAS TEMPORALES DEL OPERADOR
// =====================================================

operatorPhotoInput?.setAttribute("accept", "image/*");
operatorPhotoInput?.setAttribute("capture", "environment");

function renderizarFotosTemporales() {
    const lista = $("#operatorPhotoPreview");

    if (!lista) return;

    if (!fotosTemporales.length) {
        lista.innerHTML = `
            <div class="empty-list">
                Agrega al menos una fotografía del contenedor.
            </div>
        `;

        return;
    }

    fotosTemporales.forEach((archivo) => {
        if (!fotosTemporalesURLs.has(archivo)) {
            fotosTemporalesURLs.set(
                archivo,
                URL.createObjectURL(archivo)
            );
        }
    });

    lista.innerHTML = fotosTemporales.map(
        (archivo, indice) => `
            <article class="photo-card">
                <img
                    src="${escaparHTML(
                        fotosTemporalesURLs.get(archivo)
                    )}"
                    alt="Vista previa de ${escaparHTML(
                        archivo.name
                    )}"
                    loading="lazy"
                    style="width:100%; max-height:220px; object-fit:contain; border-radius:12px;"
                >

                <div class="photo-card-footer">
                    <span>
                        ${escaparHTML(archivo.name)}
                    </span>

                    <button
                        type="button"
                        class="button secondary"
                        data-remove-temporary-photo="${indice}">
                        Quitar
                    </button>
                </div>
            </article>
        `
    ).join("");
}

operatorPhotoInput?.addEventListener("change", () => {
    const archivos = [...operatorPhotoInput.files];

    if (!archivos.length) return;

    const disponibles =
        MAX_FOTOS_CONTENEDOR - fotosTemporales.length;

    if (disponibles <= 0) {
        mostrarMensaje(
            "#photoMessage",
            "Ya alcanzaste el máximo de cinco fotografías.",
            "error"
        );

        operatorPhotoInput.value = "";

        return;
    }

    const seleccionados = archivos.slice(
        0,
        disponibles
    );

    for (const archivo of seleccionados) {
        const error = esImagenValida(archivo);

        if (error) {
            mostrarMensaje(
                "#photoMessage",
                error,
                "error"
            );

            operatorPhotoInput.value = "";

            return;
        }
    }

    fotosTemporales.push(...seleccionados);

    if (archivos.length > disponibles) {
        mostrarMensaje(
            "#photoMessage",
            "Solo se agregaron las fotografías que cabían en el límite de cinco.",
            "info"
        );
    } else {
        ocultarMensaje("#photoMessage");
    }

    operatorPhotoInput.value = "";

    renderizarFotosTemporales();
    actualizarResumenOperador();
});

$("#operatorPhotoPreview")?.addEventListener(
    "click",
    (evento) => {
        const boton = evento.target.closest(
            "[data-remove-temporary-photo]"
        );

        if (!boton) return;

        const indice = Number(
            boton.dataset.removeTemporaryPhoto
        );

        if (!Number.isInteger(indice)) return;

        const [fotoEliminada] = fotosTemporales.splice(
            indice,
            1
        );

        if (
            fotoEliminada &&
            fotosTemporalesURLs.has(fotoEliminada)
        ) {
            URL.revokeObjectURL(
                fotosTemporalesURLs.get(fotoEliminada)
            );

            fotosTemporalesURLs.delete(fotoEliminada);
        }

        renderizarFotosTemporales();
        actualizarResumenOperador();
    }
);

// El formulario del operador solamente valida las fotos
// temporales. No las sube al servidor en este momento.
operatorPhotoForm?.addEventListener(
    "submit",
    (evento) => {
        evento.preventDefault();

        if (!fotosTemporales.length) {
            mostrarMensaje(
                "#photoMessage",
                "Selecciona al menos una fotografía para continuar.",
                "error"
            );

            return;
        }

        mostrarMensaje(
            "#photoMessage",
            `${fotosTemporales.length} fotografía(s) listas para registrar.`,
            "success"
        );
    }
);

// =====================================================
// 12. PESTAÑAS DE EVIDENCIA DEL ADMINISTRADOR
// =====================================================

$$("[data-evidence-tab]").forEach((boton) => {
    boton.addEventListener("click", () => {
        const tipo = boton.dataset.evidenceTab;

        if (!["contenedor", "sellos"].includes(tipo)) {
            return;
        }

        tipoEvidencia = tipo;

        $$("[data-evidence-tab]").forEach((tab) => {
            const activo = tab === boton;

            tab.classList.toggle("active", activo);

            tab.setAttribute(
                "aria-selected",
                String(activo)
            );
        });

        const esSello = tipoEvidencia === "sellos";

        const etiqueta = $("#adminPhotoInputLabel");
        const botonSubida = $("#adminUploadPhotoButton");

        if (etiqueta) {
            etiqueta.textContent = esSello
                ? "Fotografía del sello"
                : "Fotografía del contenedor";
        }

        $("#adminSealNumberWrapper")?.classList.toggle(
            "hidden",
            !esSello
        );

        $("#adminSealApiNote")?.classList.toggle(
            "hidden",
            !esSello
        );

        if (botonSubida) {
            botonSubida.textContent = esSello
                ? "Función de sellos pendiente"
                : "Subir fotografía";

            botonSubida.disabled = esSello;
        }

        if (adminPhotoInput) {
            adminPhotoInput.value = "";
        }

        if (esSello) {
            mostrarMensaje(
                "#adminPhotoMessage",
                "La carga de fotografías de sellos todavía no está conectada al backend.",
                "info"
            );
        } else {
            ocultarMensaje("#adminPhotoMessage");
        }
    });
});

// =====================================================
// 13. CONSULTA DE FOTOGRAFÍAS GUARDADAS
// =====================================================

async function abrirFotografias(id) {
    if (rolTemporal !== "administrador") return;

    const contenedor = contenedores.find(
        (item) => Number(item.id) === Number(id)
    );

    if (!contenedor) return;

    contenedorSeleccionado = Number(id);
    tipoEvidencia = "contenedor";

    actualizarTexto(
        "#selectedContainerTitle",
        `Fotografías de ${contenedor.numero}`
    );

    actualizarTexto(
        "#selectedContainerDescription",
        `Contenedor #${contenedor.id}`
    );

    photosSection?.classList.remove("hidden");

    if (adminPhotosList) {
        adminPhotosList.innerHTML =
            '<div class="loading">Cargando fotografías...</div>';
    }

    $$("[data-evidence-tab]").forEach((tab) => {
        const activo =
            tab.dataset.evidenceTab === "contenedor";

        tab.classList.toggle("active", activo);

        tab.setAttribute(
            "aria-selected",
            String(activo)
        );
    });

    actualizarTexto(
        "#adminPhotoInputLabel",
        "Fotografía del contenedor"
    );

    $("#adminSealNumberWrapper")?.classList.add("hidden");
    $("#adminSealApiNote")?.classList.add("hidden");

    const botonSubida = $("#adminUploadPhotoButton");

    if (botonSubida) {
        botonSubida.disabled = false;
        botonSubida.textContent = "Subir fotografía";
    }

    ocultarMensaje("#adminPhotoMessage");

    renderizarContenedores();

    photosSection?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    await cargarFotografias(id);
}

async function cargarFotografias(id) {
    const lista = adminPhotosList;

    if (!lista) return;

    try {
        const fotos = await peticion(
            `/api/fotos/contenedor/${id}`
        );

        if (!Array.isArray(fotos)) {
            throw new Error(
                "La respuesta de fotografías no es válida."
            );
        }

        renderizarFotografias(fotos, lista);

        await actualizarTotalFotos();

    } catch (error) {
        lista.innerHTML =
            '<div class="empty-list">No se pudieron cargar las fotografías.</div>';

        mostrarMensaje(
            "#adminPhotoMessage",
            error.message,
            "error"
        );
    }
}

function renderizarFotografias(
    fotos,
    lista = adminPhotosList
) {
    if (!lista) return;

    if (!fotos.length) {
        lista.innerHTML =
            '<div class="empty-list">Este contenedor todavía no tiene fotografías.</div>';

        return;
    }

    lista.innerHTML = fotos.map((foto) => `
        <article class="photo-card">
            <a
                href="${escaparHTML(foto.url)}"
                target="_blank"
                rel="noopener noreferrer">
                <img
                    src="${escaparHTML(foto.url)}"
                    alt="Fotografía del contenedor"
                    loading="lazy">
            </a>

            <div class="photo-card-footer">
                <span>
                    Fotografía #${escaparHTML(foto.id)}
                </span>

                ${
                    rolTemporal === "administrador"
                        ? `
                            <button
                                class="button danger"
                                type="button"
                                data-delete-photo="${Number(foto.id)}">
                                Eliminar
                            </button>
                        `
                        : ""
                }
            </div>
        </article>
    `).join("");
}

// Eliminar fotografía desde el administrador.
document.addEventListener("click", async (evento) => {
    const boton = evento.target.closest(
        "button[data-delete-photo]"
    );

    if (!boton || rolTemporal !== "administrador") {
        return;
    }

    const id = Number(boton.dataset.deletePhoto);

    if (!Number.isFinite(id)) return;

    if (!window.confirm("¿Deseas eliminar esta fotografía?")) {
        return;
    }

    try {
        await peticion(
            `/api/fotos/${id}`,
            { method: "DELETE" }
        );

        mostrarMensaje(
            "#adminPhotoMessage",
            "Fotografía eliminada correctamente.",
            "success"
        );

        if (contenedorSeleccionado !== null) {
            await cargarFotografias(
                contenedorSeleccionado
            );
        }

    } catch (error) {
        mostrarMensaje(
            "#adminPhotoMessage",
            error.message,
            "error"
        );
    }
});

// Formulario exclusivo del administrador.
adminPhotoForm?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (rolTemporal !== "administrador") return;

    if (tipoEvidencia === "sellos") {
        mostrarMensaje(
            "#adminPhotoMessage",
            "La carga de sellos requiere un endpoint específico del backend.",
            "info"
        );

        return;
    }

    if (!contenedorSeleccionado) {
        mostrarMensaje(
            "#adminPhotoMessage",
            "Selecciona primero un contenedor.",
            "error"
        );

        return;
    }

    const archivo = adminPhotoInput?.files[0];
    const errorArchivo = esImagenValida(archivo);

    if (errorArchivo) {
        mostrarMensaje(
            "#adminPhotoMessage",
            errorArchivo,
            "error"
        );

        return;
    }

    const datos = new FormData();

    datos.append("foto", archivo);

    const boton = $("#adminUploadPhotoButton");

    if (boton) {
        boton.disabled = true;
        boton.textContent = "Subiendo...";
    }

    try {
        await peticion(
            `/api/fotos/${contenedorSeleccionado}`,
            {
                method: "POST",
                body: datos
            }
        );

        adminPhotoForm.reset();

        mostrarMensaje(
            "#adminPhotoMessage",
            "Fotografía guardada correctamente.",
            "success"
        );

        await cargarFotografias(
            contenedorSeleccionado
        );

    } catch (error) {
        mostrarMensaje(
            "#adminPhotoMessage",
            error.message,
            "error"
        );

    } finally {
        if (boton) {
            boton.disabled = tipoEvidencia === "sellos";

            boton.textContent = tipoEvidencia === "sellos"
                ? "Función de sellos pendiente"
                : "Subir fotografía";
        }
    }
});

function cerrarFotografias() {
    contenedorSeleccionado = null;

    photosSection?.classList.add("hidden");

    if (adminPhotosList) {
        adminPhotosList.innerHTML = "";
    }

    adminPhotoForm?.reset();

    ocultarMensaje("#adminPhotoMessage");

    renderizarContenedores();
}

$("#closePhotos")?.addEventListener(
    "click",
    cerrarFotografias
);

// =====================================================
// 14. RESUMEN DEL OPERADOR Y ESTADÍSTICAS
// =====================================================

async function actualizarResumenOperador() {
    actualizarTexto(
        "#operatorTotalContainers",
        String(contenedores.length)
    );

    actualizarTexto(
        "#operatorTotalPhotos",
        String(fotosTemporales.length)
    );

    actualizarTexto(
        "#operatorLastRegistration",
        contenedores.length
            ? formatearFecha(
                contenedores[contenedores.length - 1].fecha_registro
            )
            : "Sin registros"
    );

    actualizarTexto(
        "#operatorPhotoCount",
        String(fotosTemporales.length)
    );
}

async function actualizarTotalFotos() {
    try {
        const resultados = await Promise.all(
            contenedores.map(async (contenedor) => {
                const fotos = await peticion(
                    `/api/fotos/contenedor/${contenedor.id}`
                );

                return Array.isArray(fotos)
                    ? fotos.length
                    : 0;
            })
        );

        const total = resultados.reduce(
            (acumulado, cantidad) => acumulado + cantidad,
            0
        );

        actualizarTexto("#totalPhotos", String(total));

    } catch {
        actualizarTexto("#totalPhotos", "—");
    }
}

// =====================================================
// 15. INICIO DE LA APLICACIÓN
// =====================================================

async function iniciarAplicacion() {
    await comprobarEstado();
    await cargarContenedores();

    // Siempre se inicia en el acceso de demostración.
    rolTemporal = null;

    if (window.AppState) {
        window.AppState.limpiarRol();
    } else {
        document.body.removeAttribute("data-role");
        document.body.removeAttribute("data-view");
    }

    roleSelector?.classList.remove("hidden");

    $$(".admin-only").forEach((elemento) => {
        elemento.classList.add("hidden");
    });

    $$(".operator-only").forEach((elemento) => {
        elemento.classList.add("hidden");
    });

    ocultarTodasLasVistasRouter();

    photosSection?.classList.add("hidden");

    roleSelector?.scrollIntoView({
        behavior: "auto",
        block: "start"
    });
}

iniciarAplicacion();