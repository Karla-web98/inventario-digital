"use strict";

// =====================================================
// ROUTER PRINCIPAL
// =====================================================

const VISTAS = {
    // =================================================
    // OPERADOR
    // =================================================

    dashboard_operador: [
        "operatorHomeSection"
    ],

    registro: [
        "operatorFlowSection"
    ],

    historial_operador: [
        "operatorHistorySection"
    ],

    // =================================================
    // ADMINISTRADOR
    // =================================================

    dashboard_admin: [
        "statsSection"
    ],

    inventario: [
        "inventoryHeading",
        "adminInventoryWorkspace"
    ],

    historial_admin: [
        "historySection"
    ],

    usuarios: [
        "usersSection"
    ],

    geolocalizacion: [
        "geolocationSection"
    ],

    fotos: [
        "photosSection"
    ],

    // =================================================
    // DETALLE DE CONTENEDOR
    // =================================================

    detalle_contenedor: [
        "photosSection"
    ]
};


// =====================================================
// OBTENER ELEMENTO
// =====================================================

function obtenerElementoVista(id) {
    return document.getElementById(id);
}


// =====================================================
// OBTENER TODOS LOS ELEMENTOS QUE PUEDE CONTROLAR
// EL ROUTER
// =====================================================

function obtenerTodosLosIdsDeVista() {
    return [
        ...new Set(
            Object.values(VISTAS).flat()
        )
    ];
}


// =====================================================
// OCULTAR TODAS LAS VISTAS
// =====================================================

function ocultarTodasLasVistas() {
    const ids = obtenerTodosLosIdsDeVista();

    ids.forEach((id) => {
        const elemento = obtenerElementoVista(id);

        if (elemento) {
            elemento.classList.add("hidden");
        }
    });
}


// =====================================================
// CAMBIAR DE VISTA
// =====================================================

function cambiarVista(nombreVista, opciones = {}) {
    const idsVista = VISTAS[nombreVista];

    if (!idsVista) {
        console.warn(
            `Vista no encontrada: ${nombreVista}`
        );

        return false;
    }

    const elementos = idsVista
        .map(obtenerElementoVista)
        .filter(Boolean);

    if (elementos.length === 0) {
        console.warn(
            `No se encontraron elementos para la vista: ${nombreVista}`
        );

        return false;
    }

    // Ocultar todo primero
    ocultarTodasLasVistas();

    // Mostrar únicamente la vista solicitada
    elementos.forEach((elemento) => {
        elemento.classList.remove("hidden");
    });

    // Guardar vista actual
    document.body.dataset.view = nombreVista;

    if (window.AppState) {
        window.AppState.establecerVista(nombreVista);
    }

    // Desplazamiento automático
    if (opciones.scroll !== false) {
        elementos[0].scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Avisar al resto de la aplicación
    document.dispatchEvent(
        new CustomEvent("vista:cambiada", {
            detail: {
                vista: nombreVista
            }
        })
    );

    return true;
}


// =====================================================
// OBTENER VISTA ACTUAL
// =====================================================

function obtenerVistaActual() {
    return (
        document.body.dataset.view ||
        window.AppState?.vistaActual ||
        null
    );
}


// =====================================================
// VISTA INICIAL SEGÚN EL ROL
// =====================================================

function establecerVistaInicial() {
    const rol = window.AppState?.rol;

    if (rol === "operador") {
        cambiarVista("dashboard_operador", {
            scroll: false
        });

        return;
    }

    if (rol === "administrador") {
        cambiarVista("dashboard_admin", {
            scroll: false
        });

        return;
    }

    // Si todavía no hay usuario seleccionado,
    // no mostramos ninguna vista interna.
    ocultarTodasLasVistas();
}


// =====================================================
// EXPORTACIÓN GLOBAL
// =====================================================

window.VISTAS = VISTAS;
window.cambiarVista = cambiarVista;
window.obtenerVistaActual = obtenerVistaActual;
window.establecerVistaInicial = establecerVistaInicial;