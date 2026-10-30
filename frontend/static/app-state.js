"use strict";

// =====================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// =====================================================

window.AppState = {
    rol: null,
    vistaActual: null,

    establecerRol(rol) {
        if (!["operador", "administrador"].includes(rol)) {
            return false;
        }

        this.rol = rol;
        document.body.dataset.role = rol;

        return true;
    },

    establecerVista(vista) {
        this.vistaActual = vista;
    },

    limpiarRol() {
        this.rol = null;
        this.vistaActual = null;
        document.body.removeAttribute("data-role");
        document.body.removeAttribute("data-view");
    }
};