"use strict";

// =====================================================
// CAMARA EN VIVO - INVENTARIO DIGITALIZADO
// =====================================================

window.CamaraApp = {
    stream: null,
    video: null,
    canvas: null,
    intervalo: null,
    procesando: false,
    activa: false,

    configuracion: {
        intervaloAutomatico: 1500,
        calidadImagen: 0.85,
        anchoMaximo: 1280
    },

    async iniciar(video) {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "El navegador no permite acceder a la cámara. Usa localhost o HTTPS."
            );
        }

        this.detener();

        this.video = video;

        this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        this.video.srcObject = this.stream;

        await this.video.play();

        this.canvas = document.createElement("canvas");
        this.activa = true;

        return true;
    },

    async capturarFotograma() {
        if (!this.activa || !this.video || !this.canvas) {
            throw new Error("La cámara no está activa.");
        }

        if (
            this.video.readyState <
            HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
            throw new Error("La cámara todavía no está lista.");
        }

        const anchoOriginal = this.video.videoWidth;
        const altoOriginal = this.video.videoHeight;

        if (!anchoOriginal || !altoOriginal) {
            throw new Error("No se pudo obtener el fotograma.");
        }

        const escala = Math.min(
            1,
            this.configuracion.anchoMaximo / anchoOriginal
        );

        this.canvas.width = Math.round(anchoOriginal * escala);
        this.canvas.height = Math.round(altoOriginal * escala);

        const contexto = this.canvas.getContext("2d");

        contexto.drawImage(
            this.video,
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

        return new Promise((resolve, reject) => {
            this.canvas.toBlob(
                blob => {
                    if (!blob) {
                        reject(
                            new Error("No se pudo capturar la imagen.")
                        );
                        return;
                    }

                    resolve(blob);
                },
                "image/jpeg",
                this.configuracion.calidadImagen
            );
        });
    },

    async escanear(modo = "auto") {
        if (!this.activa) {
            throw new Error("Primero debes iniciar la cámara.");
        }

        if (this.procesando) {
            return null;
        }

        this.procesando = true;

        try {
            const imagen = await this.capturarFotograma();

            const datos = new FormData();
            datos.append("imagen", imagen, "captura.jpg");
            datos.append("modo", modo);

            const respuesta = await fetch("/api/escanear", {
                method: "POST",
                body: datos
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error ||
                    "No se pudo procesar la imagen."
                );
            }

            return resultado;

        } finally {
            this.procesando = false;
        }
    },

    iniciarAutomatico(callback) {
        this.detenerAutomatico();

        this.intervalo = setInterval(async () => {
            if (!this.activa || this.procesando) {
                return;
            }

            try {
                const resultado = await this.escanear("auto");

                if (resultado?.encontrado) {
                    this.detenerAutomatico();
                    callback(resultado);
                }
            } catch (error) {
                console.warn(
                    "Error en reconocimiento automático:",
                    error
                );
            }
        }, this.configuracion.intervaloAutomatico);
    },

    detenerAutomatico() {
        if (this.intervalo !== null) {
            clearInterval(this.intervalo);
            this.intervalo = null;
        }
    },

    detener() {
        this.detenerAutomatico();

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.video) {
            this.video.srcObject = null;
        }

        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.activa = false;
        this.procesando = false;
    }
};

console.log("Módulo de cámara cargado correctamente.");