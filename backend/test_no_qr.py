import cv2
import pytesseract

img = cv2.imread('/Users/anandkamble/Downloads/AnandPAN.jpeg')
h, w = img.shape[:2]

crop = img[:, :int(w * 0.65)]
gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
enhanced = clahe.apply(gray)

text = pytesseract.image_to_string(enhanced, lang='eng', config='--psm 3')
print('TEXT (0-0.65) PSM 3:\n', text)

text6 = pytesseract.image_to_string(enhanced, lang='eng', config='--psm 6')
print('TEXT (0-0.65) PSM 6:\n', text6)
