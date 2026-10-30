
import cv2
import pytesseract

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

imagen = cv2.imread("Imagen3_recorte.png")

if imagen is None:
    print("No se encontró Imagen3_recorte.png")
    raise SystemExit(1)

# Escala de grises y ampliación
gris = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
gris = cv2.resize(
    gris, None, fx=4, fy=4,
    interpolation=cv2.INTER_CUBIC
)

# Crear versiones para comparar
_, otsu = cv2.threshold(
    gris, 0, 255,
    cv2.THRESH_BINARY + cv2.THRESH_OTSU
)

adaptativa = cv2.adaptiveThreshold(
    gris, 255,
    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv2.THRESH_BINARY,
    31, 11
)

configuraciones = [
    ("Grises", gris),
    ("Otsu", otsu),
    ("Adaptativa", adaptativa),
]

config = (
    "--oem 3 --psm 6 "
    "-c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

for nombre, procesada in configuraciones:
    print(f"\n--- {nombre} ---")

    for giro, rotacion in [
        (0, None),
        (90, cv2.ROTATE_90_CLOCKWISE),
        (270, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]:
        prueba = (
            procesada.copy()
            if rotacion is None
            else cv2.rotate(procesada, rotacion)
        )

        texto = pytesseract.image_to_string(
            prueba,
            config=config
        ).strip()

        print(f"Giro {giro}: {texto or '(sin texto)'}")

