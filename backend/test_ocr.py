
import unittest

from ocr import analizar


class TestAnalizarIdentificadores(unittest.TestCase):

    def test_acepta_alfanumerico_letra_y_numeros(self):
        resultado = analizar("P5210494", 84, "auto", "ocr")

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado["tipo"], "alfanumerico")
        self.assertEqual(resultado["valor"], "P5210494")

    def test_acepta_letras_antes_de_numeros(self):
        resultado = analizar("AB123456", 90, "auto", "ocr")

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado["tipo"], "alfanumerico")

    def test_acepta_numeros_antes_de_letras(self):
        resultado = analizar("12AB3456", 90, "auto", "ocr")

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado["tipo"], "alfanumerico")

    def test_acepta_letras_y_numeros_intercalados(self):
        resultado = analizar("P52A0494", 90, "auto", "ocr")

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado["tipo"], "alfanumerico")

    def test_rechaza_alfanumerico_con_confianza_baja(self):
        resultado = analizar("P5210494", 60, "auto", "ocr")

        self.assertIsNone(resultado)

    def test_conserva_numeros_de_unidad(self):
        resultado = analizar("242012", 95, "auto", "segmentacion")

        self.assertIsNotNone(resultado)
        self.assertEqual(resultado["tipo"], "numerico")
        self.assertEqual(resultado["valor"], "242012")

    def test_no_acepta_alfanumerico_en_modo_numerico(self):
        resultado = analizar("P5210494", 95, "numerico", "ocr")

        self.assertIsNone(resultado)


if __name__ == "__main__":
    unittest.main(verbosity=2)