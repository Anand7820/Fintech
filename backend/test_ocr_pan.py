import cv2
import sys
import numpy as np
import pytesseract

def _enhance_region(crop: np.ndarray) -> np.ndarray:
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop
    if max(gray.shape[:2]) < 900:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
    return clahe.apply(gray)

image_path = "/Users/anandkamble/Desktop/KYC/backend/pan_test.jpg" # Need to find the image. Let's see if there are images in the backend.
# Actually I will just check the logs.
