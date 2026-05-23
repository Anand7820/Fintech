import cv2
import pytesseract
import numpy as np

img = cv2.imread('/Users/anandkamble/Downloads/AnandPAN.jpeg')
h, w = img.shape[:2]

# Crop details avoiding QR code (0.22 to 0.65)
crop = img[int(h * 0.08) : int(h * 0.92), int(w * 0.22) : int(w * 0.65)]

gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
enhanced = clahe.apply(gray)

text = pytesseract.image_to_string(enhanced, config='--psm 6')
print('TEXT WITHOUT DENOISING:\n', text)
