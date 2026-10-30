
import cv2
import pytesseract

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

imagen = cv2.imread("Imagen3_recorte.png")

if imagen is None:
    print("No se encontró Imagen3_recorte.png")
    raise SystemExit

alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

orientaciones = [
    ("Izquierda", cv2.ROTATE_90_COUNTERCLOCKWISE),
    ("Derecha", cv2.ROTATE_90_CLOCKWISE),
]

for nombre, giro in orientaciones:
    imagen_girada = cv2.rotate(imagen, giro)

    imagen_girada = cv2.resize(
        imagen_girada,
        None,
        fx=4,
        fy=4,
        interpolation=cv2.INTER_CUBIC,
    )

    gris = cv2.cvtColor(imagen_girada, cv2.COLOR_BGR2GRAY)

    cv2.imwrite(f"prueba_{nombre.lower()}.png", gris)

    print(f"\n--- Orientación {nombre} ---")

    for psm in (6, 7, 11, 13):
        configuracion = (
            f"--oem 3 --psm {psm} "
            f"-c tessedit_char_whitelist={alfabeto}"
        )

        texto = pytesseract.image_to_string(
            gris,
            config=configuracion,
        ).strip()

        print(f"PSM {psm}: {texto or '(sin texto)'}")
